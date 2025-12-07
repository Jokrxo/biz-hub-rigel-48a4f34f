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
          "transition-all duration-300 ease-in-out flex flex-col min-h-screen",
          "ml-0 md:ml-16",
          sidebarOpen && "md:ml-64"
        )}
      >
        <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="p-4 sm:p-6 flex-1">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>

        <footer className="border-t bg-card/50 backdrop-blur-sm py-6 mt-auto">
          <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
              <span>&copy; {new Date().getFullYear()} Rigel Business. All rights reserved.</span>
              <span className="hidden md:inline text-muted-foreground/30">|</span>
              <div className="flex gap-4">
                <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-primary transition-colors">Support</a>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="opacity-70">Powered by</span>
              <div className="flex items-center gap-2 font-medium text-foreground bg-background/50 px-2 py-1 rounded-md border shadow-sm">
                <img src={stellaLogo} alt="Stella Lumen" className="h-4 w-4 rounded-full object-cover" />
                <span>Stella Lumen</span>
              </div>
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                v2.5.0
              </span>
            </div>
          </div>
        </footer>

        <Button
          className="fixed bottom-6 right-6 rounded-full shadow-lg bg-gradient-primary flex items-center gap-2 z-50"
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
