
import { toast } from "@/components/ui/use-toast";

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;

  async startCall(): Promise<MediaStream | null> {
    try {
      // Get user media with retries
      this.localStream = await this.getUserMediaWithRetry();
      if (!this.localStream) {
        throw new Error('Could not get microphone access');
      }

      // Create and configure peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ]
      });

      // Add local tracks
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Set up remote stream handling
      this.peerConnection.ontrack = ({ streams: [remoteStream] }) => {
        console.log('Received remote stream');
        this.remoteStream = remoteStream;
        this.playRemoteStream();
      };

      return this.localStream;
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        variant: "destructive",
        title: "Call Error",
        description: "Failed to start call. Please check your microphone settings."
      });
      return null;
    }
  }

  private async getUserMediaWithRetry(retries = 3): Promise<MediaStream | null> {
    for (let i = 0; i < retries; i++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        return stream;
      } catch (error) {
        console.error(`Attempt ${i + 1} failed to get user media:`, error);
        if (i === retries - 1) {
          toast({
            variant: "destructive",
            title: "Microphone Error",
            description: "Please allow microphone access to use voice calling."
          });
          return null;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return null;
  }

  private playRemoteStream() {
    if (!this.remoteStream) return;

    // Clean up existing audio element
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement.remove();
    }

    // Create and configure new audio element
    this.audioElement = new Audio();
    this.audioElement.autoplay = true;
    this.audioElement.srcObject = this.remoteStream;
    
    // Play with retry mechanism
    const playAudio = async () => {
      try {
        if (this.audioElement) {
          await this.audioElement.play();
          this.audioElement.volume = 1.0;
          console.log('Remote audio playing successfully');
        }
      } catch (error) {
        console.error('Error playing remote audio:', error);
        // Retry on user interaction
        document.addEventListener('click', () => {
          this.audioElement?.play().catch(console.error);
        }, { once: true });
      }
    };
    
    playAudio();
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const offer = await this.peerConnection.createOffer();
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
        throw new Error('Peer connection not initialized');
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      return null;
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      if (this.peerConnection) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          callback(event.candidate);
        }
      };
    }
  }

  endCall() {
    // Stop all tracks in local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clean up audio element
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clear remote stream
    this.remoteStream = null;
  }
}

export const webRTCService = new WebRTCService();
