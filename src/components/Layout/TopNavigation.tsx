import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { navGroups } from "@/config/navigation";
import { UserMenu } from "./UserMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, 
  Calculator, 
  Calendar, 
  Grip, 
  Zap, 
  HelpCircle 
} from "lucide-react";
import { useState } from "react";

// Tool Components
import { QuickSetupSheet } from "./QuickSetupSheet";
import { HelpDialog } from "./HelpDialog";
import { FloatingCalculator } from "@/components/Tools/FloatingCalculator";
import { AdvancedCalendar } from "@/components/Tools/AdvancedCalendar";
import { StickyNoteBoard } from "@/components/Tools/StickyNoteBoard";
import { CurrencyConverter } from "@/components/Tools/CurrencyConverter";
import { TaskManager } from "@/components/Tools/TaskManager";
import { KeyboardShortcuts } from "@/components/Support/KeyboardShortcuts";
import { FeedbackModal } from "@/components/Support/FeedbackModal";
import { SupportAppModal } from "@/components/Support/SupportAppModal";
import { DocumentationModal } from "@/components/Help/DocumentationModal";

export const TopNavigation = () => {
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);

  // Utilities state
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [documentationOpen, setDocumentationOpen] = useState(false);
  
  // Tools state
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportAppOpen, setSupportAppOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (items: { href: string }[]) => items.some(item => isActive(item.href));

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl mr-4">
              {logoError ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
                  <Calculator className="h-4 w-4 text-primary-foreground" />
                </div>
              ) : (
                <img 
                  src="/logo.png" 
                  alt="Rigel" 
                  className="h-8 w-8 rounded-lg object-cover" 
                  onError={() => setLogoError(true)}
                />
              )}
              <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Rigel
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navGroups.map((group) => (
                <DropdownMenu key={group.title}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "h-9 px-4 py-2 group gap-1 font-medium",
                        isGroupActive(group.items) 
                          ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" 
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      {group.title}
                      <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 p-2">
                    {group.items.map((item) => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          to={item.href}
                          className={cn(
                            "flex items-center gap-2 cursor-pointer rounded-md px-2 py-2 text-sm transition-colors",
                            isActive(item.href) 
                              ? "bg-primary/10 text-primary font-medium" 
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}

              {/* Tools & Support Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="h-9 px-4 py-2 group gap-1 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Tools & Support
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-2">
                  <DropdownMenuItem onClick={() => setCalculatorOpen(true)} className="cursor-pointer">
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculator
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCalendarOpen(true)} className="cursor-pointer">
                    <Calendar className="mr-2 h-4 w-4" />
                    Tax Calendar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSupportAppOpen(true)} className="cursor-pointer">
                    <Grip className="mr-2 h-4 w-4" />
                    Support App
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQuickSetupOpen(true)} className="cursor-pointer">
                    <Zap className="mr-2 h-4 w-4" />
                    Quick Setup
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setHelpOpen(true)} className="cursor-pointer">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Help & Support
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Tool Modals */}
      <QuickSetupSheet open={quickSetupOpen} onOpenChange={setQuickSetupOpen} />
      
      <HelpDialog 
        open={helpOpen} 
        onOpenChange={setHelpOpen} 
        onOpenDocs={() => setDocumentationOpen(true)} 
      />

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
    </>
  );
};
