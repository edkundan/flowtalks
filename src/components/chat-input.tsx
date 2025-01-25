import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useState } from "react";
import { webRTCService } from "@/services/webrtc";
import { useToast } from "@/components/ui/use-toast";

export function ChatInput() {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const handleSend = () => {
    if (message.trim()) {
      console.log("Attempting to send message:", message);
      const sent = webRTCService.sendMessage(message);
      
      if (sent) {
        toast({
          title: "Message sent",
          description: "Your message has been sent successfully",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to send message",
          description: "Please ensure you're connected to a peer",
        });
      }
      
      setMessage("");
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-background/90 backdrop-blur-sm rounded-lg">
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
      />
      <Button
        onClick={handleSend}
        className="px-8 py-6 h-14 text-lg font-medium bg-primary hover:bg-primary/90 transition-all duration-200 transform hover:scale-105 active:scale-95"
      >
        Send Message
      </Button>
    </div>
  );
}