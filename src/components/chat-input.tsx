import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Smile } from "lucide-react";
import { useState } from "react";
import { firebaseService } from "@/services/firebaseService";
import { useToast } from "@/components/ui/use-toast";
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ChatInput() {
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const [showEmoji, setShowEmoji] = useState(false);

  const handleSend = async () => {
    if (message.trim()) {
      console.log("Attempting to send message:", message);
      const sent = await firebaseService.sendMessage(message);
      
      if (sent) {
        console.log("Message sent successfully");
        toast({
          title: "Message sent",
          description: "Your message has been sent successfully",
        });
      } else {
        console.log("Failed to send message");
        toast({
          variant: "destructive",
          title: "Failed to send message",
          description: "Please ensure you're connected to chat",
        });
      }
      
      setMessage("");
    }
  };

  const addEmoji = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
    setShowEmoji(false);
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-background/90 backdrop-blur-sm rounded-lg">
      <Popover open={showEmoji} onOpenChange={setShowEmoji}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="hover:bg-primary/20"
          >
            <Smile className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0">
          <Picker 
            data={data} 
            onEmojiSelect={addEmoji}
            theme="dark"
          />
        </PopoverContent>
      </Popover>
      
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
      />
      <Button
        onClick={handleSend}
        size="icon"
        className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 transition-all duration-200"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}