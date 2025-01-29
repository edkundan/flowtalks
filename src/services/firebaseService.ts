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

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.db = getDatabase(this.app);
    this.auth = getAuth(this.app);
    
    // Sign in anonymously
    signInAnonymously(this.auth).then((userCredential) => {
      this.userId = userCredential.user.uid;
      console.log('Signed in anonymously:', this.userId);
    }).catch((error) => {
      console.error('Error signing in:', error);
    });
  }

  async findPartner() {
    if (!this.userId) return;
    
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
          resolve(partnerId);
        }
      });
    });
  }

  async sendMessage(message: string) {
    if (!this.userId) return false;
    
    try {
      const chatRef = ref(this.db, `chats/${this.userId}`);
      await push(chatRef, {
        text: message,
        timestamp: Date.now(),
        senderId: this.userId
      });
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  onMessageReceived(callback: (message: { text: string; from: string }) => void) {
    if (!this.userId) return;
    
    const chatRef = ref(this.db, `chats/${this.userId}`);
    onValue(chatRef, (snapshot) => {
      const message = snapshot.val();
      if (message) {
        callback(message);
      }
    });
  }

  cleanup() {
    if (!this.userId) return;
    
    // Remove user from available users
    const userRef = ref(this.db, `availableUsers/${this.userId}`);
    set(userRef, null);
    
    // Remove all listeners
    off(ref(this.db, `users/${this.userId}/partner`));
    off(ref(this.db, `chats/${this.userId}`));
  }
}

export const firebaseService = new FirebaseService();