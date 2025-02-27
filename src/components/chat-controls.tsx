
import { Button } from "@/components/ui/button";
import { Share2, AlertTriangle, Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

interface ChatControlsProps {
  onDisconnect?: () => void;
}

export function ChatControls({ onDisconnect }: ChatControlsProps) {
  const [isReporting, setIsReporting] = useState(false);

  const handleReport = () => {
    setIsReporting(true);
    
    // Simulate report submission
    setTimeout(() => {
      setIsReporting(false);
      toast({
        title: "Report submitted",
        description: "Thank you for helping to keep our community safe."
      });
      if (onDisconnect) {
        onDisconnect();
      }
    }, 1500);
  };

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
        onClick={handleReport}
        disabled={isReporting}
        className="flex flex-col items-center gap-1 rounded-full hover:bg-destructive/20 text-destructive"
      >
        <Flag className="h-5 w-5" />
        <span className="text-xs">{isReporting ? "Reporting..." : "Report"}</span>
      </Button>
    </div>
  );
}
