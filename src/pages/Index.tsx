import { Button } from "@/components/ui/button";
import { ChatControls } from "@/components/chat-controls";
import { ChatInput } from "@/components/chat-input";
import { MessageSquare, Phone } from "lucide-react";
import { useState, useEffect } from "react";
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

  useEffect(() => {
    // Set up message listener when component mounts
    firebaseService.setMessageCallback((newMessages: Message[]) => {
      console.log("Received new messages:", newMessages);
      setMessages(newMessages);
    });

    return () => {
      // Cleanup on unmount
      firebaseService.cleanup();
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      if (communicationType === "audio") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Audio permissions granted');
          stream.getTracks().forEach(track => track.stop());
        } catch (error) {
          console.error('Audio permission error:', error);
          toast({
            variant: "destructive",
            title: "Microphone Access Required",
            description: "Please allow microphone access for audio calls.",
          });
          setIsConnecting(false);
          return;
        }
      }

      console.log('Initiating connection...');
      const partnerId = await firebaseService.findPartner();
      
      if (partnerId) {
        console.log('Partner found, connecting...', partnerId);
        setIsConnecting(false);
        setIsConnected(true);
        toast({
          title: "Connected!",
          description: `Ready for ${communicationType === "chat" ? "chat" : "call"}`,
        });
      } else {
        console.log('No partner found, waiting...');
        toast({
          title: "Searching...",
          description: "Looking for available partners.",
        });
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
    firebaseService.cleanup();
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
              {messages.map((message) => (
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
              ))}
            </div>
            {communicationType === "chat" ? (
              <ChatInput />
            ) : (
              <div className="flex justify-center">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleDisconnect}
                  className="px-8 py-6"
                >
                  End Call
                </Button>
              </div>
            )}
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