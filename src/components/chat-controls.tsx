import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, MessageSquare, Share2, AlertTriangle } from "lucide-react";
import { useState } from "react";

export function ChatControls() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);

  return (
    <div className="flex items-center gap-2 bg-background/90 backdrop-blur-sm p-4 rounded-full shadow-lg">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-primary/20"
        onClick={() => setIsMuted(!isMuted)}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-primary/20"
        onClick={() => setIsVideoOff(!isVideoOff)}
      >
        {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-primary/20"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-primary/20"
      >
        <Share2 className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full hover:bg-destructive/20 text-destructive"
      >
        <AlertTriangle className="h-5 w-5" />
      </Button>
    </div>
  );
}