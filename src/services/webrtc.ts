import Peer from 'simple-peer';

interface PeerState {
  peer: Peer.Instance | null;
  connected: boolean;
  error: Error | null;
}

class WebRTCService {
  private peer: Peer.Instance | null = null;
  
  initializePeer(initiator: boolean = false): Promise<Peer.Instance> {
    console.log('Initializing WebRTC peer connection', { initiator });
    
    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({
          initiator,
          trickle: false,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        });

        this.peer.on('error', (err) => {
          console.error('WebRTC peer error:', err);
          reject(err);
        });

        this.peer.on('signal', (data) => {
          console.log('WebRTC signal generated:', data);
          // Here you would typically send this signal data to the other peer
          // through your signaling server
        });

        this.peer.on('connect', () => {
          console.log('WebRTC peer connection established');
        });

        this.peer.on('data', (data) => {
          console.log('Received data:', data.toString());
          // Handle incoming data
        });

        resolve(this.peer);
      } catch (error) {
        console.error('Error initializing peer:', error);
        reject(error);
      }
    });
  }

  sendMessage(message: string) {
    if (this.peer && this.peer.connected) {
      console.log('Sending message:', message);
      this.peer.send(message);
      return true;
    }
    console.warn('Cannot send message: peer not connected');
    return false;
  }

  disconnect() {
    if (this.peer) {
      console.log('Destroying peer connection');
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export const webRTCService = new WebRTCService();