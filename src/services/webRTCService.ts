
import { toast } from "@/components/ui/use-toast";

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;

  async startCall(): Promise<MediaStream | null> {
    try {
      // First ensure any previous call is cleaned up
      this.endCall();

      // Get user media with optimal audio settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        },
        video: false
      });

      this.localStream = stream;
      console.log('Got local stream:', stream.id);

      // Create peer connection with optimal config
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { 
            urls: [
              'stun:stun1.l.google.com:19302',
              'stun:stun2.l.google.com:19302'
            ]
          }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      });

      // Add local stream tracks
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          console.log('Adding track to peer connection:', track.kind);
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Handle incoming tracks with immediate playback
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        [this.remoteStream] = event.streams;

        // Remove any existing audio element
        if (this.audioElement) {
          this.audioElement.srcObject = null;
          this.audioElement.remove();
        }

        // Create and configure new audio element
        this.audioElement = new Audio();
        this.audioElement.autoplay = true;
        this.audioElement.volume = 1.0;
        
        // Set audio element properties for better performance
        this.audioElement.setAttribute('playsinline', 'true');
        this.audioElement.muted = false;

        // Attach remote stream
        this.audioElement.srcObject = this.remoteStream;

        // Force play with retry mechanism
        const playAudio = async () => {
          try {
            if (this.audioElement) {
              await this.audioElement.play();
              console.log('Audio playing successfully');
              
              // Ensure volume is at maximum
              this.audioElement.volume = 1.0;
            }
          } catch (error) {
            console.error('Error playing audio:', error);
            
            // Retry on next user interaction
            const retryPlay = () => {
              if (this.audioElement) {
                this.audioElement.play()
                  .then(() => {
                    console.log('Audio playing after retry');
                    document.body.removeEventListener('click', retryPlay);
                  })
                  .catch(console.error);
              }
            };

            document.body.addEventListener('click', retryPlay, { once: true });
            
            toast({
              description: "Click anywhere to enable audio playback",
              duration: 5000,
            });
          }
        };

        playAudio();
      };

      // Enhanced connection state monitoring
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('Connection state changed:', state);
        
        switch (state) {
          case 'connected':
            toast({
              title: "Call Connected",
              description: "Voice call is now active"
            });
            break;
          case 'failed':
            toast({
              variant: "destructive",
              title: "Connection Failed",
              description: "Trying to reconnect..."
            });
            // Attempt to restart ICE
            this.peerConnection?.restartIce();
            break;
        }
      };

      // Monitor ICE connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        
        if (this.peerConnection?.iceConnectionState === 'failed') {
          // If ICE fails, attempt to restart it
          this.peerConnection.restartIce();
        }
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
    console.log('Ending call and cleaning up resources...');

    // Stop all tracks in local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind);
        track.stop();
      });
      this.localStream = null;
    }

    // Clean up audio element
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement.remove();
      this.audioElement = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    console.log('Call ended and all resources cleaned up');
  }
}

export const webRTCService = new WebRTCService();
