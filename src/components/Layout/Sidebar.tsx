import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useNavigate } from "react-router-dom";
import stellaLogo from "@/assets/stella-sign-up.jpg"; // Import the logo
import { 
  LayoutDashboard,  
  Receipt, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Calculator,
  Users,
  Settings,
  PieChart,
  CreditCard,
  Building2,
  Building,
  Wallet,
  Crown,
  Info,
  Zap,
  HelpCircle,
  BookOpen,
  Video,
  MessageSquare,
  Calendar,
  StickyNote,
  CheckSquare,
  Keyboard,
  MessageCircle,
  Bug,
  Grip
} from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuickSetupSheet } from "./QuickSetupSheet";
import { HelpDialog } from "./HelpDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import { StellaBotModal } from "@/components/Stella/StellaBotModal";
import { FloatingCalculator } from "@/components/Tools/FloatingCalculator";
import { StickyNoteBoard } from "@/components/Tools/StickyNoteBoard";
import { AdvancedCalendar } from "@/components/Tools/AdvancedCalendar";
import { CurrencyConverter } from "@/components/Tools/CurrencyConverter";
import { TaskManager } from "@/components/Tools/TaskManager";
import { KeyboardShortcuts } from "@/components/Support/KeyboardShortcuts";
import { FeedbackModal } from "@/components/Support/FeedbackModal";
import { SupportAppModal } from "@/components/Support/SupportAppModal";
import { DocumentationModal } from "@/components/Help/DocumentationModal"; // Import the new component

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { navGroups } from "@/config/navigation";

export const Sidebar = ({ open, onOpenChange }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  
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

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;

      try {
        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          // Get user role
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("company_id", profile.company_id)
            .maybeSingle();

          // Get company logo
          const { data: company } = await supabase
            .from("companies")
            .select("logo_url")
            .eq("id", profile.company_id)
            .maybeSingle();

          const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(" ") || user.email?.split("@")[0] || "User";
          
          const role = roles?.role || "User";

          setUserProfile({ name: fullName, role });
          setCompanyLogoUrl(company?.logo_url || null);
        } else {
          // Fallback to email if no profile
          setUserProfile({ 
            name: user.email?.split("@")[0] || "User", 
            role: "User" 
          });
        }
      } catch (error) {
        // Fallback to email if error
        setUserProfile({ 
          name: user.email?.split("@")[0] || "User", 
          role: "User" 
        });
      }
    };

    loadUserProfile();
  }, [user]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out bg-sidebar border-r border-sidebar-border shadow-elegant",
        open ? "w-64" : "w-16"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            {logoError ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary animate-glow">
                <Calculator className="h-5 w-5 text-primary-foreground" />
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="Rigel Business"
                className="h-10 w-10 rounded-lg object-cover"
                onError={() => setLogoError(true)}
              />
            )}
            {open && (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-primary">Rigel Business</span>
                <span className="text-xs text-sidebar-foreground/70">Enterprise</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 p-4 overflow-y-auto custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              {open && (
                <h3 className="px-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  {group.title}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link key={item.href} to={item.href}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                          !open && "justify-center px-2 h-10 w-10 mx-auto rounded-xl",
                          isActive 
                            ? "bg-sidebar-accent text-sidebar-primary shadow-sm font-medium" 
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
                        )}
                        title={!open ? item.label : undefined}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0 transition-transform duration-200", 
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                        {open && (
                          <span className="truncate">
                            {item.label}
                          </span>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Utilities Section */}
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            {open && <h3 className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Tools & Support</h3>}
            
            <Button
              variant="ghost"
              onClick={() => setCalculatorOpen(true)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                !open && "justify-center px-2"
              )}
              title="Calculator"
            >
              <Calculator className="h-5 w-5 text-emerald-500" />
              {open && <span className="font-medium text-sidebar-foreground">Calculator</span>}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setCalendarOpen(true)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                !open && "justify-center px-2"
              )}
              title="Tax Calendar"
            >
              <Calendar className="h-5 w-5 text-indigo-500" />
              {open && <span className="font-medium text-sidebar-foreground">Tax Calendar</span>}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setSupportAppOpen(true)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                !open && "justify-center px-2"
              )}
              title="Support App"
            >
              <Grip className="h-5 w-5 text-muted-foreground" />
              {open && <span className="font-medium text-sidebar-foreground">Support App</span>}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setQuickSetupOpen(true)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                !open && "justify-center px-2"
              )}
              title="Quick Setup"
            >
              <Zap className="h-5 w-5 text-amber-500" />
              {open && <span className="font-medium text-sidebar-foreground">Quick Setup</span>}
            </Button>

            <Button
              variant="ghost"
              onClick={() => setHelpOpen(true)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                !open && "justify-center px-2"
              )}
              title="Help & Support"
            >
              <HelpCircle className="h-5 w-5 text-blue-500" />
              {open && <span className="font-medium text-sidebar-foreground">Help & Support</span>}
            </Button>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className={cn("flex items-center gap-3", !open && "justify-center")}>
            {companyLogoUrl && !logoError ? (
              <img
                src={companyLogoUrl}
                alt="Company Logo"
                className="h-8 w-8 rounded-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center text-sidebar-foreground font-semibold text-sm">
                {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            {open && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {userProfile?.name || "User"}
                </p>
                <p className="text-xs text-sidebar-foreground/70 capitalize">
                  {userProfile?.role || "User"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Setup Sheet */}
      <QuickSetupSheet open={quickSetupOpen} onOpenChange={setQuickSetupOpen} />

      {/* Help Dialog */}
      <HelpDialog 
        open={helpOpen} 
        onOpenChange={setHelpOpen} 
        onOpenDocs={() => setDocumentationOpen(true)} 
      />

      <DocumentationModal open={documentationOpen} onOpenChange={setDocumentationOpen} />

      {/* Floating Calculator */}
      <FloatingCalculator isOpen={calculatorOpen} onClose={() => setCalculatorOpen(false)} />

      {/* Advanced Tax Calendar */}
      <AdvancedCalendar isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} />

      {/* Sticky Note Board */}
      <StickyNoteBoard isOpen={notesOpen} onClose={() => setNotesOpen(false)} />

      {/* Currency Converter */}
      <CurrencyConverter isOpen={currencyOpen} onClose={() => setCurrencyOpen(false)} />

      {/* Task Manager */}
      <TaskManager isOpen={tasksOpen} onClose={() => setTasksOpen(false)} />

      {/* Keyboard Shortcuts */}
      <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Feedback Modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {/* Support App Modal */}
      <SupportAppModal 
        isOpen={supportAppOpen} 
        onClose={() => setSupportAppOpen(false)} 
        onOpenNotes={() => setNotesOpen(true)}
        onOpenCurrency={() => setCurrencyOpen(true)}
        onOpenTasks={() => setTasksOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenFeedback={() => setFeedbackOpen(true)}
      />
    </aside>
  );
};
