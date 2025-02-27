
import { toast } from "@/components/ui/use-toast";

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private isMuted: boolean = false;

  async startCall(): Promise<MediaStream | null> {
    try {
      console.log('Starting call setup...');
      
      // Clean up any existing connections
      this.endCall();

      // Get microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      console.log('Got local stream with tracks:', this.localStream.getTracks().map(t => t.kind).join(', '));

      // Create and configure peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
          {
            urls: ['turn:numb.viagenie.ca'],
            username: 'webrtc@live.com',
            credential: 'muazkh'
          }
        ],
        iceCandidatePoolSize: 10
      });

      // Add all local audio tracks to the connection
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          console.log('Adding local track to peer connection:', track.kind);
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // Set up remote stream handling
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        
        // Create audio element if it doesn't exist
        if (!this.remoteAudioElement) {
          this.remoteAudioElement = new Audio();
          this.remoteAudioElement.autoplay = true;
          this.remoteAudioElement.volume = 1.0;
          document.body.appendChild(this.remoteAudioElement);
          console.log('Created new audio element');
        }

        // Set the remote stream
        const [remoteStream] = event.streams;
        if (this.remoteAudioElement.srcObject !== remoteStream) {
          this.remoteAudioElement.srcObject = remoteStream;
          console.log('Set remote stream to audio element');
          
          // Play audio with user interaction already happened
          this.remoteAudioElement.play()
            .then(() => console.log('Remote audio playing successfully'))
            .catch(err => {
              console.error('Error playing remote audio:', err);
              
              // Try again with user interaction
              const playButton = document.createElement('button');
              playButton.textContent = 'Enable Audio';
              playButton.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary text-white px-4 py-2 rounded-md z-50';
              playButton.onclick = () => {
                this.remoteAudioElement?.play()
                  .then(() => {
                    console.log('Audio started after user interaction');
                    playButton.remove();
                  })
                  .catch(e => console.error('Still failed to play audio:', e));
              };
              document.body.appendChild(playButton);
              
              toast({
                variant: "destructive",
                title: "Audio Error",
                description: "Click 'Enable Audio' to hear your partner."
              });
            });
        }
      };

      // Log connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        const state = this.peerConnection?.connectionState;
        console.log('Connection state changed:', state);
        
        if (state === 'connected') {
          toast({
            title: "Call Connected",
            description: "You can now talk to your partner"
          });
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          toast({
            variant: "destructive",
            title: "Call Disconnected",
            description: "The connection was lost"
          });
        }
      };

      // Log ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
        if (this.peerConnection?.iceConnectionState === 'connected') {
          console.log('ICE connected - audio should be flowing now');
        }
      };

      // Log gathering state changes
      this.peerConnection.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', this.peerConnection?.iceGatheringState);
      };

      return this.localStream;
    } catch (error) {
      console.error('Error in startCall:', error);
      toast({
        variant: "destructive",
        title: "Call Setup Failed",
        description: "Please check your microphone permissions and try again."
      });
      return null;
    }
  }

  toggleMute() {
    if (!this.localStream) return;
    
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
      console.log(`Track ${track.id} enabled: ${track.enabled}`);
    });
    
    toast({
      title: this.isMuted ? "Microphone Muted" : "Microphone Unmuted",
      description: this.isMuted ? "Your partner cannot hear you" : "Your partner can hear you now"
    });
    
    return this.isMuted;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) {
      console.error('No peer connection available');
      return null;
    }

    try {
      console.log('Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Local description set');
      
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      return null;
    }
  }

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) {
      console.error('No peer connection available');
      return null;
    }

    try {
      console.log('Handling incoming offer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      console.log('Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      return answer;
    } catch (error) {
      console.error('Error handling offer:', error);
      return null;
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      console.error('No peer connection available');
      return;
    }

    try {
      console.log('Setting remote description from answer...');
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set successfully');
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection) {
      console.error('No peer connection available');
      return;
    }

    try {
      console.log('Adding ICE candidate...');
      await this.peerConnection.addIceCandidate(candidate);
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
    
    // Stop all tracks in local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Clean up remote audio
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
      this.remoteAudioElement.remove();
      this.remoteAudioElement = null;
      console.log('Removed remote audio element');
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      console.log('Closed peer connection');
    }
  }
}

export const webRTCService = new WebRTCService();
