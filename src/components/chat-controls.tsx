import { Button } from "@/components/ui/button";
import { Share2, AlertTriangle } from "lucide-react";

interface ChatControlsProps {
  onDisconnect?: () => void;
}

export function ChatControls({ onDisconnect }: ChatControlsProps) {
  return (
    <div className="flex items-center gap-4 bg-background/90 backdrop-blur-sm p-4 rounded-full shadow-lg">
      <Button
        variant="ghost"
        className="flex flex-col items-center gap-1 rounded-full hover:bg-primary/20"
      >
        <Share2 className="h-5 w-5" />
        <span className="text-xs">Share</span>
      </Button>
      <Button
        variant="ghost"
        onClick={onDisconnect}
        className="flex flex-col items-center gap-1 rounded-full hover:bg-destructive/20 text-destructive"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="text-xs">Report</span>
      </Button>
    </div>
  );
}