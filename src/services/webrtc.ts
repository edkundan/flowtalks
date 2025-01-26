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
        host: '0.peerjs.com', // Using PeerJS public server
        secure: true,
        port: 443,
        debug: 3,
        config: { // ICE server configuration
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
      return this.peer;

    } catch (error) {
      console.error('Error initializing peer:', error);
      this.disconnect();
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
      // Don't disconnect on every error, only on fatal ones
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
    this.connections.set(conn.peer, conn);

    conn.on('data', (data: any) => {
      console.log('Received data:', data);
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.updateOnlineUsers(Math.max(0, this.onlineUsers - 1));
    });
  }

  private handleCall(call: any) {
    call.on('stream', (remoteStream: MediaStream) => {
      console.log('Received remote stream:', remoteStream.id);
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.play().catch(error => {
        console.error('Error playing audio:', error);
      });
    });
  }

  sendMessage(message: string): boolean {
    if (!this.peer) {
      console.warn('Cannot send message: peer is null');
      return false;
    }

    try {
      console.log('Sending message:', message);
      this.connections.forEach(conn => {
        conn.send(message);
      });
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
    
    this.connections.forEach(conn => {
      conn.close();
    });
    this.connections.clear();

    if (this.peer) {
      console.log('Destroying peer connection');
      this.peer.destroy();
      this.peer = null;
    }

    // Reset online users count
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