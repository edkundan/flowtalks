import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off, serverTimestamp, get, update, Database, DatabaseReference, remove } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDEo2b9ALsMDOZOAg_1R0VMjdB_QnRh2kk",
  authDomain: "random-talk-dd79a.firebaseapp.com",
  databaseURL: "https://random-talk-dd79a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "random-talk-dd79a",
  storageBucket: "random-talk-dd79a.firebasestorage.app",
  messagingSenderId: "870826315489",
  appId: "1:870826315489:web:8796f08e2495100e1eb1a0",
  measurementId: "G-5PFT3YWGVF"
};

class FirebaseService {
  private app;
  private db: Database;
  private auth;
  private userId: string | null = null;
  private initialized: boolean = false;
  private messageCallback: ((message: any) => void) | null = null;
  private partnerRef: DatabaseReference | null = null;
  private availableUsersRef: DatabaseReference | null = null;
  private currentChatRoom: string | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userCountCallback: ((count: number) => void) | null = null;
  private audioElement: HTMLAudioElement | null = null;

  constructor() {
    try {
      console.log('Initializing Firebase...');
      this.app = initializeApp(firebaseConfig);
      this.db = getDatabase(this.app);
      this.auth = getAuth(this.app);
      this.initializeAuth();
      this.setupOnlineUsersCounter();
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
  }

  private setupOnlineUsersCounter() {
    const onlineUsersRef = ref(this.db, 'onlineUsers');
    onValue(onlineUsersRef, (snapshot) => {
      const count = snapshot.size;
      console.log('Online users count:', count);
      if (this.userCountCallback) {
        this.userCountCallback(count);
      }
    });
  }

  setUserCountCallback(callback: (count: number) => void) {
    this.userCountCallback = callback;
  }

  getCurrentUserId() {
    return this.userId;
  }

  private async initializeAuth() {
    try {
      console.log('Attempting anonymous sign in...');
      const userCredential = await signInAnonymously(this.auth);
      this.userId = userCredential.user.uid;
      this.initialized = true;
      console.log('Successfully signed in anonymously:', this.userId);
      
      if (this.userId) {
        const userStatusRef = ref(this.db, `users/${this.userId}`);
        const onlineUserRef = ref(this.db, `onlineUsers/${this.userId}`);
        
        await set(userStatusRef, {
          status: 'online',
          lastSeen: serverTimestamp(),
          partner: null
        });

        await set(onlineUserRef, {
          timestamp: serverTimestamp()
        });

        const connectedRef = ref(this.db, '.info/connected');
        onValue(connectedRef, (snap) => {
          if (snap.val() === false && this.userId) {
            this.cleanup();
          }
        });

        onValue(ref(this.db, `users/${this.userId}/partner`), (snapshot) => {
          const partnerId = snapshot.val();
          if (!partnerId) {
            this.handlePartnerDisconnect();
          }
        });
      }
    } catch (error: any) {
      console.error('Anonymous authentication error:', error.code, error.message);
      throw error;
    }
  }

  private handlePartnerDisconnect() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  async findPartner(): Promise<string | null> {
    if (!this.initialized || !this.userId) {
      console.error('Firebase not initialized or user not authenticated');
      return null;
    }
    
    try {
      console.log('Finding partner...');
      
      await this.cleanup();
      
      const availableUsersRef = ref(this.db, 'availableUsers');
      const snapshot = await get(availableUsersRef);
      
      const currentUserRef = ref(this.db, `users/${this.userId}/partner`);
      const currentUserSnap = await get(currentUserRef);
      
      if (currentUserSnap.exists()) {
        console.log('User already has a partner');
        return currentUserSnap.val();
      }

      const availableUsers: string[] = [];
      const userPromises: Promise<any>[] = [];

      snapshot.forEach((childSnapshot) => {
        const userId = childSnapshot.key;
        if (userId && userId !== this.userId) {
          const userPromise = get(ref(this.db, `users/${userId}`))
            .then(userSnap => {
              const userData = userSnap.val();
              if (!userData?.partner) {
                availableUsers.push(userId);
              }
            });
          userPromises.push(userPromise);
        }
      });

      await Promise.all(userPromises);

      if (availableUsers.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableUsers.length);
        const randomPartner = availableUsers[randomIndex];
        console.log('Found potential partner:', randomPartner);

        const chatRoomId = [this.userId, randomPartner].sort().join('_');
        this.currentChatRoom = chatRoomId;

        const updates: any = {};
        updates[`availableUsers/${this.userId}`] = null;
        updates[`availableUsers/${randomPartner}`] = null;
        updates[`users/${this.userId}/partner`] = randomPartner;
        updates[`users/${randomPartner}/partner`] = this.userId;
        updates[`users/${this.userId}/chatRoom`] = chatRoomId;
        updates[`users/${randomPartner}/chatRoom`] = chatRoomId;
        updates[`chats/${chatRoomId}`] = {
          created: serverTimestamp(),
          participants: {
            [this.userId as string]: true,
            [randomPartner]: true
          }
        };

        await update(ref(this.db), updates);
        console.log('Successfully paired with partner:', randomPartner);
        this.setupChatListener(randomPartner);
        return randomPartner;
      }

      console.log('No available partners, adding self to pool');
      await set(ref(this.db, `availableUsers/${this.userId}`), {
        timestamp: serverTimestamp(),
        status: 'searching'
      });

      return new Promise((resolve) => {
        const partnerRef = ref(this.db, `users/${this.userId}`);
        const unsubscribe = onValue(partnerRef, (snapshot) => {
          const userData = snapshot.val();
          if (userData?.partner) {
            console.log('Partner found:', userData.partner);
            this.currentChatRoom = userData.chatRoom;
            off(partnerRef);
            this.setupChatListener(userData.partner);
            resolve(userData.partner);
          }
        });

        setTimeout(() => {
          off(partnerRef);
          this.cleanup();
          resolve(null);
        }, 30000);
      });
    } catch (error) {
      console.error('Error finding partner:', error);
      return null;
    }
  }

