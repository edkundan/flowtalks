
import { toast } from "@/components/ui/use-toast";

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;

  async startCall(): Promise<MediaStream | null> {
    try {
      // First, get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      this.localStream = stream;
      console.log('Got local stream:', stream.id);

      // Create peer connection with simplified config
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
          {
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ]
      });

      // Add all tracks from local stream
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          console.log('Adding track to peer connection:', track.kind);
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Handle incoming tracks
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        const [remoteStream] = event.streams;
        this.remoteStream = remoteStream;

        // Create new audio element
        const audio = new Audio();
        audio.autoplay = true;
        audio.srcObject = remoteStream;

        // Try to play immediately
        audio.play().catch(error => {
          console.error('Initial playback failed:', error);
          // Retry on user interaction
          document.body.addEventListener('click', () => {
            audio.play().catch(console.error);
          }, { once: true });
        });

        this.audioElement = audio;
        console.log('Audio element created and stream attached');
      };

      // Log connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.peerConnection?.connectionState);
        if (this.peerConnection?.connectionState === 'connected') {
          toast({
            title: "Call Connected",
            description: "Voice call is now active"
          });
        }
      };

      // Log ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      };

      return this.localStream;
    } catch (error) {
      console.error('Error in startCall:', error);
      toast({
        variant: "destructive",
        title: "Microphone Error",
        description: "Please allow microphone access to use voice calling."
      });
      return null;
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    try {
      if (!this.peerConnection) {
        throw new Error('No peer connection');
      }

      console.log('Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true
      });

      console.log('Setting local description...');
      await this.peerConnection.setLocalDescription(offer);
      
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      if (!this.peerConnection) {
        throw new Error('No peer connection');
      }

      console.log('Setting remote description from answer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    try {
      if (!this.peerConnection) {
        throw new Error('No peer connection');
      }

      console.log('Setting remote description from offer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      console.log('Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      
      console.log('Setting local description...');
      await this.peerConnection.setLocalDescription(answer);
      
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      return null;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      if (!this.peerConnection) return;

      console.log('Adding ICE candidate...');
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate.type);
        callback(event.candidate);
      }
    };
  }

  endCall() {
    console.log('Ending call...');

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      this.localStream = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('Call ended and resources cleaned up');
  }
}

export const webRTCService = new WebRTCService();
