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
  Building2
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Receipt, label: "Transactions", href: "/transactions" },
  { icon: FileText, label: "Invoices", href: "/invoices" },
  { icon: FileText, label: "Quotes", href: "/quotes" },
  { icon: DollarSign, label: "Sales", href: "/sales" },
  { icon: CreditCard, label: "Purchase", href: "/purchase" },
  { icon: Building2, label: "Fixed Assets", href: "/fixed-assets" },
  { icon: Calculator, label: "Trial Balance", href: "/trial-balance" },
  { icon: TrendingUp, label: "Financial Reports", href: "/reports" },
  { icon: PieChart, label: "Analytics", href: "/analytics" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export const Sidebar = ({ open, onOpenChange }: SidebarProps) => {
  const location = useLocation();
  
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
              <span className="text-xl font-bold text-primary-foreground">A</span>
            </div>
            {open && (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-primary">ApexAccounts</span>
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
            <div className="h-8 w-8 rounded-full bg-gradient-accent" />
            {open && (
              <div className="flex-1">
                <p className="text-sm font-medium text-sidebar-foreground">John Doe</p>
                <p className="text-xs text-sidebar-foreground/70">Accountant</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};