import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner = ({ className, size = "md" }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative">
        {/* Transformer-inspired loader */}
        <div className={cn("relative", sizeClasses[size])}>
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-spin" 
               style={{ animationDuration: "2s" }} />
          
          {/* Middle ring */}
          <div className="absolute inset-2 rounded-full border-4 border-accent/40 animate-spin" 
               style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
          
          {/* Inner core */}
          <div className="absolute inset-4 rounded-full bg-gradient-primary animate-pulse" />
          
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src="/Modern Rigel Business Logo Design.png"
              alt="Rigel Business"
              className="w-2/3 h-2/3 rounded-full object-cover"
              onError={(e) => { (e.currentTarget.style.display = 'none'); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const PageLoader = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Rigel Business
          </h2>
          <p className="text-sm text-muted-foreground animate-pulse">Loading your workspace...</p>
        </div>
      </div>
    </div>
  );
};
