
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { socketService } from "@/services/socketService";
import { firebaseService } from "@/services/firebaseService";

export function OnlineUsers() {
  const [userCount, setUserCount] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    console.log('Setting up online users component');
    // Get user count from both socket service and Firebase for redundancy
    socketService.setUserCountCallback(setUserCount);
    firebaseService.setUserCountCallback(setUserCount);
    
    // Set up a periodic refresh
    const intervalId = setInterval(() => {
      setIsUpdating(true);
      // Simulate refresh animation
      setTimeout(() => setIsUpdating(false), 1000);
    }, 30000); // Every 30 seconds
    
    return () => {
      console.log('Cleaning up online users component');
      socketService.setUserCountCallback(null);
      firebaseService.setUserCountCallback(null);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full ${isUpdating ? 'animate-pulse' : ''}`}>
      <Users className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{userCount} Online</span>
    </div>
  );
}
