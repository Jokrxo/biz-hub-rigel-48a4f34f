import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { Bell, Menu, Search, Plus, LogOut, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

const UserMenu = () => {
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (profile) {
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .single();

        if (company) setCompanyName(company.name);
      }
    } catch (error) {
      console.error("Error loading company:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex flex-col items-end">
          {companyName && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {companyName}
            </span>
          )}
          <span className="text-sm font-medium">{user?.user_metadata?.name || user?.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const DashboardHeader = ({ onMenuClick }: DashboardHeaderProps) => {
  const navigate = useNavigate();

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
        <Button 
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
          onClick={() => navigate('/transactions')}
        >
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

        <UserMenu />
      </div>
    </header>
  );
};