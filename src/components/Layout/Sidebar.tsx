import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  { icon: CreditCard, label: "Payments", href: "/payments" },
  { icon: TrendingUp, label: "Financial Reports", href: "/reports" },
  { icon: Calculator, label: "VAT Management", href: "/vat" },
  { icon: DollarSign, label: "Tax Calculator", href: "/tax" },
  { icon: PieChart, label: "Analytics", href: "/analytics" },
  { icon: Users, label: "Clients", href: "/clients" },
  { icon: Building2, label: "Company", href: "/company" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export const Sidebar = ({ open, onOpenChange }: SidebarProps) => {
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            {open && (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-primary">SA Finance</span>
                <span className="text-xs text-sidebar-foreground/70">Manager</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200",
                !open && "justify-center px-2"
              )}
            >
              <item.icon className="h-5 w-5 text-sidebar-primary" />
              {open && (
                <span className="text-sidebar-foreground font-medium">
                  {item.label}
                </span>
              )}
            </Button>
          ))}
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