  async setupAudioCall(localStream: MediaStream) {
    if (!this.currentChatRoom) {
      console.error('No chat room available for audio call');
      return;
    }

    try {
      console.log('Setting up audio call with stream:', localStream.id);
      this.localStream = localStream;

      // Cleanup existing connection
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      // Enhanced ICE server configuration for better connectivity
      const configuration = {
        iceServers: [
          { 
            urls: [
              'stun:stun1.l.google.com:19302',
              'stun:stun2.l.google.com:19302',
              'stun:stun3.l.google.com:19302',
              'stun:stun4.l.google.com:19302'
            ]
          },
          {
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ],
        iceCandidatePoolSize: 10
      };

      this.peerConnection = new RTCPeerConnection(configuration);
      const pc = this.peerConnection;

      // Optimize audio settings
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1
      };

      // Add local stream tracks with optimized constraints
      localStream.getAudioTracks().forEach(track => {
        track.applyConstraints(audioConstraints);
        console.log('Adding audio track to peer connection:', track.id);
        if (this.localStream) {
          pc.addTrack(track, this.localStream);
        }
      });

      // Create and set up audio element for remote stream
      const createAudioElement = () => {
        const audio = new Audio();
        audio.autoplay = true;
        // Remove playsInline as it's not a valid property for HTMLAudioElement
        return audio;
      };

      // Handle remote stream with robust audio playback
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        [this.remoteStream] = event.streams;
        
        // Clean up existing audio element
        if (this.audioElement) {
          this.audioElement.srcObject = null;
          this.audioElement.remove();
        }
        
        // Create and configure new audio element
        this.audioElement = createAudioElement();
        this.audioElement.srcObject = this.remoteStream;
        
        // Attempt to play audio with retry mechanism
        const playAudio = async () => {
          try {
            if (this.audioElement) {
              await this.audioElement.play();
              console.log('Remote audio playing successfully');
              // Set volume to maximum
              this.audioElement.volume = 1.0;
            }
          } catch (error) {
            console.error('Error playing remote audio:', error);
            // Retry playback after user interaction
            document.addEventListener('click', () => {
              this.audioElement?.play().catch(console.error);
            }, { once: true });
          }
        };
        
        playAudio();
      };

      // Enhanced ICE candidate handling
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate.type);
          push(ref(this.db, `chats/${this.currentChatRoom}/candidates/${this.userId}`), {
            ...event.candidate.toJSON(),
            from: this.userId,
            processed: false,
            timestamp: serverTimestamp()
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          pc.restartIce();
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          this.handleConnectionFailure();
        }
      };

