import Peer from 'simple-peer';

interface PeerState {
  peer: Peer.Instance | null;
  connected: boolean;
  error: Error | null;
}

class WebRTCService {
  private peer: Peer.Instance | null = null;
  private stream: MediaStream | null = null;
  private onlineUsers: number = 0;
  private userCountCallback: ((count: number) => void) | null = null;

  async initializePeer(initiator: boolean = false, isAudioCall: boolean = false): Promise<Peer.Instance | null> {
    console.log('Initializing WebRTC peer connection', { initiator, isAudioCall });
    
    try {
      // Cleanup any existing peer connection
      this.disconnect();

      if (isAudioCall) {
        console.log('Requesting audio stream...');
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: false // Explicitly disable video
        });
        console.log('Audio stream obtained:', this.stream.id);
      }

      // Define peer options with wrtc for Node.js environment
      const peerOptions: Peer.Options = {
        initiator,
        trickle: false,
        config: {
          iceServers: [
            { urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
            {
              urls: 'turn:numb.viagenie.ca',
              username: 'webrtc@live.com',
              credential: 'muazkh'
            }
          ]
        },
        stream: isAudioCall ? this.stream : undefined,
        objectMode: true
      };

      console.log('Creating new peer with options:', peerOptions);
      
      // Create new peer instance
      this.peer = new Peer(peerOptions);
      
      if (!this.peer) {
        throw new Error('Failed to create peer instance');
      }

      console.log('Peer instance created successfully');

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

    this.peer.on('error', (err) => {
      console.error('WebRTC peer error:', err);
      this.disconnect();
    });

    this.peer.on('signal', (data) => {
      console.log('WebRTC signal generated:', data);
    });

    this.peer.on('connect', () => {
      console.log('WebRTC peer connection established');
      this.updateOnlineUsers(this.onlineUsers + 1);
    });

    this.peer.on('data', (data) => {
      console.log('Received data:', data.toString());
    });

    this.peer.on('stream', (stream) => {
      console.log('Received remote stream:', stream.id);
      if (stream.getAudioTracks().length > 0) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
        });
      }
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      this.updateOnlineUsers(Math.max(0, this.onlineUsers - 1));
      this.disconnect();
    });
  }

  sendMessage(message: string): boolean {
    if (!this.peer) {
      console.warn('Cannot send message: peer is null');
      return false;
    }

    if (!this.peer.connected) {
      console.warn('Cannot send message: peer not connected');
      return false;
    }

    try {
      console.log('Sending message:', message);
      this.peer.send(message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  disconnect() {
    console.log('Disconnecting WebRTC service...');
    
    if (this.stream) {
      console.log('Stopping audio tracks...');
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Audio track stopped:', track.id);
      });
      this.stream = null;
    }
    
    if (this.peer) {
      console.log('Destroying peer connection');
      try {
        this.peer.destroy();
      } catch (error) {
        console.error('Error destroying peer:', error);
      }
      this.peer = null;
    }
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