import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off } from 'firebase/database';
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
    } catch (error: any) {
      console.error('Anonymous authentication error:', error.code, error.message);
      if (error.code === 'auth/unauthorized-domain') {
        console.log('Please add your domain to Firebase Authentication authorized domains');
      }
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
        timestamp: Date.now(),
        status: 'searching'
      });

      // Listen for partner assignment
      return new Promise((resolve) => {
        onValue(ref(this.db, `users/${this.userId}/partner`), (snapshot) => {
          const partnerId = snapshot.val();
          if (partnerId) {
            console.log('Partner found:', partnerId);
            resolve(partnerId);
          }
        });
      });
    } catch (error) {
      console.error('Error finding partner:', error);
      return null;
    }
  }

  async sendMessage(message: string) {
    if (!this.initialized || !this.userId) {
      console.log('Cannot send message: Firebase not initialized or user not authenticated');
      return false;
    }
    
    try {
      console.log('Sending message:', message);
      const chatRef = ref(this.db, `chats/${this.userId}`);
      await push(chatRef, {
        text: message,
        timestamp: Date.now(),
        senderId: this.userId
      });
      console.log('Message sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  onMessageReceived(callback: (message: { text: string; from: string }) => void) {
    if (!this.initialized || !this.userId) {
      console.log('Cannot receive messages: Firebase not initialized or user not authenticated');
      return;
    }
    
    console.log('Setting up message listener...');
    const chatRef = ref(this.db, `chats/${this.userId}`);
    onValue(chatRef, (snapshot) => {
      const message = snapshot.val();
      if (message) {
        console.log('Message received:', message);
        callback(message);
      }
    });
  }

  cleanup() {
    if (!this.initialized || !this.userId) return;
    
    console.log('Cleaning up Firebase connections...');
    try {
      // Remove user from available users
      const userRef = ref(this.db, `availableUsers/${this.userId}`);
      set(userRef, null);
      
      // Remove all listeners
      off(ref(this.db, `users/${this.userId}/partner`));
      off(ref(this.db, `chats/${this.userId}`));
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();