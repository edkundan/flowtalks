import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChatControls } from "@/components/chat-controls";
import { ChatInput } from "@/components/chat-input";
import { Play, Users } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const onlineUsers = 466;

  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate connection delay
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold text-primary">RandomChat</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="text-sm text-muted-foreground">{onlineUsers} online</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {!isConnected ? (
          <div className="text-center space-y-4 animate-fadeIn">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
              <Play className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold">Ready to Connect</h2>
            <p className="text-muted-foreground">
              Start a random conversation with someone new
            </p>
            <Button
              size="lg"
              className="mt-4 button-glow"
              disabled={isConnecting}
              onClick={handleConnect}
            >
              {isConnecting ? "Connecting..." : "Start Chat"}
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4 animate-fadeIn">
            <div className="glass rounded-lg p-8 min-h-[400px]">
              {/* Chat messages will go here */}
            </div>
            <ChatInput />
            <div className="flex justify-center">
              <ChatControls />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;