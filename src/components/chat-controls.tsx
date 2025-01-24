import { Button } from "@/components/ui/button";
import { Mic, MicOff, MessageSquare, Share2, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function ChatControls() {
  const [isMuted, setIsMuted] = useState(false);

  return (
    <div className="flex items-center gap-4 bg-background/90 backdrop-blur-sm p-4 rounded-full shadow-lg">
      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 rounded-full hover:bg-primary/20"
        onClick={() => setIsMuted(!isMuted)}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        <span className="text-xs">Mic</span>
      </Button>
      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 rounded-full hover:bg-primary/20"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="text-xs">Chat</span>
      </Button>
      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 rounded-full hover:bg-primary/20"
      >
        <Share2 className="h-5 w-5" />
        <span className="text-xs">Share</span>
      </Button>
      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 rounded-full hover:bg-destructive/20 text-destructive"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="text-xs">Report</span>
      </Button>
    </div>
  );
}