      // Listen for and process remote ICE candidates
      onValue(ref(this.db, `chats/${this.currentChatRoom}/candidates`), (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidateData = childSnapshot.val();
          if (candidateData && 
              !candidateData.processed && 
              candidateData.from !== this.userId && 
              pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(candidateData))
              .then(() => {
                update(childSnapshot.ref, { processed: true });
              })
              .catch(console.error);
          }
        });
      });

      // Set up signaling
      const signalingRef = ref(this.db, `chats/${this.currentChatRoom}/signaling`);

      // Create and send offer with audio preferences
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await pc.setLocalDescription(offer);
      await set(signalingRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
          from: this.userId,
          timestamp: serverTimestamp()
        }
      });

      // Handle signaling
      onValue(signalingRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        try {
          if (data.answer && 
              data.answer.from !== this.userId && 
              !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription({
              type: data.answer.type,
              sdp: data.answer.sdp
            }));
          }

          if (data.offer && 
              data.offer.from !== this.userId && 
              !pc.currentLocalDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription({
              type: data.offer.type,
              sdp: data.offer.sdp
            }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await update(signalingRef, {
              answer: {
                type: answer.type,
                sdp: answer.sdp,
                from: this.userId,
                timestamp: serverTimestamp()
              }
            });
          }
        } catch (error) {
          console.error('Error in signaling:', error);
        }
      });

    } catch (error) {
      console.error('Error setting up audio call:', error);
    }
  }

  async handleDisconnect() {
    try {
      // Clean up current connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      if (this.audioElement) {
        this.audioElement.srcObject = null;
        this.audioElement.remove();
        this.audioElement = null;
      }
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Clean up Firebase connections
      await this.cleanup();

      // Automatically find new partner
      console.log('Finding new partner after disconnect...');
      return this.findPartner();
    } catch (error) {
      console.error('Error during disconnect handling:', error);
    }
  }

  private handleConnectionFailure() {
    console.log('Handling connection failure...');
    this.handleDisconnect();
  }

  private setupChatListener(partnerId: string) {
    if (!this.userId) return;
    
    console.log('Setting up chat listener for partner:', partnerId);
    const chatRoomId = [this.userId, partnerId].sort().join('_');
    this.currentChatRoom = chatRoomId;
    const chatRef = ref(this.db, `chats/${chatRoomId}/messages`);
    
    if (this.partnerRef) {
      off(this.partnerRef);
    }
    
    this.partnerRef = chatRef;
    onValue(chatRef, (snapshot) => {
      const messages = snapshot.val();
      if (messages && this.messageCallback) {
        const messageArray = Object.entries(messages).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        this.messageCallback(messageArray);
      }
    });
  }

  async sendMessage(message: string) {
    if (!this.initialized || !this.userId || !this.currentChatRoom) {
      console.log('Cannot send message: Not properly initialized');
      return false;
    }
    
    try {
      console.log('Sending message to chat room:', this.currentChatRoom);
      const chatRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
      await push(chatRef, {
        text: message,
        timestamp: serverTimestamp(),
        senderId: this.userId
      });
      
      console.log('Message sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  setMessageCallback(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  async cleanup() {
    if (!this.initialized || !this.userId) return;
    
    console.log('Cleaning up Firebase connections...');
    try {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      if (this.audioElement) {
        this.audioElement.srcObject = null;
        this.audioElement = null;
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      const updates: any = {};
      updates[`users/${this.userId}/status`] = 'offline';
      updates[`users/${this.userId}/lastSeen`] = serverTimestamp();
      updates[`users/${this.userId}/partner`] = null;
      updates[`onlineUsers/${this.userId}`] = null;

      update(ref(this.db), updates);
      
      if (this.partnerRef) {
        off(this.partnerRef);
        this.partnerRef = null;
      }

      if (this.currentChatRoom) {
        off(ref(this.db, `chats/${this.currentChatRoom}/messages`));
        off(ref(this.db, `chats/${this.currentChatRoom}/signaling`));
        off(ref(this.db, `chats/${this.currentChatRoom}/candidates`));
        this.currentChatRoom = null;
      }
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();
