import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      </div>
    </div>
  );
};