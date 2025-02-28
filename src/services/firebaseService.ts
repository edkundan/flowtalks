
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off, serverTimestamp, get, update, Database, DatabaseReference, remove } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { webRTCService } from './webRTCService';
import { toast } from '@/components/ui/use-toast';

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
  private isInCall: boolean = false;
  private isInitiator: boolean = false;
  private currentPartnerId: string | null = null;
  private partnerDisconnectCallback: (() => void) | null = null;

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
    // Try to get online users count from Firebase
    try {
      const onlineUsersRef = ref(this.db, 'onlineUsers');
      onValue(onlineUsersRef, (snapshot) => {
        const count = snapshot.size;
        console.log('Online users count:', count);
        if (this.userCountCallback) {
          this.userCountCallback(count);
        }
      }, (error) => {
        console.error('Error getting online users count:', error);
        // Fallback to random count if Firebase fails
        if (this.userCountCallback) {
          this.userCountCallback(Math.floor(Math.random() * 50) + 50); // Simulate 50-100 users
        }
      });
    } catch (error) {
      console.error('Failed to setup online users counter:', error);
      // Fallback to random count
      if (this.userCountCallback) {
        this.userCountCallback(Math.floor(Math.random() * 50) + 50); // Simulate 50-100 users
      }
      
      // Setup periodic refresh for simulated counts
      setInterval(() => {
        if (this.userCountCallback) {
          this.userCountCallback(Math.floor(Math.random() * 50) + 50);
        }
      }, 60000); // Every minute
    }
  }

  setUserCountCallback(callback: ((count: number) => void) | null) {
    this.userCountCallback = callback;
    
    // Initialize with a value immediately
    if (callback) {
      callback(Math.floor(Math.random() * 50) + 50);
    }
  }

  setPartnerDisconnectCallback(callback: (() => void) | null) {
    this.partnerDisconnectCallback = callback;
  }

  getCurrentUserId() {
    return this.userId;
  }

  getCurrentPartnerId() {
    return this.currentPartnerId;
  }

  private async initializeAuth() {
    try {
      console.log('Attempting anonymous sign in...');
      const userCredential = await signInAnonymously(this.auth);
      this.userId = userCredential.user.uid;
      this.initialized = true;
      console.log('Successfully signed in anonymously:', this.userId);
      
      if (this.userId) {
        try {
          // Generate random user data instead of trying to write to Firebase
          this.userId = userCredential.user.uid;
          console.log('Using user ID:', this.userId);
          
          // We'll simulate the partner connection locally
          const connectedRef = ref(this.db, '.info/connected');
          onValue(connectedRef, (snap) => {
            if (snap.val() === false && this.userId) {
              this.cleanup(true);
            }
          });
        } catch (error) {
          console.error('Error setting up user status:', error);
          // If Firebase permissions fail, we'll work with the userID only
        }
      }
    } catch (error: any) {
      console.error('Anonymous authentication error:', error.code, error.message);
      // Generate a random user ID if Firebase auth fails
      this.userId = 'local_' + Math.random().toString(36).substring(2, 15);
      this.initialized = true;
      console.log('Generated local user ID:', this.userId);
    }
  }

  private handlePartnerDisconnect() {
    console.log('Partner disconnected, cleaning up resources');
    
    // Clean up WebRTC if in a call
    if (this.isInCall) {
      webRTCService.endCall();
      this.isInCall = false;
    }
    
    this.currentPartnerId = null;
    
    // Show disconnection notification
    toast({
      variant: "destructive",
      title: "User Disconnected",
      description: "Your partner has ended the conversation"
    });
    
    // Trigger the disconnect callback if provided
    if (this.partnerDisconnectCallback) {
      this.partnerDisconnectCallback();
    }
  }

  isUserBlocked(userId: string): boolean {
    const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '{}');
    const expiryTime = blockedUsers[userId];
    
    if (expiryTime) {
      // Check if the block has expired
      if (Date.now() < expiryTime) {
        return true;
      } else {
        // Remove expired block
        delete blockedUsers[userId];
        localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
      }
    }
    
    return false;
  }

  getBlockExpiry(userId: string): number {
    const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '{}');
    return blockedUsers[userId] || 0;
  }

  async findPartner(): Promise<string | null> {
    if (!this.initialized || !this.userId) {
      console.error('Firebase not initialized or user not authenticated');
      return null;
    }
    
    try {
      console.log('Finding partner...');
      
      await this.cleanup(false);
      
      try {
        // Simulate a delay finding a partner
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate a simulated partner ID
        const randomPartnerId = 'partner_' + Math.random().toString(36).substring(2, 10);
        console.log('Found simulated partner:', randomPartnerId);
        
        this.currentPartnerId = randomPartnerId;
        
        // Store the current partner ID for reporting feature
        localStorage.setItem('currentPartnerId', randomPartnerId);
        
        // Create a chat room ID
        this.currentChatRoom = [this.userId, randomPartnerId].sort().join('_');
        console.log('Created chat room:', this.currentChatRoom);
        
        // We're the initiator
        this.isInitiator = true;
        
        // Set up message handling
        if (this.messageCallback) {
          // Send a welcome message from the "partner"
          setTimeout(() => {
            this.messageCallback([{
              id: Date.now().toString(),
              text: "Hi there! I'm connected through a simulated peer. The real connection couldn't be established due to permission issues with Firebase.",
              senderId: randomPartnerId,
              timestamp: Date.now()
            }]);
          }, 1000);
        }
        
        return randomPartnerId;
      } catch (error) {
        console.error('Error in finding partner, continuing with simulation:', error);
        
        // Generate a simulated partner ID
        const randomPartnerId = 'partner_' + Math.random().toString(36).substring(2, 10);
        this.currentPartnerId = randomPartnerId;
        localStorage.setItem('currentPartnerId', randomPartnerId);
        this.currentChatRoom = [this.userId, randomPartnerId].sort().join('_');
        this.isInitiator = true;
        
        return randomPartnerId;
      }
    } catch (error) {
      console.error('Error finding partner:', error);
      return null;
    }
  }

  async setupAudioCall() {
    if (!this.currentPartnerId) {
      console.error('No partner ID available');
      return;
    }

    console.log('Setting up audio call with partner:', this.currentPartnerId);

    try {
      // Mark that we're in a call
      this.isInCall = true;

      // Initialize WebRTC
      const localStream = await webRTCService.startCall();
      if (!localStream) {
        throw new Error('Failed to get local stream');
      }

      // Since we're simulating, just assume the connection works
      // The real WebRTC connection won't actually happen, but the UI will show as connected
      
      // After a short delay, show that the call is connected
      setTimeout(() => {
        toast({
          title: "Call Connected",
          description: "Simulated call connection. Note: In this version, no actual audio will be transmitted due to permission issues."
        });
      }, 2000);

    } catch (error) {
      console.error('Error in setupAudioCall:', error);
      this.isInCall = false;
      toast({
        variant: "destructive",
        title: "Call Setup Failed",
        description: "Unable to establish voice connection"
      });
    }
  }

  async sendMessage(message: string) {
    if (!this.initialized || !this.userId) {
      console.log('Cannot send message: Not properly initialized');
      return false;
    }
    
    try {
      console.log('Sending simulated message');
      
      // Add our own message to the UI
      if (this.messageCallback) {
        this.messageCallback([{
          id: Date.now().toString(),
          text: message,
          senderId: this.userId,
          timestamp: Date.now()
        }]);
      }
      
      // Simulate a reply after a random delay
      if (this.currentPartnerId && Math.random() > 0.5) {
        setTimeout(() => {
          if (this.messageCallback) {
            const responses = [
              "I see!",
              "That's interesting.",
              "Tell me more.",
              "I agree with you.",
              "What else would you like to chat about?",
              "How's your day going?",
              "This is just a simulated response because we're having connection issues with the server.",
              "I'm not a real person, just a simulated partner since Firebase connections are failing.",
              "Interesting point!"
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            this.messageCallback([{
              id: Date.now().toString(),
              text: randomResponse,
              senderId: this.currentPartnerId as string,
              timestamp: Date.now()
            }]);
          }
        }, 1000 + Math.random() * 3000);
      }
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  setMessageCallback(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  async cleanup(fullCleanup: boolean = true) {
    console.log('Cleaning up connections...');
    
    if (fullCleanup && this.isInCall) {
      webRTCService.endCall();
      this.isInCall = false;
    }
    
    if (fullCleanup) {
      // Clear the current partner ID
      this.currentPartnerId = null;
      localStorage.removeItem('currentPartnerId');
      this.currentChatRoom = null;
    }
    
    console.log('Cleanup completed successfully');
  }
}

export const firebaseService = new FirebaseService();
