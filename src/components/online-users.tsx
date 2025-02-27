
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { socketService } from "@/services/socketService";

export function OnlineUsers() {
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    console.log('Setting up online users component');
    socketService.setUserCountCallback(setUserCount);
    return () => {
      console.log('Cleaning up online users component');
      socketService.setUserCountCallback(null);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full animate-pulse">
      <Users className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{userCount} Online</span>
    </div>
  );
}
