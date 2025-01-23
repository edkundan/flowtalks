import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Image, Send } from "lucide-react";
import { useState } from "react";

export function ChatInput() {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      console.log("Sending message:", message);
      setMessage("");
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-background/90 backdrop-blur-sm rounded-lg">
      <Button variant="ghost" size="icon" className="rounded-full">
        <Image className="h-5 w-5" />
      </Button>
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
      />
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-primary hover:text-primary/80"
        onClick={handleSend}
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}