import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off, serverTimestamp, get, update, Database, DatabaseReference } from 'firebase/database';
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
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userCountCallback: ((count: number) => void) | null = null;

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
      }
    } catch (error: any) {
      console.error('Anonymous authentication error:', error.code, error.message);
      throw error;
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
      
      const availableUsers = [];
      snapshot.forEach((childSnapshot) => {
        const userId = childSnapshot.key;
        if (userId !== this.userId) {
          availableUsers.push(userId);
        }
      });

      if (availableUsers.length > 0) {
        const randomPartner = availableUsers[0]; // Take first available user
        console.log('Found potential partner:', randomPartner);

        const chatRoomId = [this.userId, randomPartner].sort().join('_');
        this.currentChatRoom = chatRoomId;
        
        const updates: any = {};
        updates[`users/${this.userId}/partner`] = randomPartner;
        updates[`users/${randomPartner}/partner`] = this.userId;
        updates[`availableUsers/${this.userId}`] = null;
        updates[`availableUsers/${randomPartner}`] = null;
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
        await set(ref(this.db, `availableUsers/${this.userId}`), {
          timestamp: serverTimestamp(),
          status: 'searching'
        });

        return new Promise((resolve) => {
          const userRef = ref(this.db, `users/${this.userId}/partner`);
          onValue(userRef, async (snapshot) => {
            const partnerId = snapshot.val();
            if (partnerId) {
              console.log('Partner found:', partnerId);
              off(userRef);
              this.setupChatListener(partnerId);
              resolve(partnerId);
            }
          });
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
    
    if (this.currentChatRoom) {
      const audioRef = ref(this.db, `chats/${this.currentChatRoom}/audio`);
      
      // Set up WebRTC connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
      };
      
      const peerConnection = new RTCPeerConnection(configuration);
      
      // Add local stream tracks to peer connection
      localStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        peerConnection.addTrack(track, localStream);
      });

      // Listen for remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        const [remoteStream] = event.streams;
        this.remoteStream = remoteStream;
        
        // Create audio element and play remote stream
        const audioElement = new Audio();
        audioElement.srcObject = remoteStream;
        audioElement.play().catch(error => {
          console.error('Error playing remote audio:', error);
        });
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate);
          update(ref(this.db, `chats/${this.currentChatRoom}/audio/candidates`), {
            [Date.now()]: event.candidate.toJSON()
          });
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      await set(audioRef, {
        offer: { sdp: offer.sdp, type: offer.type },
        timestamp: serverTimestamp()
      });

      // Listen for answer
      onValue(ref(this.db, `chats/${this.currentChatRoom}/audio`), async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.answer && !peerConnection.currentRemoteDescription) {
          console.log('Received answer:', data.answer);
          const answerDescription = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(answerDescription);
        }
      });

      // Listen for ICE candidates
      onValue(ref(this.db, `chats/${this.currentChatRoom}/audio/candidates`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        Object.values(data).forEach((candidate: any) => {
          if (candidate) {
            console.log('Adding ICE candidate:', candidate);
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });
      });
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
      if (this.availableUsersRef) {
        const userRef = ref(this.db, `availableUsers/${this.userId}`);
        set(userRef, null);
      }
      
      const userStatusRef = ref(this.db, `users/${this.userId}`);
      set(userStatusRef, {
        status: 'offline',
        lastSeen: serverTimestamp(),
        partner: null
      });

      const onlineUserRef = ref(this.db, `onlineUsers/${this.userId}`);
      set(onlineUserRef, null);
      
      if (this.partnerRef) {
        off(this.partnerRef);
        this.partnerRef = null;
      }

      if (this.currentChatRoom) {
        const chatRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
        off(chatRef);
        this.currentChatRoom = null;
      }

      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          console.log('Stopping track:', track.kind);
          track.stop();
        });
        this.localStream = null;
      }
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();