
import { toast } from "@/components/ui/use-toast";

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  async startCall(): Promise<MediaStream | null> {
    try {
      // Clean up any existing call
      this.endCall();

      // First get microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // Create a simple peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Add our audio to the connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });

      // When we receive remote audio
      this.peerConnection.ontrack = (event) => {
        // Create audio element and play immediately
        const audioEl = document.createElement('audio');
        audioEl.srcObject = event.streams[0];
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);

        toast({
          title: "Connected",
          description: "Voice call is active"
        });
      };

      return this.localStream;
    } catch (error) {
      console.error('Failed to start call:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please allow microphone access"
      });
      return null;
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;

    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      return null;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    if (!this.peerConnection) return;

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        callback(event.candidate);
      }
    };
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  endCall() {
    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Remove all audio elements
    document.querySelectorAll('audio').forEach(audio => audio.remove());

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

export const webRTCService = new WebRTCService();
