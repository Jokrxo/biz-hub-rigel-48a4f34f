import { useMemo, useState } from "react";
import stellaLogo from "@/assets/stellkhygugvyt.jpg";
import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { TopNavigation } from "./TopNavigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bot, Calculator, Calendar, Grip, HelpCircle, Search, Wrench, Zap } from "lucide-react";
import { StellaBotModal } from "@/components/Stella/StellaBotModal";
import { useLayout } from "@/context/LayoutContext";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QuickSetupSheet } from "./QuickSetupSheet";
import { HelpDialog } from "./HelpDialog";
import { DocumentationModal } from "@/components/Help/DocumentationModal";
import { FloatingCalculator } from "@/components/Tools/FloatingCalculator";
import { AdvancedCalendar } from "@/components/Tools/AdvancedCalendar";
import { StickyNoteBoard } from "@/components/Tools/StickyNoteBoard";
import { CurrencyConverter } from "@/components/Tools/CurrencyConverter";
import { TaskManager } from "@/components/Tools/TaskManager";
import { KeyboardShortcuts } from "@/components/Support/KeyboardShortcuts";
import { FeedbackModal } from "@/components/Support/FeedbackModal";
import { SupportAppModal } from "@/components/Support/SupportAppModal";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell = ({ children }: AppShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stellaOpen, setStellaOpen] = useState(false);
  const { layoutMode } = useLayout();

  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);

  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportAppOpen, setSupportAppOpen] = useState(false);

  const [toolsQuery, setToolsQuery] = useState("");

  const isHorizontal = layoutMode === 'horizontal';

  const toolItems = useMemo(
    () => [
      {
        key: "calculator",
        label: "Calculator",
        description: "Quick math on top of any screen",
        icon: Calculator,
        action: () => setCalculatorOpen(true),
      },
      {
        key: "tax-calendar",
        label: "Tax Calendar",
        description: "Deadlines and planning view",
        icon: Calendar,
        action: () => setCalendarOpen(true),
      },
      {
        key: "support-app",
        label: "Support App",
        description: "Notes, tasks, shortcuts and feedback",
        icon: Grip,
        action: () => setSupportAppOpen(true),
      },
      {
        key: "quick-setup",
        label: "Quick Setup",
        description: "Company setup checklist",
        icon: Zap,
        action: () => setQuickSetupOpen(true),
      },
      {
        key: "help-support",
        label: "Help & Support",
        description: "Docs, tutorials and support",
        icon: HelpCircle,
        action: () => setHelpOpen(true),
      },
    ],
    [],
  );

  const filteredToolItems = useMemo(() => {
    const q = toolsQuery.trim().toLowerCase();
    if (!q) return toolItems;
    return toolItems.filter((item) => {
      const haystack = `${item.label} ${item.description}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [toolItems, toolsQuery]);

  const openTool = (action: () => void) => {
    setToolsDrawerOpen(false);
    setToolsQuery("");
    action();
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {!isHorizontal && (
        <>
          <div className={cn("md:block", sidebarOpen ? "block" : "hidden")}> 
            <Sidebar open={sidebarOpen} />
          </div>
          <div
            className={cn(
              "fixed inset-0 bg-black/40 z-30 md:hidden",
              sidebarOpen ? "" : "hidden"
            )}
            onClick={() => setSidebarOpen(false)}
          />
        </>
      )}

      {isHorizontal && <TopNavigation />}
      
      <div
        className={cn(
          "transition-all duration-300 ease-in-out flex flex-col min-h-screen",
          !isHorizontal && "ml-0 md:ml-16",
          !isHorizontal && sidebarOpen && "md:ml-64"
        )}
      >
        {!isHorizontal && <DashboardHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
        
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

        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          <Dialog open={toolsDrawerOpen} onOpenChange={setToolsDrawerOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full shadow-lg border bg-background/80 backdrop-blur flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Tools
              </Button>
            </DialogTrigger>
            <DialogContent className="p-0 sm:max-w-xl overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-b from-background to-background/60">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    Tools & Support
                  </DialogTitle>
                  <DialogDescription>Everything you removed from the sidebar lives here.</DialogDescription>
                </DialogHeader>
                <div className="mt-4 relative">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={toolsQuery}
                    onChange={(e) => setToolsQuery(e.target.value)}
                    placeholder="Search tools..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="p-3 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  {filteredToolItems.map((item) => (
                    <Button
                      key={item.key}
                      variant="ghost"
                      className="w-full justify-start gap-3 h-auto py-3 px-3 rounded-xl hover:bg-accent"
                      onClick={() => openTool(item.action)}
                    >
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-medium truncate">{item.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                      </div>
                    </Button>
                  ))}
                  {filteredToolItems.length === 0 && (
                    <div className="text-sm text-muted-foreground px-2 py-8 text-center">
                      No matches for “{toolsQuery.trim()}”.
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            className="rounded-full shadow-lg bg-gradient-primary flex items-center gap-2"
            onClick={() => setStellaOpen(true)}
          >
            <Bot className="h-5 w-5" />
            Stella
          </Button>
        </div>

        <QuickSetupSheet open={quickSetupOpen} onOpenChange={setQuickSetupOpen} />
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} onOpenDocs={() => setDocumentationOpen(true)} />
        <DocumentationModal open={documentationOpen} onOpenChange={setDocumentationOpen} />
        <FloatingCalculator isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)} />
        <AdvancedCalendar isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} />
        <StickyNoteBoard isOpen={notesOpen} onClose={() => setNotesOpen(false)} />
        <CurrencyConverter isOpen={currencyOpen} onClose={() => setCurrencyOpen(false)} />
        <TaskManager isOpen={tasksOpen} onClose={() => setTasksOpen(false)} />
        <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        <SupportAppModal
          isOpen={supportAppOpen}
          onClose={() => setSupportAppOpen(false)}
          onOpenNotes={() => setNotesOpen(true)}
          onOpenCurrency={() => setCurrencyOpen(true)}
          onOpenTasks={() => setTasksOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />

        <StellaBotModal open={stellaOpen} onOpenChange={setStellaOpen} />
      </div>
    </div>
  );
};
