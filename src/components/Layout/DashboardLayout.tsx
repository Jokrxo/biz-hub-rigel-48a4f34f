import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { StellaBotModal } from "@/components/Stella/StellaBotModal";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stellaOpen, setStellaOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>

        <Button
          className="fixed bottom-6 right-6 rounded-full shadow-lg bg-gradient-primary flex items-center gap-2"
          onClick={() => setStellaOpen(true)}
        >
          <Bot className="h-5 w-5" />
          Stella
        </Button>
        <StellaBotModal open={stellaOpen} onOpenChange={setStellaOpen} />
      </div>
    </div>
  );
};