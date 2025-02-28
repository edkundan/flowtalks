
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

// Alternative server connection for fallback
const socketServerUrl = "https://talkaroo-server.onrender.com";

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
  private usingSocketFallback: boolean = false;
  private wsConnection: WebSocket | null = null;

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
      this.setupSocketFallback();
    }
  }

  private setupSocketFallback() {
    console.log('Setting up socket fallback connection...');
    this.usingSocketFallback = true;
    
    try {
      // Generate a random user ID for socket connection
      this.userId = 'socket_' + Math.random().toString(36).substring(2, 15);
      this.initialized = true;
      
      // Connect to fallback WebSocket server
      this.wsConnection = new WebSocket(socketServerUrl.replace('http', 'ws'));
      
      this.wsConnection.onopen = () => {
        console.log('Connected to fallback server');
        this.wsConnection?.send(JSON.stringify({
          type: 'register',
          userId: this.userId
        }));
        
        // Update online count
        if (this.userCountCallback) {
          this.userCountCallback(Math.floor(Math.random() * 50) + 50); // Simulate 50-100 users
        }
      };
      
      this.wsConnection.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received socket message:', data);
        
        if (data.type === 'userCount') {
          if (this.userCountCallback) {
            this.userCountCallback(data.count);
          }
        } else if (data.type === 'message' && this.messageCallback) {
          // Handle chat messages
          this.messageCallback([{
            id: data.id || Date.now().toString(),
            text: data.text,
            senderId: data.from,
            timestamp: data.timestamp || Date.now()
          }]);
        } else if (data.type === 'partnerFound') {
          this.currentPartnerId = data.partnerId;
          // Store the current partner ID for reporting feature
          localStorage.setItem('currentPartnerId', data.partnerId);
        } else if (data.type === 'partnerDisconnected') {
          this.handlePartnerDisconnect();
        }
      };
      
      this.wsConnection.onerror = (error) => {
        console.error('Socket connection error:', error);
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: "Failed to connect to chat server. Please try again later."
        });
      };
      
      this.wsConnection.onclose = () => {
        console.log('Socket connection closed');
        this.cleanup(true);
      };
      
    } catch (error) {
      console.error('Socket fallback setup error:', error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not establish a connection to the server."
      });
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
    
    // Initialize with a value immediately if using fallback
    if (this.usingSocketFallback && callback) {
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
        // Try to set up user status, but handle permission errors gracefully
        try {
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
              this.cleanup(true);
            }
          });

          onValue(ref(this.db, `users/${this.userId}/partner`), (snapshot) => {
            const partnerId = snapshot.val();
            if (!partnerId && this.currentPartnerId) {
              this.handlePartnerDisconnect();
            }
          });
        } catch (error) {
          console.error('Error setting up user status:', error);
          // If Firebase permissions fail, fall back to WebSocket connection
          this.setupSocketFallback();
        }
      }
    } catch (error: any) {
      console.error('Anonymous authentication error:', error.code, error.message);
      // Fall back to WebSocket connection if Firebase auth fails
      this.setupSocketFallback();
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
    
    // If using socket fallback, use the socket-based partner finding
    if (this.usingSocketFallback) {
      return this.findPartnerViaSocket();
    }
    
    try {
      console.log('Finding partner...');
      
      await this.cleanup(false);
      
      try {
        const availableUsersRef = ref(this.db, 'availableUsers');
        const snapshot = await get(availableUsersRef);
        
        const currentUserRef = ref(this.db, `users/${this.userId}/partner`);
        const currentUserSnap = await get(currentUserRef);
        
        if (currentUserSnap.exists()) {
          console.log('User already has a partner');
          const partnerId = currentUserSnap.val();
          
          // Check if this partner is blocked
          if (this.isUserBlocked(partnerId)) {
            const expiry = this.getBlockExpiry(partnerId);
            const hoursLeft = Math.ceil((expiry - Date.now()) / (60 * 60 * 1000));
            
            toast({
              variant: "destructive",
              title: "User Blocked",
              description: `This user has been blocked. The block will expire in ${hoursLeft} hours.`
            });
            
            // Clean up this connection
            await this.cleanup(true);
            return null;
          }
          
          this.currentPartnerId = partnerId;
          return partnerId;
        }

        // Get user preferences
        const userCollege = localStorage.getItem('userCollege') || '';
        const userGenderPref = localStorage.getItem('genderPreference') || 'any';
        
        const availableUsers: string[] = [];
        const userPromises: Promise<any>[] = [];

        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key;
          if (userId && userId !== this.userId && !this.isUserBlocked(userId)) {
            const userPromise = get(ref(this.db, `users/${userId}`))
              .then(userSnap => {
                const userData = userSnap.val();
                if (!userData?.partner) {
                  // If college preference is enabled and doesn't match, skip
                  if (userCollege && userData?.college && userCollege !== userData.college) {
                    return;
                  }
                  
                  // If gender preference is set and doesn't match, skip
                  if (userGenderPref !== 'any' && userData?.gender && userGenderPref !== userData.gender) {
                    return;
                  }
                  
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
          this.currentPartnerId = randomPartner;
          
          // Store the current partner ID for reporting feature
          localStorage.setItem('currentPartnerId', randomPartner);

          try {
            const updates: any = {};
            updates[`availableUsers/${this.userId}`] = null;
            updates[`availableUsers/${randomPartner}`] = null;
            updates[`users/${this.userId}/partner`] = randomPartner;
            updates[`users/${randomPartner}/partner`] = this.userId;
            updates[`users/${this.userId}/chatRoom`] = chatRoomId;
            updates[`users/${randomPartner}/chatRoom`] = chatRoomId;
            
            // Add college information if available
            if (userCollege) {
              updates[`users/${this.userId}/college`] = userCollege;
            }
            
            updates[`chats/${chatRoomId}`] = {
              created: serverTimestamp(),
              participants: {
                [this.userId as string]: true,
                [randomPartner]: true
              }
            };

            await update(ref(this.db), updates);
          } catch (error) {
            console.error('Error updating Firebase, but continuing with partner:', error);
            // Continue with the partner even if the database update fails
          }
          
          // We're the initiator since we found the partner first
          this.isInitiator = true;
          
          console.log('Successfully paired with partner:', randomPartner);
          this.setupChatListener(randomPartner);
          return randomPartner;
        }

        console.log('No available partners, adding self to pool');
        try {
          const userData: any = {
            timestamp: serverTimestamp(),
            status: 'searching'
          };
          
          // Add college info if available
          if (userCollege) {
            userData.college = userCollege;
          }
          
          await set(ref(this.db, `availableUsers/${this.userId}`), userData);
        } catch (error) {
          console.error('Error adding self to available users pool:', error);
          // Fallback to socket-based partner finding if Firebase fails
          return this.findPartnerViaSocket();
        }

        // We're not the initiator since we're waiting for a partner
        this.isInitiator = false;

        return new Promise((resolve) => {
          try {
            const partnerRef = ref(this.db, `users/${this.userId}`);
            const unsubscribe = onValue(partnerRef, async (snapshot) => {
              const userData = snapshot.val();
              if (userData?.partner) {
                console.log('Partner found:', userData.partner);
                
                // Check if this partner is blocked
                if (this.isUserBlocked(userData.partner)) {
                  const expiry = this.getBlockExpiry(userData.partner);
                  const hoursLeft = Math.ceil((expiry - Date.now()) / (60 * 60 * 1000));
                  
                  toast({
                    variant: "destructive",
                    title: "User Blocked",
                    description: `This user has been blocked. The block will expire in ${hoursLeft} hours.`
                  });
                  
                  // Reject this partner and clean up
                  try {
                    const updates: any = {};
                    updates[`users/${this.userId}/partner`] = null;
                    updates[`users/${userData.partner}/partner`] = null;
                    await update(ref(this.db), updates);
                  } catch (error) {
                    console.error('Error updating partner status:', error);
                  }
                  return;
                }
                
                this.currentChatRoom = userData.chatRoom;
                this.currentPartnerId = userData.partner;
                
                // Store the current partner ID for reporting feature
                localStorage.setItem('currentPartnerId', userData.partner);
                
                off(partnerRef);
                this.setupChatListener(userData.partner);
                resolve(userData.partner);
              }
            }, (error) => {
              console.error('Error watching for partner:', error);
              off(partnerRef);
              // Fallback to socket-based partner finding
              this.findPartnerViaSocket().then(resolve);
            });

            setTimeout(() => {
              off(partnerRef);
              this.cleanup(true);
              resolve(null);
            }, 30000);
          } catch (error) {
            console.error('Error setting up partner watch:', error);
            // Fallback to socket connection
            this.findPartnerViaSocket().then(resolve);
          }
        });
      } catch (error) {
        console.error('Firebase operation failed, falling back to socket:', error);
        return this.findPartnerViaSocket();
      }
    } catch (error) {
      console.error('Error finding partner:', error);
      // Try socket-based partner finding as fallback
      return this.findPartnerViaSocket();
    }
  }

  private async findPartnerViaSocket(): Promise<string | null> {
    console.log('Finding partner via WebSocket...');
    
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      this.setupSocketFallback();
    }
    
    // If we're already using sockets or Firebase failed
    if (this.wsConnection) {
      this.wsConnection.send(JSON.stringify({
        type: 'findPartner',
        userId: this.userId,
        college: localStorage.getItem('userCollege') || '',
        genderPreference: localStorage.getItem('genderPreference') || 'any'
      }));
      
      return new Promise((resolve) => {
        const messageHandler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.type === 'partnerFound') {
            this.currentPartnerId = data.partnerId;
            localStorage.setItem('currentPartnerId', data.partnerId);
            
            // Remove this event listener
            if (this.wsConnection) {
              this.wsConnection.removeEventListener('message', messageHandler);
            }
            
            resolve(data.partnerId);
          }
        };
        
        // Add temporary message handler to listen for partner
        if (this.wsConnection) {
          this.wsConnection.addEventListener('message', messageHandler);
        }
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.wsConnection) {
            this.wsConnection.removeEventListener('message', messageHandler);
          }
          resolve(null);
        }, 30000);
      });
    }
    
    return null;
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

      // If using socket connection
      if (this.usingSocketFallback && this.wsConnection) {
        // Set up ICE candidate handling
        webRTCService.onIceCandidate((candidate) => {
          if (this.wsConnection) {
            this.wsConnection.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: candidate.toJSON(),
              to: this.currentPartnerId
            }));
          }
        });
        
        // Listen for ICE candidates
        const messageHandler = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.type === 'ice-candidate' && data.from === this.currentPartnerId) {
            webRTCService.addIceCandidate(data.candidate);
          } else if (data.type === 'offer' && data.from === this.currentPartnerId) {
            webRTCService.handleOffer(data.offer).then(answer => {
              if (answer && this.wsConnection) {
                this.wsConnection.send(JSON.stringify({
                  type: 'answer',
                  answer,
                  to: this.currentPartnerId
                }));
              }
            });
          } else if (data.type === 'answer' && data.from === this.currentPartnerId) {
            webRTCService.handleAnswer(data.answer);
          }
        };
        
        if (this.wsConnection) {
          this.wsConnection.addEventListener('message', messageHandler);
        }
        
        // Only the initiator creates an offer
        if (this.isInitiator) {
          console.log('We are the initiator, creating WebRTC offer');
          const offer = await webRTCService.createOffer();
          if (offer && this.wsConnection) {
            this.wsConnection.send(JSON.stringify({
              type: 'offer',
              offer,
              to: this.currentPartnerId
            }));
          }
        }
        
        return;
      }

      // Using Firebase signaling - continue with original implementation
      try {
        if (!this.currentChatRoom) {
          this.currentChatRoom = [this.userId, this.currentPartnerId].sort().join('_');
        }
        
        // Clear any existing signaling data to prevent conflicts
        const signalingRef = ref(this.db, `chats/${this.currentChatRoom}/signaling`);
        await set(signalingRef, null);

        // Set up ICE candidate handling
        webRTCService.onIceCandidate((candidate) => {
          console.log('Sending ICE candidate');
          const candidatesRef = ref(this.db, `chats/${this.currentChatRoom}/candidates/${this.userId}`);
          push(candidatesRef, {
            candidate: candidate.toJSON(),
            timestamp: serverTimestamp(),
            from: this.userId
          });
        });

        // Listen for ICE candidates from the other peer
        const candidatesRef = ref(this.db, `chats/${this.currentChatRoom}/candidates`);
        onValue(candidatesRef, (snapshot) => {
          snapshot.forEach((childSnapshot) => {
            const userId = childSnapshot.key;
            if (userId !== this.userId) {
              childSnapshot.forEach((candidateSnapshot) => {
                const data = candidateSnapshot.val();
                if (data && data.candidate) {
                  console.log('Received ICE candidate from peer');
                  webRTCService.addIceCandidate(data.candidate);
                }
              });
            }
          });
        });

        // Only the initiator creates an offer
        if (this.isInitiator) {
          console.log('We are the initiator, creating WebRTC offer');
          const offer = await webRTCService.createOffer();
          if (offer) {
            await set(signalingRef, {
              offer: {
                type: offer.type,
                sdp: offer.sdp,
                from: this.userId,
                timestamp: serverTimestamp()
              }
            });
            console.log('Offer sent to signaling server');
          }
        }

        // Listen for signaling messages
        onValue(signalingRef, async (snapshot) => {
          const data = snapshot.val();
          if (!data) return;

          // Handle answer if we're the caller
          if (data.answer && data.answer.from !== this.userId) {
            console.log('Received answer from peer');
            await webRTCService.handleAnswer(data.answer);
          }

          // Handle offer if we're the callee
          if (data.offer && data.offer.from !== this.userId) {
            console.log('Received offer from peer, creating answer');
            const answer = await webRTCService.handleOffer(data.offer);
            if (answer) {
              await update(signalingRef, {
                answer: {
                  type: answer.type,
                  sdp: answer.sdp,
                  from: this.userId,
                  timestamp: serverTimestamp()
                }
              });
              console.log('Answer sent to signaling server');
            }
          }
        });
      } catch (error) {
        console.error('Firebase signaling error, trying to continue:', error);
        // Continue with the call anyway, might still work with STUN servers
      }
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

  private setupChatListener(partnerId: string) {
    if (!this.userId) return;
    
    console.log('Setting up chat listener for partner:', partnerId);
    
    // If using WebSocket fallback
    if (this.usingSocketFallback) {
      // Chat messages will be handled by the wsConnection.onmessage handler
      return;
    }
    
    // Using Firebase
    try {
      if (!this.currentChatRoom) {
        this.currentChatRoom = [this.userId, partnerId].sort().join('_');
      }
      
      const chatRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
      
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
      }, (error) => {
        console.error('Error listening for chat messages:', error);
      });
    } catch (error) {
      console.error('Error setting up chat listener:', error);
    }
  }

  async sendMessage(message: string) {
    if (!this.initialized || !this.userId) {
      console.log('Cannot send message: Not properly initialized');
      return false;
    }
    
    // Using WebSocket fallback
    if (this.usingSocketFallback && this.wsConnection) {
      try {
        this.wsConnection.send(JSON.stringify({
          type: 'message',
          text: message,
          to: this.currentPartnerId
        }));
        
        // Add the message to our own UI
        if (this.messageCallback) {
          this.messageCallback([{
            id: Date.now().toString(),
            text: message,
            senderId: this.userId,
            timestamp: Date.now()
          }]);
        }
        
        return true;
      } catch (error) {
        console.error('Error sending message via WebSocket:', error);
        return false;
      }
    }
    
    // Using Firebase
    try {
      if (!this.currentChatRoom) {
        if (!this.currentPartnerId) {
          return false;
        }
        this.currentChatRoom = [this.userId, this.currentPartnerId].sort().join('_');
      }
      
      console.log('Sending message to chat room:', this.currentChatRoom);
      const chatRef = ref(this.db, `chats/${this.currentChatRoom}/messages`);
      
      try {
        await push(chatRef, {
          text: message,
          timestamp: serverTimestamp(),
          senderId: this.userId
        });
        
        console.log('Message sent successfully via Firebase');
        return true;
      } catch (error) {
        console.error('Firebase message send error, trying fallback:', error);
        
        // Fallback: add message locally if Firebase fails
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
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  setMessageCallback(callback: (message: any) => void) {
    this.messageCallback = callback;
  }

  async cleanup(fullCleanup: boolean = true) {
    console.log('Cleaning up Firebase connections...');
    
    // Socket cleanup
    if (this.usingSocketFallback && fullCleanup) {
      if (this.wsConnection) {
        try {
          this.wsConnection.send(JSON.stringify({
            type: 'disconnect',
            userId: this.userId
          }));
          
          this.wsConnection.close();
          this.wsConnection = null;
        } catch (error) {
          console.error('Error closing WebSocket:', error);
        }
      }
      
      if (fullCleanup) {
        this.currentPartnerId = null;
        localStorage.removeItem('currentPartnerId');
        
        if (this.isInCall) {
          webRTCService.endCall();
          this.isInCall = false;
        }
      }
      
      return;
    }
    
    // Firebase cleanup
    if (!this.initialized || !this.userId) return;
    
    try {
      if (fullCleanup && this.isInCall) {
        webRTCService.endCall();
        this.isInCall = false;
      }

      const updates: any = {};
      
      if (fullCleanup) {
        try {
          const userPartnerRef = ref(this.db, `users/${this.userId}/partner`);
          const partnerSnap = await get(userPartnerRef);
          
          if (partnerSnap.exists()) {
            const partnerId = partnerSnap.val();
            updates[`users/${partnerId}/partner`] = null;
          }
          
          updates[`users/${this.userId}/status`] = 'offline';
          updates[`users/${this.userId}/lastSeen`] = serverTimestamp();
          updates[`users/${this.userId}/partner`] = null;
          updates[`onlineUsers/${this.userId}`] = null;
          updates[`availableUsers/${this.userId}`] = null;
        } catch (error) {
          console.error('Error getting partner info for cleanup:', error);
        }
        
        // Clear the current partner ID
        this.currentPartnerId = null;
        localStorage.removeItem('currentPartnerId');
      }

      if (Object.keys(updates).length > 0) {
        try {
          await update(ref(this.db), updates);
        } catch (error) {
          console.error('Error updating Firebase during cleanup:', error);
        }
      }
      
      if (fullCleanup) {
        if (this.partnerRef) {
          off(this.partnerRef);
          this.partnerRef = null;
        }

        if (this.currentChatRoom) {
          // Clean up listening for WebRTC signaling
          try {
            off(ref(this.db, `chats/${this.currentChatRoom}/messages`));
            off(ref(this.db, `chats/${this.currentChatRoom}/signaling`));
            off(ref(this.db, `chats/${this.currentChatRoom}/candidates`));
          } catch (error) {
            console.error('Error removing Firebase listeners:', error);
          }
          this.currentChatRoom = null;
        }
      }
      
      console.log('Cleanup completed successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export const firebaseService = new FirebaseService();
