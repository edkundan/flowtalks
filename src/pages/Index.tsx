
import { Button } from "@/components/ui/button";
import { ChatControls } from "@/components/chat-controls";
import { ChatInput } from "@/components/chat-input";
import { MessageSquare, Phone } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { SettingsDialog } from "@/components/SettingsDialog";
import { DisclaimerDialog } from "@/components/DisclaimerDialog";
import { useSettings } from "@/hooks/use-settings";
import { ConnectingState } from "@/components/ConnectingState";
import { firebaseService } from "@/services/firebaseService";
import { useToast } from "@/components/ui/use-toast";
import { OnlineUsers } from "@/components/online-users";
import { CallButton3D } from "@/components/CallButton3D";
import { webRTCService } from "@/services/webRTCService";

interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
}

const Index = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [communicationType, setCommunicationType] = useState<"chat" | "audio">("chat");
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const { isOpen: isSettingsOpen, closeSettings } = useSettings();
  const { toast } = useToast();
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    firebaseService.setMessageCallback((newMessages: Message[]) => {
      console.log("Received new messages:", newMessages);
      setMessages(newMessages);
    });

    // Set up the partner disconnect callback
    firebaseService.setPartnerDisconnectCallback(() => {
      setIsConnected(false);
      setMessages([]);
    });

    // Check for blocked users
    const checkForBlockedUsers = () => {
      const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '{}');
      const now = Date.now();
      
      // Clean up expired blocks
      let hasChanges = false;
      for (const userId in blockedUsers) {
        if (blockedUsers[userId] < now) {
          delete blockedUsers[userId];
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
      }
    };
    
    checkForBlockedUsers();
    const intervalId = setInterval(checkForBlockedUsers, 60000); // Check every minute

    return () => {
      firebaseService.cleanup();
      firebaseService.setPartnerDisconnectCallback(null);
      clearInterval(intervalId);
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      console.log('Initiating connection...');
      const partnerId = await firebaseService.findPartner();
      
      if (partnerId) {
        console.log('Partner found, connecting...', partnerId);
        
        // If it's an audio call, we need to set up the WebRTC connection after we found a partner
        if (communicationType === "audio") {
          try {
            console.log('Setting up audio call...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video: false 
            });
            console.log('Audio permissions granted, tracks:', stream.getTracks().length);
            localStreamRef.current = stream;
            
            // Initialize the audio call with our partner
            await firebaseService.setupAudioCall();
            console.log('Audio call setup complete');
            
            // Give WebRTC a moment to establish the connection
            setTimeout(() => {
              setIsConnecting(false);
              setIsConnected(true);
              toast({
                title: "Connected!",
                description: "Voice call established. You can now talk to your partner.",
              });
            }, 1000);
          } catch (error) {
            console.error('Audio setup error:', error);
            toast({
              variant: "destructive",
              title: "Microphone Access Required",
              description: "Please allow microphone access to use voice calling.",
            });
            setIsConnecting(false);
            // Clean up the connection since audio failed
            firebaseService.cleanup(true);
            return;
          }
        } else {
          // For text chat, we can connect immediately
          setIsConnecting(false);
          setIsConnected(true);
          toast({
            title: "Connected!",
            description: "Chat established. You can now chat with your partner.",
          });
        }
      } else {
        console.log('No partner found, waiting...');
        toast({
          title: "Searching...",
          description: "Looking for available partners.",
        });
        
        // If we timeout after waiting, reset the state
        setTimeout(() => {
          if (isConnecting) {
            setIsConnecting(false);
            toast({
              variant: "destructive",
              title: "No partners found",
              description: "Couldn't find any available partners right now. Please try again.",
            });
          }
        }, 30000);
      }
    } catch (error) {
      console.error('Connection error:', error);
      setIsConnecting(false);
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Unable to establish connection. Please try again later.",
      });
    }
  };

  const handleDisconnect = () => {
    console.log('Disconnecting...');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log('Stopping local track:', track.kind);
        track.stop();
      });
      localStreamRef.current = null;
    }
    
    if (communicationType === "audio") {
      webRTCService.endCall();
    }
    
    firebaseService.cleanup(true);
    setIsConnected(false);
    setMessages([]);
    toast({
      title: "Disconnected",
      description: "You've been disconnected from the chat.",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="absolute top-20 right-4">
          <OnlineUsers />
        </div>

        {!isConnected ? (
          isConnecting ? (
            <ConnectingState />
          ) : (
            <div className="text-center space-y-8 animate-fadeIn">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8 group transition-all duration-500">
                {communicationType === "chat" ? (
                  <MessageSquare 
                    className="w-16 h-16 text-primary animate-bounce transition-all duration-300 group-hover:scale-110" 
                  />
                ) : (
                  <Phone 
                    className="w-16 h-16 text-primary animate-pulse transition-all duration-300 group-hover:scale-110" 
                  />
                )}
              </div>
              <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                Ready to Connect
              </h2>
              <p className="text-xl text-muted-foreground">
                Choose how you want to communicate
              </p>
              
              <RadioGroup
                defaultValue="chat"
                value={communicationType}
                onValueChange={(value) => setCommunicationType(value as "chat" | "audio")}
                className="flex items-center gap-6 justify-center"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="chat" id="chat" />
                  <Label htmlFor="chat" className="flex items-center gap-2 cursor-pointer text-lg">
                    <MessageSquare className="w-5 h-5" />
                    Text Chat
                  </Label>
                </div>
                <span className="text-lg text-muted-foreground">or</span>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="audio" id="audio" />
                  <Label htmlFor="audio" className="flex items-center gap-2 cursor-pointer text-lg">
                    <Phone className="w-5 h-5" />
                    Audio Call
                  </Label>
                </div>
              </RadioGroup>

              <Button
                size="lg"
                className="mt-4 button-glow text-lg px-8 py-6 bg-gradient-to-r from-primary to-primary/80 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg hover:shadow-primary/50 disabled:hover:scale-100"
                disabled={isConnecting}
                onClick={handleConnect}
              >
                {isConnecting ? "Connecting..." : `Start ${communicationType === "chat" ? "Chat" : "Call"}`}
              </Button>
            </div>
          )
        ) : (
          <div className="w-full max-w-2xl space-y-4 animate-fadeIn">
            <div className="glass rounded-lg p-8 min-h-[400px] overflow-y-auto flex flex-col space-y-4">
              {communicationType === "chat" ? (
                messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.senderId === firebaseService.getCurrentUserId()
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.senderId === firebaseService.getCurrentUserId()
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground">Send a message to start the conversation!</p>
                  </div>
                )
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <CallButton3D onEndCall={handleDisconnect} />
                </div>
              )}
            </div>
            {communicationType === "chat" ? (
              <ChatInput />
            ) : null}
            <div className="flex justify-center">
              <ChatControls onDisconnect={handleDisconnect} />
            </div>
          </div>
        )}
      </main>

      <DisclaimerDialog 
        open={showDisclaimer} 
        onAccept={() => setShowDisclaimer(false)} 
      />
      
      <SettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={closeSettings}
      />
    </div>
  );
};

export default Index;
