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

        // Handle disconnection
        const connectedRef = ref(this.db, '.info/connected');
        onValue(connectedRef, (snap) => {
          if (snap.val() === false && this.userId) {
            this.cleanup();
          }
        });

        // Monitor partner changes
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
      const availableUsersRef = ref(this.db, 'availableUsers');
      const snapshot = await get(availableUsersRef);
      
      // Filter out users who already have partners and our own ID
      const availableUsers: string[] = [];
      const userPromises: Promise<any>[] = [];

      snapshot.forEach((childSnapshot) => {
        const userId = childSnapshot.key;
        if (userId && userId !== this.userId) {
          // Check if this user already has a partner
          const userPromise = get(ref(this.db, `users/${userId}/partner`))
            .then(partnerSnap => {
              if (!partnerSnap.exists()) {
                availableUsers.push(userId);
              }
            });
          userPromises.push(userPromise);
        }
      });

      // Wait for all user checks to complete
      await Promise.all(userPromises);

      if (availableUsers.length > 0) {
        // Randomly select a partner from available users
        const randomIndex = Math.floor(Math.random() * availableUsers.length);
        const randomPartner = availableUsers[randomIndex];
        console.log('Found potential partner:', randomPartner);

        const chatRoomId = [this.userId, randomPartner].sort().join('_');
        this.currentChatRoom = chatRoomId;

        // Atomic update to set partnership
        const updates: any = {};
        updates[`availableUsers/${this.userId}`] = null;
        updates[`availableUsers/${randomPartner}`] = null;
        updates[`users/${this.userId}/partner`] = randomPartner;
        updates[`users/${randomPartner}/partner`] = this.userId;
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
      } else {
        console.log('No available partners, adding self to pool');
        const userRef = ref(this.db, `availableUsers/${this.userId}`);
        await set(userRef, {
          timestamp: serverTimestamp(),
          status: 'searching'
        });

        // Wait for partner assignment
        return new Promise((resolve) => {
          const partnerRef = ref(this.db, `users/${this.userId}/partner`);
          const unsubscribe = onValue(partnerRef, (snapshot) => {
            const partnerId = snapshot.val();
            if (partnerId) {
              console.log('Partner found:', partnerId);
              off(partnerRef);
              this.setupChatListener(partnerId);
              resolve(partnerId);
            }
          });

          // Cleanup listener after 30 seconds if no partner found
          setTimeout(() => {
            off(partnerRef);
            resolve(null);
          }, 30000);
        });
      }
    } catch (error) {
      console.error('Error finding partner:', error);
      return null;
    }
  }

  async setupAudioCall(localStream: MediaStream) {
    console.log('Setting up audio call with stream:', localStream.id);
    this.localStream = localStream;
    
    if (!this.currentChatRoom) {
      console.error('No chat room available for audio call');
      return;
    }

    try {
      // Close any existing peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ]
      };

      this.peerConnection = new RTCPeerConnection(configuration);
      const pc = this.peerConnection;

      // Add local stream tracks to peer connection
      localStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        if (this.localStream) {
          pc.addTrack(track, this.localStream);
        }
      });

      // Handle incoming remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        [this.remoteStream] = event.streams;
        
        if (this.audioElement) {
          this.audioElement.srcObject = null;
        }
        
        this.audioElement = new Audio();
        this.audioElement.srcObject = this.remoteStream;
        this.audioElement.play().catch(error => {
          console.error('Error playing remote audio:', error);
        });
      };

      // Set up signaling
      const signalingRef = ref(this.db, `chats/${this.currentChatRoom}/signaling`);
      
      // Handle and send ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate.type);
          push(ref(this.db, `chats/${this.currentChatRoom}/candidates`), {
            ...event.candidate.toJSON(),
            processed: false
          });
        }
      };

      // Listen for remote ICE candidates
      onValue(ref(this.db, `chats/${this.currentChatRoom}/candidates`), (snapshot) => {
        snapshot.forEach((childSnapshot) => {
          const candidate = childSnapshot.val();
          if (candidate && !candidate.processed && pc.remoteDescription) {
            console.log('Processing ICE candidate');
            pc.addIceCandidate(new RTCIceCandidate(candidate))
              .then(() => {
                update(childSnapshot.ref, { processed: true });
              })
              .catch(console.error);
          }
        });
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await set(signalingRef, { 
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      // Listen for answer
      onValue(signalingRef, async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        try {
          if (data.answer && !pc.currentRemoteDescription) {
            console.log('Setting remote description from answer');
            const answerDescription = new RTCSessionDescription(data.answer);
            await pc.setRemoteDescription(answerDescription);
          }

          if (data.offer && !pc.currentLocalDescription) {
            console.log('Received offer, creating answer');
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await update(signalingRef, { 
              answer: {
                type: answer.type,
                sdp: answer.sdp
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

  cleanup() {
    if (!this.initialized || !this.userId) return;
    
    console.log('Cleaning up Firebase connections...');
    try {
      // Clean up WebRTC
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      if (this.audioElement) {
        this.audioElement.srcObject = null;
        this.audioElement = null;
      }

      // Clean up streams
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Clean up Firebase references
      if (this.availableUsersRef) {
        remove(ref(this.db, `availableUsers/${this.userId}`));
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
