
import { Button } from "@/components/ui/button";
import { Share2, AlertTriangle, Flag, PhoneOff } from "lucide-react";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ChatControlsProps {
  onDisconnect?: () => void;
}

export function ChatControls({ onDisconnect }: ChatControlsProps) {
  const [isReporting, setIsReporting] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const handleReport = () => {
    setIsReporting(true);
    
    // Store the reported user ID in local storage with expiration time (24 hours from now)
    const partnerId = localStorage.getItem('currentPartnerId');
    if (partnerId) {
      const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '{}');
      // Set expiration to 24 hours from now
      blockedUsers[partnerId] = Date.now() + (24 * 60 * 60 * 1000);
      localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
    }
    
    // Simulate report submission
    setTimeout(() => {
      setIsReporting(false);
      toast({
        title: "Report submitted",
        description: "User has been blocked for 24 hours. Thank you for helping to keep our community safe."
      });
      if (onDisconnect) {
        onDisconnect();
      }
      setShowReportDialog(false);
    }, 1500);
  };

  return (
    <>
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
          onClick={() => setShowReportDialog(true)}
          className="flex flex-col items-center gap-1 rounded-full hover:bg-destructive/20 text-destructive"
        >
          <Flag className="h-5 w-5" />
          <span className="text-xs">Report</span>
        </Button>
        
        <Button
          variant="ghost"
          onClick={onDisconnect}
          className="flex flex-col items-center gap-1 rounded-full hover:bg-orange-500/20 text-orange-500"
        >
          <PhoneOff className="h-5 w-5" />
          <span className="text-xs">End Chat</span>
        </Button>
      </div>

      <AlertDialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to report this user? They will be blocked for 24 hours and you will be disconnected from the chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReport} 
              disabled={isReporting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isReporting ? "Reporting..." : "Report User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
