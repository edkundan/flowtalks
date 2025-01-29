import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off, serverTimestamp } from 'firebase/database';
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

  private async initializeAuth() {
    try {
      console.log('Attempting anonymous sign in...');
      const userCredential = await signInAnonymously(this.auth);
      this.userId = userCredential.user.uid;
      this.initialized = true;
      console.log('Successfully signed in anonymously:', this.userId);
      
      // Set online status
      const userStatusRef = ref(this.db, `users/${this.userId}/status`);
      await set(userStatusRef, 'online');
      
      // Set offline status on disconnect
      const connectedRef = ref(this.db, '.info/connected');
      onValue(connectedRef, (snap) => {
        if (snap.val() === true && this.userId) {
          const userStatusRef = ref(this.db, `users/${this.userId}/status`);
          set(userStatusRef, 'offline');
        }
      });
      
    } catch (error: any) {
      console.error('Anonymous authentication error:', error.code, error.message);
    }
  }

  async findPartner() {
    if (!this.initialized || !this.userId) {
      console.log('Firebase not initialized or user not authenticated');
      return null;
    }
    
    try {
      console.log('Finding partner...');
      const availableUsersRef = ref(this.db, 'availableUsers');
      const userRef = ref(this.db, `availableUsers/${this.userId}`);
      
      // Add self to available users
      await set(userRef, {
        timestamp: serverTimestamp(),
        status: 'searching'
      });

      // Listen for partner assignment
      return new Promise((resolve) => {
        const partnerListener = onValue(ref(this.db, `users/${this.userId}/partner`), (snapshot) => {
          const partnerId = snapshot.val();
          if (partnerId) {
            console.log('Partner found:', partnerId);
            this.setupChatListener(partnerId);
            resolve(partnerId);
          }
        });
      });
    } catch (error) {
      console.error('Error finding partner:', error);
      return null;
    }
  }

  private setupChatListener(partnerId: string) {
    if (!this.userId) return;
    
    console.log('Setting up chat listener for partner:', partnerId);
    const chatRef = ref(this.db, `chats/${partnerId}_${this.userId}`);
    
    // Remove any existing listener
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
    if (!this.initialized || !this.userId) {
      console.log('Cannot send message: Firebase not initialized or user not authenticated');
      return false;
    }
    
    try {
      const partnerRef = ref(this.db, `users/${this.userId}/partner`);
      const partnerSnapshot = await get(partnerRef);
      const partnerId = partnerSnapshot.val();
      
      if (!partnerId) {
        console.log('No partner found to send message to');
        return false;
      }

      console.log('Sending message to partner:', partnerId);
      const chatRef = ref(this.db, `chats/${this.userId}_${partnerId}`);
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
      // Remove user from available users
      const userRef = ref(this.db, `availableUsers/${this.userId}`);
      set(userRef, null);
      
      // Set status to offline
      const userStatusRef = ref(this.db, `users/${this.userId}/status`);
      set(userStatusRef, 'offline');
      
      // Remove partner assignment
      const partnerRef = ref(this.db, `users/${this.userId}/partner`);
      set(partnerRef, null);
      
      // Remove chat listeners
      if (this.partnerRef) {
        off(this.partnerRef);
        this.partnerRef = null;
      }
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();