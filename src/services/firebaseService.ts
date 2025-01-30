import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off, serverTimestamp, get, update, Unsubscribe } from 'firebase/database';
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
  private db;
  private auth;
  private userId: string | null = null;
  private initialized: boolean = false;
  private messageCallback: ((message: any) => void) | null = null;
  private partnerRef: any = null;
  private availableUsersRef: any = null;
  private connectionRef: Unsubscribe | null = null;
  private currentChatRoom: string | null = null;

  constructor() {
    try {
      console.log('Initializing Firebase...');
      this.app = initializeApp(firebaseConfig);
      this.db = getDatabase(this.app);
      this.auth = getAuth(this.app);
      this.initializeAuth();
    } catch (error) {
      console.error('Firebase initialization error:', error);
    }
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
        const connectedRef = ref(this.db, '.info/connected');
        
        const unsubscribe = onValue(connectedRef, async (snap) => {
          if (snap.val() === true && this.userId) {
            console.log('Connected to Firebase Realtime Database');
            
            await set(userStatusRef, {
              status: 'online',
              lastSeen: serverTimestamp(),
              partner: null
            });
            
            // Store the unsubscribe function
            this.connectionRef = unsubscribe;
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
        const randomPartner = availableUsers[Math.floor(Math.random() * availableUsers.length)];
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
          const partnerListener = onValue(userRef, async (snapshot) => {
            const partnerId = snapshot.val();
            if (partnerId) {
              console.log('Partner found:', partnerId);
              off(userRef, partnerListener);
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
      
      if (this.partnerRef) {
        off(this.partnerRef);
        this.partnerRef = null;
      }
      
      if (this.connectionRef) {
        off(this.connectionRef);
        this.connectionRef = null;
      }

      if (this.currentChatRoom) {
        const chatRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
        off(chatRef);
        this.currentChatRoom = null;
      }
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();
