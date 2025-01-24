import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
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
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0"
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
      />
      <Button
        onClick={handleSend}
        className="px-6 py-2 h-12 text-base font-medium flex items-center gap-2 bg-primary hover:bg-primary/90 transition-all duration-200 transform hover:scale-105 active:scale-95"
      >
        <Send className="h-5 w-5" />
        Send
      </Button>
    </div>
  );
}