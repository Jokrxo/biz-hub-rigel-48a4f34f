import { useState } from "react";
import stellaLogo from "@/assets/stellkhygugvyt.jpg";
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
      <div className={cn("md:block", sidebarOpen ? "block" : "hidden")}> 
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      </div>
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-30 md:hidden",
          sidebarOpen ? "" : "hidden"
        )}
        onClick={() => setSidebarOpen(false)}
      />
      
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          "ml-0 md:ml-16",
          sidebarOpen && "md:ml-64"
        )}
      >
        <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
            <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <img src={stellaLogo} alt="Stella Lumen" className="h-5 w-5 rounded object-cover border" />
              <span>Powered by Stella Lumen</span>
            </div>
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
