
import { Phone, MicOff, Mic } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { webRTCService } from "@/services/webRTCService";

interface CallButtonProps {
  onEndCall: () => void;
}

export function CallButton3D({ onEndCall }: CallButtonProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 1) % 360);
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  const toggleMute = () => {
    const newMuteState = webRTCService.toggleMute();
    setIsMuted(!!newMuteState);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-24 h-24 perspective-500">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-full flex items-center justify-center shadow-xl transform transition-all duration-300"
          style={{ 
            transform: `rotateY(${rotation}deg) scale(1.2)`,
            boxShadow: '0 0 20px rgba(var(--primary), 0.6)'
          }}
        >
          <Phone className="h-10 w-10 text-white animate-pulse" />
        </div>
      </div>
      
      <div className="flex gap-4">
        <Button 
          onClick={toggleMute}
          className={`rounded-full h-12 w-12 p-0 ${isMuted ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        
        <Button 
          onClick={onEndCall}
          className="rounded-full h-12 w-12 p-0 bg-red-500 hover:bg-red-600"
        >
          <Phone className="h-6 w-6 rotate-135" />
        </Button>
      </div>
    </div>
  );
}
