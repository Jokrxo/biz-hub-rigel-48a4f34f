import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Menu, Search, Plus } from "lucide-react";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

export const DashboardHeader = ({ onMenuClick }: DashboardHeaderProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions, invoices, clients..."
            className="pl-10 bg-muted/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button className="bg-gradient-primary hover:opacity-90 transition-opacity">
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>

        <div className="relative">
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-xs">
              3
            </Badge>
          </Button>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium">ABC Trading (Pty) Ltd</p>
          <p className="text-xs text-muted-foreground">VAT: 4123456789</p>
        </div>
      </div>
    </header>
  );
};