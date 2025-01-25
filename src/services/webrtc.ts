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
  private onUserCountChange: ((count: number) => void) | null = null;

  async initializePeer(initiator: boolean = false, isAudioCall: boolean = false): Promise<Peer.Instance> {
    console.log('Initializing WebRTC peer connection', { initiator, isAudioCall });
    
    try {
      if (isAudioCall) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this.peer = new Peer({
        initiator,
        trickle: false,
        stream: isAudioCall ? this.stream : undefined,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.setupPeerEvents();
      return this.peer;
    } catch (error) {
      console.error('Error initializing peer:', error);
      throw error;
    }
  }

  private setupPeerEvents() {
    if (!this.peer) return;

    this.peer.on('error', (err) => {
      console.error('WebRTC peer error:', err);
    });

    this.peer.on('signal', (data) => {
      console.log('WebRTC signal generated:', data);
      // Here you would send this signal data to the other peer through your signaling server
    });

    this.peer.on('connect', () => {
      console.log('WebRTC peer connection established');
      this.updateOnlineUsers(this.onlineUsers + 1);
    });

    this.peer.on('data', (data) => {
      console.log('Received data:', data.toString());
      // Handle incoming data
    });

    this.peer.on('stream', (stream) => {
      console.log('Received remote stream');
      // Handle incoming audio stream
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
      this.updateOnlineUsers(this.onlineUsers - 1);
      this.disconnect();
    });
  }

  sendMessage(message: string): boolean {
    if (this.peer && this.peer.connected) {
      console.log('Sending message:', message);
      this.peer.send(message);
      return true;
    }
    console.warn('Cannot send message: peer not connected');
    return false;
  }

  disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.peer) {
      console.log('Destroying peer connection');
      this.peer.destroy();
      this.peer = null;
    }
  }

  setUserCountCallback(callback: (count: number) => void) {
    this.onUserCountCallback = callback;
  }

  private updateOnlineUsers(count: number) {
    this.onlineUsers = count;
    if (this.onUserCountCallback) {
      this.onUserCountCallback(count);
    }
  }
}

export const webRTCService = new WebRTCService();