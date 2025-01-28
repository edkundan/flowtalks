import Peer from 'peerjs';

class WebRTCService {
  private peer: Peer | null = null;
  private stream: MediaStream | null = null;
  private onlineUsers: number = 0;
  private userCountCallback: ((count: number) => void) | null = null;
  private connections: Map<string, any> = new Map();
  private availablePeers: Set<string> = new Set();
  private currentConnection: any = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  private peerServer = {
    host: '64.227.140.97',
    port: 9000,
    path: '/myapp',
    secure: false,
    debug: 3,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    }
  };

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.updatePeerList();
      } catch (error) {
        console.error('Heartbeat error:', error);
      }
    }, 5000);
  }

  private async updatePeerList() {
    if (!this.peer?.id) return [];

    try {
      // Use PeerJS's listAllPeers method instead of direct HTTP request
      const peers = await new Promise<string[]>((resolve) => {
        if (!this.peer) {
          resolve([]);
          return;
        }
        this.peer.listAllPeers((peerList) => resolve(peerList));
      });

      this.updateOnlineUsers(peers.length);
      console.log('Current online peers:', peers.length);
      return peers;

    } catch (error) {
      console.error('Error updating peer list:', error);
      return [];
    }
  }

  private async findAndConnectToRandomPeer(isAudioCall: boolean) {
    if (!this.peer?.id) return;

    try {
      const peers = await this.updatePeerList();
      const availablePeers = peers.filter(id => 
        id !== this.peer?.id && !this.connections.has(id)
      );

      if (availablePeers.length > 0) {
        const randomPeer = availablePeers[Math.floor(Math.random() * availablePeers.length)];
        console.log('Attempting to connect to peer:', randomPeer);

        if (isAudioCall && this.stream) {
          const call = this.peer.call(randomPeer, this.stream);
          this.handleCall(call);
        } else {
          const conn = this.peer.connect(randomPeer, {
            reliable: true,
            serialization: 'json'
          });
          this.handleConnection(conn);
        }
      } else {
        console.log('No available peers found, waiting for incoming connections');
      }
    } catch (error) {
      console.error('Error connecting to random peer:', error);
      throw error;
    }
  }

  private setupPeerEvents() {
    if (!this.peer) {
      console.error('Cannot setup events: peer is null');
      return;
    }

    this.peer.on('open', (id) => {
      console.log('PeerJS connection opened with ID:', id);
      this.updatePeerList(); // Get initial peer list
    });

    this.peer.on('connection', (conn) => {
      console.log('Received connection from peer:', conn.peer);
      this.handleConnection(conn);
    });

    this.peer.on('call', (call) => {
      console.log('Receiving call from peer:', call.peer);
      if (this.stream) {
        call.answer(this.stream);
        this.handleCall(call);
      }
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'network' || err.type === 'server-error') {
        // Try to reconnect
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          this.peer?.reconnect();
        }, 3000);
      }
    });

    this.peer.on('disconnected', () => {
      console.log('PeerJS disconnected, attempting to reconnect...');
      this.peer?.reconnect();
    });

    this.peer.on('close', () => {
      console.log('PeerJS connection closed');
      this.updateOnlineUsers(Math.max(0, this.onlineUsers - 1));
    });
  }

  private handleConnection(conn: any) {
    if (this.currentConnection) {
      console.log('Already connected to a peer, rejecting new connection');
      conn.close();
      return;
    }

    this.currentConnection = conn;
    this.connections.set(conn.peer, conn);

    conn.on('open', () => {
      console.log('Connection established with:', conn.peer);
    });

    conn.on('data', (data: any) => {
      console.log('Received data:', data);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      if (this.currentConnection === conn) {
        this.currentConnection = null;
      }
      this.updateOnlineUsers(Math.max(0, this.onlineUsers - 1));
    });
  }

  private handleCall(call: any) {
    if (this.currentConnection) {
      console.log('Already in a call, rejecting new call');
      call.close();
      return;
    }

    this.currentConnection = call;

    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Received remote stream:', remoteStream.id);
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    });

    call.on('close', () => {
      console.log('Call ended');
      if (this.currentConnection === call) {
        this.currentConnection = null;
      }
    });
  }

  disconnect() {
    console.log('Disconnecting WebRTC service...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }
    
    if (this.currentConnection) {
      this.currentConnection.close();
      this.currentConnection = null;
    }

    this.connections.forEach(conn => {
      conn.close();
    });
    this.connections.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.connectionAttempts = 0;
    this.updateOnlineUsers(0);
  }

  setUserCountCallback(callback: ((count: number) => void) | null) {
    this.userCountCallback = callback;
  }

  private updateOnlineUsers(count: number) {
    this.onlineUsers = Math.max(0, count);
    if (this.userCountCallback) {
      this.userCountCallback(this.onlineUsers);
    }
  }

  sendMessage(message: string): boolean {
    if (!this.currentConnection) {
      console.warn('Cannot send message: no active connection');
      return false;
    }

    try {
      this.currentConnection.send(message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  async initializePeer(initiator: boolean = false, isAudioCall: boolean = false): Promise<Peer | null> {
    console.log('Initializing PeerJS connection...', { initiator, isAudioCall });
    
    try {
      // Cleanup any existing peer connection
      this.disconnect();

      if (isAudioCall) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false
          });
          console.log('Audio stream obtained:', this.stream.id);
        } catch (error) {
          console.error('Failed to get audio stream:', error);
          throw new Error('Failed to access microphone');
        }
      }

      // Generate a random peer ID
      const peerId = Math.random().toString(36).substring(7);
      console.log('Generated peer ID:', peerId);

      // Create new PeerJS instance with shorter timeout
      this.peer = new Peer(peerId, {
        ...this.peerServer,
        config: {
          ...this.peerServer.config,
          iceTransportPolicy: 'all',
          reconnectTimer: 3000,
        }
      });

      // Set up event handlers
      this.setupPeerEvents();
      
      // Wait for the peer connection to be established with a shorter timeout
      await new Promise<void>((resolve, reject) => {
        if (!this.peer) {
          reject(new Error('Peer not initialized'));
          return;
        }

        const timeout = setTimeout(() => {
          if (this.connectionAttempts < this.maxConnectionAttempts) {
            this.connectionAttempts++;
            console.log(`Connection attempt ${this.connectionAttempts} timed out, retrying...`);
            clearTimeout(timeout);
            this.initializePeer(initiator, isAudioCall);
          } else {
            reject(new Error('Connection timeout after multiple attempts'));
          }
        }, 10000); // Reduced timeout to 10 seconds

        this.peer.on('open', () => {
          clearTimeout(timeout);
          this.connectionAttempts = 0;
          console.log('Successfully connected to PeerJS server');
          resolve();
        });

        this.peer.on('error', (err) => {
          clearTimeout(timeout);
          console.error('PeerJS connection error:', err);
          reject(err);
        });
      });

      // Start heartbeat after successful connection
      this.startHeartbeat();
      
      if (initiator) {
        await this.findAndConnectToRandomPeer(isAudioCall);
      }

      return this.peer;

    } catch (error) {
      console.error('Error initializing peer:', error);
      this.disconnect();
      throw error;
    }
  }
}

export const webRTCService = new WebRTCService();
