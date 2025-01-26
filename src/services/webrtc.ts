import Peer from 'peerjs';

interface PeerState {
  peer: Peer | null;
  connected: boolean;
  error: Error | null;
}

class WebRTCService {
  private peer: Peer | null = null;
  private stream: MediaStream | null = null;
  private onlineUsers: number = 0;
  private userCountCallback: ((count: number) => void) | null = null;
  private connections: Map<string, any> = new Map();
  private availablePeers: Set<string> = new Set();
  private currentConnection: any = null;

  async initializePeer(initiator: boolean = false, isAudioCall: boolean = false): Promise<Peer | null> {
    console.log('Initializing PeerJS connection', { initiator, isAudioCall });
    
    try {
      // Cleanup any existing peer connection
      this.disconnect();

      if (isAudioCall) {
        console.log('Requesting audio stream...');
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false
        });
        console.log('Audio stream obtained:', this.stream.id);
      }

      // Generate a random peer ID
      const peerId = Math.random().toString(36).substring(7);
      console.log('Generated peer ID:', peerId);

      // Create new PeerJS instance with more reliable configuration
      this.peer = new Peer(peerId, {
        host: '0.peerjs.com',
        secure: true,
        port: 443,
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
      });

      this.setupPeerEvents();
      
      // If initiator, try to connect to a random peer
      if (initiator) {
        this.findAndConnectToRandomPeer(isAudioCall);
      }

      return this.peer;

    } catch (error) {
      console.error('Error initializing peer:', error);
      this.disconnect();
      throw error;
    }
  }

  private async findAndConnectToRandomPeer(isAudioCall: boolean) {
    if (!this.peer) return;

    // Wait for peer to be fully initialized
    await new Promise(resolve => {
      this.peer!.on('open', resolve);
    });

    // Get list of available peers from the server
    try {
      const response = await fetch('https://0.peerjs.com/peerjs/peers');
      const peers = await response.json();
      
      // Filter out our own ID and already connected peers
      const availablePeers = peers.filter((id: string) => 
        id !== this.peer?.id && !this.connections.has(id)
      );

      if (availablePeers.length > 0) {
        // Randomly select a peer
        const randomPeer = availablePeers[Math.floor(Math.random() * availablePeers.length)];
        console.log('Attempting to connect to random peer:', randomPeer);

        if (isAudioCall && this.stream) {
          const call = this.peer.call(randomPeer, this.stream);
          this.handleCall(call);
        } else {
          const conn = this.peer.connect(randomPeer);
          this.handleConnection(conn);
        }
      } else {
        console.log('No available peers found, waiting for incoming connections');
      }
    } catch (error) {
      console.error('Error finding random peer:', error);
    }
  }

  private setupPeerEvents() {
    if (!this.peer) {
      console.error('Cannot setup events: peer is null');
      return;
    }

    this.peer.on('open', (id) => {
      console.log('PeerJS connection opened with ID:', id);
      this.updateOnlineUsers(this.onlineUsers + 1);
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
        this.disconnect();
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

    conn.on('data', (data: any) => {
      console.log('Received data:', data);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.currentConnection = null;
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
      this.currentConnection = null;
    });
  }

  sendMessage(message: string): boolean {
    if (!this.currentConnection) {
      console.warn('Cannot send message: no active connection');
      return false;
    }

    try {
      console.log('Sending message:', message);
      this.currentConnection.send(message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  disconnect() {
    console.log('Disconnecting PeerJS service...');
    
    if (this.stream) {
      console.log('Stopping audio tracks...');
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped:', track.id);
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
      console.log('Destroying peer connection');
      this.peer.destroy();
      this.peer = null;
    }

    this.updateOnlineUsers(0);
  }

  setUserCountCallback(callback: ((count: number) => void) | null) {
    console.log('Setting user count callback');
    this.userCountCallback = callback;
  }

  private updateOnlineUsers(count: number) {
    console.log('Updating online users count:', count);
    this.onlineUsers = Math.max(0, count);
    if (this.userCountCallback) {
      this.userCountCallback(this.onlineUsers);
    }
  }
}

export const webRTCService = new WebRTCService();