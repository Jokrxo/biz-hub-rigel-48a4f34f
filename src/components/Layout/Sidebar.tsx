import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
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
  Crown
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Building, label: "Bank", href: "/bank" },
  { icon: Receipt, label: "Transactions", href: "/transactions" },
  { icon: FileText, label: "Invoices", href: "/invoices" },
  { icon: FileText, label: "Quotes", href: "/quotes" },
  { icon: DollarSign, label: "Sales", href: "/sales" },
  { icon: CreditCard, label: "Purchase", href: "/purchase" },
  { icon: Receipt, label: "Tax", href: "/tax" },
  { icon: Building2, label: "Fixed Assets", href: "/fixed-assets" },
  { icon: Calculator, label: "Trial Balance", href: "/trial-balance" },
  { icon: TrendingUp, label: "Financial Reports", href: "/reports" },
  { icon: Wallet, label: "Budget", href: "/budget" },
  { icon: CreditCard, label: "Loans", href: "/loans" },
  { icon: DollarSign, label: "Payroll", href: "/payroll" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Crown, label: "Billing", href: "/billing" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export const Sidebar = ({ open, onOpenChange }: SidebarProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null);

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

          const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(" ") || user.email?.split("@")[0] || "User";
          
          const role = roles?.role || "User";

          setUserProfile({ name: fullName, role });
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary animate-glow">
              <Calculator className="h-5 w-5 text-primary-foreground" />
            </div>
            {open && (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-primary">Rigel Business</span>
                <span className="text-xs text-sidebar-foreground/70">Enterprise</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.href} to={item.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200",
                    !open && "justify-center px-2",
                    isActive && "bg-sidebar-accent text-sidebar-primary font-semibold"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive ? "text-sidebar-primary" : "text-sidebar-foreground")} />
                  {open && (
                    <span className={cn("font-medium", isActive ? "text-sidebar-primary" : "text-sidebar-foreground")}>
                      {item.label}
                    </span>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className={cn("flex items-center gap-3", !open && "justify-center")}>
            <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center text-sidebar-foreground font-semibold text-sm">
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
            </div>
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
    </aside>
  );
};