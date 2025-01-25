import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { webRTCService } from "@/services/webrtc";

export function OnlineUsers() {
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    webRTCService.setUserCountCallback(setUserCount);
    return () => webRTCService.setUserCountCallback(null);
  }, []);

  return (
    <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full">
      <Users className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{userCount} Online</span>
    </div>
  );
}