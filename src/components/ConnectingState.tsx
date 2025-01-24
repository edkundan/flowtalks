import { Loader2 } from "lucide-react";

export const ConnectingState = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 animate-fadeIn">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
        <div className="relative rounded-full p-4 bg-primary/30">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
      <h2 className="text-2xl font-semibold text-primary animate-pulse">
        Connecting with partner...
      </h2>
      <p className="text-muted-foreground">
        Please wait while we find someone for you
      </p>
    </div>
  );
};