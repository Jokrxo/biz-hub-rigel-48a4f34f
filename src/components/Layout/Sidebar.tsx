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
  MessageSquare
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { StellaBotModal } from "@/components/Stella/StellaBotModal";
import { DocumentationModal } from "@/components/Help/DocumentationModal"; // Import the new component

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navGroups = [
  {
    title: "Overview",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/" },
      { icon: Receipt, label: "Transactions", href: "/transactions" },
      { icon: Building, label: "Bank", href: "/bank" },
    ]
  },
  {
    title: "Accounting",
    items: [
      { icon: Receipt, label: "Tax", href: "/tax" },
      { icon: Building2, label: "Fixed Assets", href: "/fixed-assets" },
      { icon: Calculator, label: "Trial Balance", href: "/trial-balance" },
      { icon: TrendingUp, label: "Financial Reports", href: "/reports" },
      { icon: Wallet, label: "Budget", href: "/budget" },
      { icon: CreditCard, label: "Loans", href: "/loans" },
      { icon: PieChart, label: "Investments", href: "/investments" },
      { icon: DollarSign, label: "Payroll", href: "/payroll" },
    ]
  },
  {
    title: "Sales & Purchase",
    items: [
      { icon: FileText, label: "Invoices", href: "/invoices" },
      { icon: FileText, label: "Quotes", href: "/quotes" },
      { icon: DollarSign, label: "Sales", href: "/sales" },
      { icon: CreditCard, label: "Purchase", href: "/purchase" },
      { icon: Users, label: "Customers", href: "/customers" },
    ]
  },
  {
    title: "System",
    items: [
      { icon: Crown, label: "License", href: "/license" },
      { icon: Settings, label: "Settings", href: "/settings" },
      { icon: Info, label: "About", href: "/about-us" },
    ]
  }
];

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
  const [setupStatus, setSetupStatus] = useState({
    hasCoa: false,
    hasBank: false,
    hasProducts: false,
    hasCustomers: false,
    hasSuppliers: false,
    hasEmployees: false
  });

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

          // Load setup status
          if (profile.company_id) {
            const ac = new AbortController();
            const { count: coaCount } = await supabase.from("chart_of_accounts").select("id", { count: "exact" }).eq("company_id", profile.company_id).eq("is_active", true).limit(1);
            const { count: banksCount } = await supabase.from("bank_accounts").select("id", { count: "exact" }).eq("company_id", profile.company_id).limit(1);
            const { count: productsCount } = await supabase.from("items").select("id", { count: "exact" }).eq("company_id", profile.company_id).eq("item_type", "product").limit(1);
            const { count: customersCount } = await supabase.from("customers").select("id", { count: "exact" }).eq("company_id", profile.company_id).limit(1);
            const { count: suppliersCount } = await supabase.from("suppliers").select("id", { count: "exact" }).eq("company_id", profile.company_id).limit(1);
            const { count: employeesCount } = await supabase.from("employees").select("id", { count: "exact" }).eq("company_id", profile.company_id).limit(1);
            
            setSetupStatus({
              hasCoa: (coaCount || 0) > 0,
              hasBank: (banksCount || 0) > 0,
              hasProducts: (productsCount || 0) > 0,
              hasCustomers: (customersCount || 0) > 0,
              hasSuppliers: (suppliersCount || 0) > 0,
              hasEmployees: (employeesCount || 0) > 0
            });
          }
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
                src="/Modern Rigel Business Logo Design.png"
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
            {open && <h3 className="px-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Utilities</h3>}
            
            <Button
              variant="ghost"
              onClick={() => setQuickSetupOpen(true)}
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1",
                !open && "justify-center px-2"
              )}
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
      <Sheet open={quickSetupOpen} onOpenChange={setQuickSetupOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto z-50">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Company Setup
            </SheetTitle>
            <SheetDescription>Add core records to get your business up and running.</SheetDescription>
          </SheetHeader>
          <div className="relative space-y-4 mt-6">
            {/* Watermark */}
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none">
               <img src={stellaLogo} alt="Watermark" className="w-2/3 h-auto object-contain" />
            </div>
            <div className="grid gap-3 relative z-10">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Chart of Accounts</div>
                    <div className="text-xs text-muted-foreground">Define your ledger accounts</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={setupStatus.hasCoa ? 'default' : 'outline'}>{setupStatus.hasCoa ? 'Done' : 'Pending'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { navigate('/transactions?tab=chart'); setQuickSetupOpen(false); }}>Go</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Bank Account</div>
                    <div className="text-xs text-muted-foreground">Connect your business bank</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={setupStatus.hasBank ? 'default' : 'outline'}>{setupStatus.hasBank ? 'Done' : 'Pending'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { navigate('/bank'); setQuickSetupOpen(false); }}>Go</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Products & Services</div>
                    <div className="text-xs text-muted-foreground">Add items you sell</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={setupStatus.hasProducts ? 'default' : 'outline'}>{setupStatus.hasProducts ? 'Done' : 'Pending'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { navigate('/sales?tab=products'); setQuickSetupOpen(false); }}>Go</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Customers</div>
                    <div className="text-xs text-muted-foreground">Add your clients</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={setupStatus.hasCustomers ? 'default' : 'outline'}>{setupStatus.hasCustomers ? 'Done' : 'Pending'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { navigate('/customers'); setQuickSetupOpen(false); }}>Go</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Suppliers</div>
                    <div className="text-xs text-muted-foreground">Add your vendors</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={setupStatus.hasSuppliers ? 'default' : 'outline'}>{setupStatus.hasSuppliers ? 'Done' : 'Pending'}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { navigate('/purchase'); setQuickSetupOpen(false); }}>Go</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Help & Support
            </DialogTitle>
            <DialogDescription>
              Get assistance with Rigel Business
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button variant="outline" className="h-auto py-4 justify-start gap-4" onClick={() => { setHelpOpen(false); setDocumentationOpen(true); }}>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Documentation</div>
                <div className="text-xs text-muted-foreground">Read guides and API docs</div>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto py-4 justify-start gap-4" onClick={() => { setHelpOpen(false); setDocumentationOpen(true); }}>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                <Video className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Video Tutorials</div>
                <div className="text-xs text-muted-foreground">Watch how-to videos</div>
              </div>
            </Button>

            <Button variant="outline" className="h-auto py-4 justify-start gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Contact Support</div>
                <div className="text-xs text-muted-foreground">Chat with our team</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentationModal open={documentationOpen} onOpenChange={setDocumentationOpen} />
    </aside>
  );
};
