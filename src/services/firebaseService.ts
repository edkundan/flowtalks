
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, off, serverTimestamp, get, update, Database, DatabaseReference, remove } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { webRTCService } from './webRTCService';
import { toast } from '@/components/ui/use-toast';

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

class FirebaseService {
  private app;
  private db: Database;
  private auth;
  private userId: string | null = null;
  private initialized: boolean = false;
  private messageCallback: ((message: any) => void) | null = null;
  private partnerRef: DatabaseReference | null = null;
  private currentChatRoom: string | null = null;
  private isInCall: boolean = false;
  private isInitiator: boolean = false;
  private currentPartnerId: string | null = null;
  private partnerDisconnectCallback: (() => void) | null = null;
  private userCountCallback: ((count: number) => void) | null = null;
  private useSimulationMode: boolean = false;
  private partnerWatchTimeout: NodeJS.Timeout | null = null;
  private chatListeners: Array<() => void> = [];

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
      this.useSimulationMode = true;
      this.initialized = true;
      this.userId = 'local_' + Math.random().toString(36).substring(2, 15);
    }
  }

  private setupOnlineUsersCounter() {
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
          this.userCountCallback(Math.floor(Math.random() * 50) + 50);
        }
      });
    } catch (error) {
      console.error('Failed to setup online users counter:', error);
      // Fallback to random count
      if (this.userCountCallback) {
        this.userCountCallback(Math.floor(Math.random() * 50) + 50);
      }
      
      // Setup periodic refresh for simulated counts
      setInterval(() => {
        if (this.userCountCallback) {
          this.userCountCallback(Math.floor(Math.random() * 50) + 50);
        }
      }, 60000);
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
      
      // Track connection state
      const connectedRef = ref(this.db, '.info/connected');
      onValue(connectedRef, async (snap) => {
        if (snap.val() === true && this.userId) {
          console.log('Connected to Firebase, setting up online status');
          
          try {
            // Set up presence system
            const userStatusRef = ref(this.db, `users/${this.userId}`);
            const onlineUserRef = ref(this.db, `onlineUsers/${this.userId}`);
            
            // When we disconnect, remove this device
            await set(onlineUserRef, {
              timestamp: serverTimestamp(),
              status: 'online'
            });
            
            // Remove the user from the online list when disconnected
            onValue(connectedRef, (snapshot) => {
              if (snapshot.val() === false) {
                console.log('Disconnected from Firebase');
                // No need to do anything here as onDisconnect will handle it
              }
            });
            
            // Initial setup of user status - IMPORTANT: Reset partner to null
            await set(userStatusRef, {
              status: 'online',
              lastSeen: serverTimestamp(),
              partner: null,
              chatRoom: null
            });
            
          } catch (error) {
            console.error('Failed to set up online status:', error);
            this.useSimulationMode = true;
          }
        } else if (snap.val() === false) {
          console.log('Disconnected from Firebase');
          if (this.userId) {
            this.cleanup(true);
          }
        }
      });
      
    } catch (error: any) {
      console.error('Anonymous authentication error:', error);
      this.useSimulationMode = true;
      this.userId = 'local_' + Math.random().toString(36).substring(2, 15);
      this.initialized = true;
      console.log('Generated local user ID due to auth error:', this.userId);
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
    
    // If in simulation mode, use simulated partner
    if (this.useSimulationMode) {
      return this.findSimulatedPartner();
    }
    
    try {
      console.log('Looking for a real partner via Firebase...');
      
      // CRITICAL: Clean up properly to avoid connecting to previous chats
      await this.cleanup(true);
      
      try {
        // First make sure our user data is clean
        const userRef = ref(this.db, `users/${this.userId}`);
        await set(userRef, {
          status: 'online',
          lastSeen: serverTimestamp(),
          partner: null,
          chatRoom: null
        });
        
        // Check if there are any available users
        const availableUsersRef = ref(this.db, 'availableUsers');
        const snapshot = await get(availableUsersRef);
        
        if (!snapshot.exists() || snapshot.size === 0) {
          console.log('No available users, adding self to pool');
          
          // Get user preferences
          const userCollege = localStorage.getItem('userCollege') || '';
          const userGenderPref = localStorage.getItem('genderPreference') || 'any';
          
          // Add self to available users
          await set(ref(this.db, `availableUsers/${this.userId}`), {
            timestamp: serverTimestamp(),
            status: 'searching',
            college: userCollege,
            genderPref: userGenderPref
          });
          
          // We're not the initiator since we're waiting for a partner
          this.isInitiator = false;
          
          console.log('Added self to available users pool, waiting for partner...');
          
          // Set up a listener to wait for a partner
          return new Promise((resolve) => {
            const partnerRef = ref(this.db, `users/${this.userId}/partner`);
            
            const unsubscribe = onValue(partnerRef, async (snapshot) => {
              if (snapshot.exists()) {
                const partnerId = snapshot.val();
                console.log('Partner found via listener:', partnerId);
                
                // Check if this partner is blocked
                if (this.isUserBlocked(partnerId)) {
                  console.log('This partner is blocked, rejecting');
                  
                  // Reject this partner
                  const updates: any = {};
                  updates[`users/${this.userId}/partner`] = null;
                  updates[`users/${partnerId}/partner`] = null;
                  await update(ref(this.db), updates);
                  return;
                }
                
                // Get the chat room
                const chatRoomSnap = await get(ref(this.db, `users/${this.userId}/chatRoom`));
                if (chatRoomSnap.exists()) {
                  this.currentChatRoom = chatRoomSnap.val();
                } else {
                  this.currentChatRoom = [this.userId, partnerId].sort().join('_');
                }
                
                this.currentPartnerId = partnerId;
                
                // Store the current partner ID for reporting feature
                localStorage.setItem('currentPartnerId', partnerId);
                
                // Clean up listeners
                off(partnerRef);
                
                // Set up chat listener
                this.setupChatListener(partnerId);
                
                // Remove self from available users
                await set(ref(this.db, `availableUsers/${this.userId}`), null);
                
                resolve(partnerId);
              }
            }, (error) => {
              console.error('Error watching for partner:', error);
              off(partnerRef);
              this.useSimulationMode = true;
              resolve(this.findSimulatedPartner());
            });
            
            // Store this listener in our cleanup array
            this.chatListeners.push(() => off(partnerRef));
            
            // Set timeout to abort after 30 seconds
            if (this.partnerWatchTimeout) {
              clearTimeout(this.partnerWatchTimeout);
            }
            
            this.partnerWatchTimeout = setTimeout(() => {
              console.log('Partner finding timed out');
              off(partnerRef);
              resolve(null);
            }, 30000);
          });
        }
        
        // Find a compatible partner
        console.log('Looking through available users...');
        const userCollege = localStorage.getItem('userCollege') || '';
        const userGenderPref = localStorage.getItem('genderPreference') || 'any';
        
        const availableUsers: string[] = [];
        
        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key;
          if (userId && userId !== this.userId && !this.isUserBlocked(userId)) {
            const userData = childSnapshot.val();
            
            // Check college preference if set
            if (userCollege && userData.college && userCollege !== userData.college) {
              return;
            }
            
            // Check gender preference if set
            if (userGenderPref !== 'any' && userData.gender && userGenderPref !== userData.gender) {
              return;
            }
            
            availableUsers.push(userId);
          }
        });
        
        if (availableUsers.length > 0) {
          // Pick a random available user
          const randomIndex = Math.floor(Math.random() * availableUsers.length);
          const partnerId = availableUsers[randomIndex];
          console.log('Found partner from available users:', partnerId);
          
          // Create a clean new chat room
          const chatRoomId = [this.userId, partnerId].sort().join('_') + '_' + Date.now();
          this.currentChatRoom = chatRoomId;
          this.currentPartnerId = partnerId;
          
          // Store the current partner ID for reporting feature
          localStorage.setItem('currentPartnerId', partnerId);
          
          // Update the database - IMPORTANT: Clear existing chat data
          const updates: any = {};
          updates[`availableUsers/${this.userId}`] = null;
          updates[`availableUsers/${partnerId}`] = null;
          updates[`users/${this.userId}/partner`] = partnerId;
          updates[`users/${partnerId}/partner`] = this.userId;
          updates[`users/${this.userId}/chatRoom`] = chatRoomId;
          updates[`users/${partnerId}/chatRoom`] = chatRoomId;
          
          // Add chat room entry with participants and timestamp to make it unique
          updates[`chats/${chatRoomId}/participants`] = {
            [this.userId as string]: true,
            [partnerId]: true
          };
          updates[`chats/${chatRoomId}/created`] = serverTimestamp();
          updates[`chats/${chatRoomId}/messages`] = null; // Start with empty messages
          
          try {
            await update(ref(this.db), updates);
          } catch (error) {
            console.error('Error updating partner information:', error);
            // Continue with the partner even if update fails
          }
          
          // We're the initiator since we found the partner
          this.isInitiator = true;
          
          // Set up chat listener
          this.setupChatListener(partnerId);
          
          return partnerId;
        }
        
        // No partner found, add self to available users
        console.log('No partner found, adding self to available users');
        await set(ref(this.db, `availableUsers/${this.userId}`), {
          timestamp: serverTimestamp(),
          status: 'searching',
          college: userCollege,
          genderPref: userGenderPref
        });
        
        return null;
        
      } catch (error) {
        console.error('Error finding partner via Firebase:', error);
        // Fall back to simulation mode
        this.useSimulationMode = true;
        return this.findSimulatedPartner();
      }
    } catch (error) {
      console.error('Error in findPartner:', error);
      this.useSimulationMode = true;
      return this.findSimulatedPartner();
    }
  }

  private async findSimulatedPartner(): Promise<string | null> {
    console.log('Finding simulated partner...');
    
    // Simulate delay
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
    
    // We're the initiator in simulation mode
    this.isInitiator = true;
    
    // Send a welcome message
    if (this.messageCallback) {
      setTimeout(() => {
        this.messageCallback([{
          id: Date.now().toString(),
          text: "Hi there! I'm connected through a simulated peer. The real connection couldn't be established due to some issues.",
          senderId: randomPartnerId,
          timestamp: Date.now()
        }]);
      }, 1000);
    }
    
    return randomPartnerId;
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

      // If using simulation mode
      if (this.useSimulationMode) {
        console.log('Using simulated audio call');
        
        // After a short delay, show that the call is connected
        setTimeout(() => {
          toast({
            title: "Call Connected",
            description: "Simulated call connection"
          });
        }, 2000);
        
        return;
      }

      // Using real WebRTC with Firebase signaling
      if (!this.currentChatRoom) {
        this.currentChatRoom = [this.userId, this.currentPartnerId].sort().join('_');
      }
      
      try {
        // Clear any existing signaling data
        const signalingRef = ref(this.db, `chats/${this.currentChatRoom}/signaling`);
        await set(signalingRef, null);
        
        // Set up ICE candidate handling
        webRTCService.onIceCandidate((candidate) => {
          if (!this.currentChatRoom || !this.userId) return;
          
          console.log('Sending ICE candidate');
          const candidatesRef = ref(this.db, `chats/${this.currentChatRoom}/candidates/${this.userId}`);
          push(candidatesRef, {
            candidate: candidate.toJSON(),
            timestamp: serverTimestamp()
          });
        });
        
        // Listen for ICE candidates from partner
        const candidatesRef = ref(this.db, `chats/${this.currentChatRoom}/candidates/${this.currentPartnerId}`);
        const candidateListener = onValue(candidatesRef, (snapshot) => {
          if (!snapshot.exists()) return;
          
          snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data && data.candidate) {
              console.log('Received ICE candidate from partner');
              webRTCService.addIceCandidate(data.candidate);
            }
          });
        });
        
        // Add to cleanup array
        this.chatListeners.push(() => off(candidatesRef));
        
        // Only the initiator creates an offer
        if (this.isInitiator) {
          console.log('Creating WebRTC offer as initiator');
          const offer = await webRTCService.createOffer();
          
          if (offer) {
            await set(ref(this.db, `chats/${this.currentChatRoom}/signaling/offer`), {
              type: offer.type,
              sdp: offer.sdp,
              timestamp: serverTimestamp()
            });
            console.log('Offer sent to signaling server');
          }
        }
        
        // Listen for signaling messages
        const signalingListener = onValue(signalingRef, async (snapshot) => {
          const data = snapshot.val();
          if (!data) return;
          
          // Handle offer if we're the callee
          if (data.offer && !this.isInitiator) {
            console.log('Received offer, creating answer');
            const answer = await webRTCService.handleOffer(data.offer);
            
            if (answer) {
              await set(ref(this.db, `chats/${this.currentChatRoom}/signaling/answer`), {
                type: answer.type,
                sdp: answer.sdp,
                timestamp: serverTimestamp()
              });
              console.log('Answer sent to signaling server');
            }
          }
          
          // Handle answer if we're the caller
          if (data.answer && this.isInitiator) {
            console.log('Received answer from partner');
            await webRTCService.handleAnswer(data.answer);
          }
        });
        
        // Add to cleanup array
        this.chatListeners.push(() => off(signalingRef));
      } catch (error) {
        console.error('Error in WebRTC signaling:', error);
        toast({
          variant: "destructive",
          title: "Call Setup Issue",
          description: "There was a problem with the call setup. Audio might not work correctly."
        });
      }
    } catch (error) {
      console.error('Error in setupAudioCall:', error);
      this.isInCall = false;
      toast({
        variant: "destructive",
        title: "Call Setup Failed",
        description: "Unable to establish voice connection. Please check your microphone settings."
      });
    }
  }

  private setupChatListener(partnerId: string) {
    if (!this.userId || !this.currentChatRoom) {
      console.error('Cannot set up chat listener: missing user ID or chat room');
      return;
    }
    
    console.log('Setting up chat listener for room:', this.currentChatRoom);
    
    // If using simulation mode, we don't need a real listener
    if (this.useSimulationMode) {
      return;
    }
    
    try {
      // Clean up any existing listeners
      if (this.partnerRef) {
        off(this.partnerRef);
        this.partnerRef = null;
      }
      
      // Listen for partner disconnection
      const partnerConnectionRef = ref(this.db, `users/${partnerId}/partner`);
      const partnerListener = onValue(partnerConnectionRef, (snapshot) => {
        if (!snapshot.exists() || snapshot.val() !== this.userId) {
          console.log('Partner disconnected or changed');
          this.handlePartnerDisconnect();
        }
      });
      
      // Add to cleanup array
      this.chatListeners.push(() => off(partnerConnectionRef));
      
      // Listen for chat messages
      const chatRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
      this.partnerRef = chatRef;
      
      const messageListener = onValue(chatRef, (snapshot) => {
        const messages = snapshot.val();
        if (messages && this.messageCallback) {
          console.log('Received chat messages:', messages);
          const messageArray = Object.entries(messages).map(([key, value]: [string, any]) => ({
            id: key,
            ...value
          }));
          
          // Sort messages by timestamp
          messageArray.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          
          this.messageCallback(messageArray);
        }
      }, (error) => {
        console.error('Error listening for chat messages:', error);
      });
      
      // Add to cleanup array
      this.chatListeners.push(() => off(chatRef));
    } catch (error) {
      console.error('Error setting up chat listener:', error);
    }
  }

  async sendMessage(message: string) {
    if (!this.initialized || !this.userId) {
      console.log('Cannot send message: Not properly initialized');
      return false;
    }
    
    // If using simulation mode
    if (this.useSimulationMode) {
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
      if (this.currentPartnerId && Math.random() > 0.3) {
        setTimeout(() => {
          if (this.messageCallback) {
            const responses = [
              "I see!",
              "That's interesting.",
              "Tell me more.",
              "I agree with you.",
              "What else would you like to chat about?",
              "How's your day going?",
              "This is just a simulated response because we're having some connection issues.",
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
    }
    
    // Using real Firebase
    try {
      if (!this.currentChatRoom) {
        console.error('No chat room available for sending message');
        return false;
      }
      
      console.log('Sending message to chat room:', this.currentChatRoom);
      const messagesRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
      
      await push(messagesRef, {
        text: message,
        senderId: this.userId,
        timestamp: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fall back to simulation mode if Firebase fails
      this.useSimulationMode = true;
      
      // Add message locally
      if (this.messageCallback) {
        this.messageCallback([{
          id: Date.now().toString(),
          text: message,
          senderId: this.userId || 'local',
          timestamp: Date.now()
        }]);
      }
      
      return true;
    }
  }

  setMessageCallback(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  async cleanup(fullCleanup: boolean = true) {
    console.log('Cleaning up resources...');
    
    if (fullCleanup && this.isInCall) {
      webRTCService.endCall();
      this.isInCall = false;
    }
    
    // Clear partner watch timeout
    if (this.partnerWatchTimeout) {
      clearTimeout(this.partnerWatchTimeout);
      this.partnerWatchTimeout = null;
    }
    
    // Clean up all listeners
    this.chatListeners.forEach(unsubscribe => unsubscribe());
    this.chatListeners = [];
    
    // If using simulation mode, just clear local state
    if (this.useSimulationMode) {
      if (fullCleanup) {
        this.currentPartnerId = null;
        localStorage.removeItem('currentPartnerId');
        this.currentChatRoom = null;
      }
      return;
    }
    
    // Using real Firebase
    if (!this.initialized || !this.userId) return;
    
    try {
      // Basic updates
      const updates: any = {};
      
      // If full cleanup, clean up partner connections
      if (fullCleanup && this.currentPartnerId) {
        try {
          updates[`users/${this.userId}/partner`] = null;
          updates[`users/${this.userId}/chatRoom`] = null;
          
          // Try to update partner's status too if we know who they are
          updates[`users/${this.currentPartnerId}/partner`] = null;
        } catch (error) {
          console.error('Error updating partner status during cleanup:', error);
        }
      }
      
      // Remove from available users
      updates[`availableUsers/${this.userId}`] = null;
      
      if (Object.keys(updates).length > 0) {
        try {
          await update(ref(this.db), updates);
        } catch (error) {
          console.error('Error updating Firebase during cleanup:', error);
        }
      }
      
      // Clean up listeners
      if (fullCleanup) {
        if (this.partnerRef) {
          off(this.partnerRef);
          this.partnerRef = null;
        }
        
        if (this.currentChatRoom) {
          try {
            // Clean up WebRTC signaling listeners
            off(ref(this.db, `chats/${this.currentChatRoom}/signaling`));
            off(ref(this.db, `chats/${this.currentChatRoom}/candidates`));
          } catch (error) {
            console.error('Error removing signaling listeners:', error);
          }
        }
        
        this.currentPartnerId = null;
        localStorage.removeItem('currentPartnerId');
        this.currentChatRoom = null;
      }
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();
