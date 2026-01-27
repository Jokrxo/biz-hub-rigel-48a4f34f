import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";
import { supabase } from "@/integrations/supabase/client";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Settings, CreditCard, LogOut, User, Building2 } from "lucide-react";
import { RateUsDialog } from "@/components/Support/RateUsDialog";

export const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [openAccount, setOpenAccount] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ name?: string; email?: string; plan?: string; status?: string; expiry?: string; license_key?: string; users_count?: number }>({});
  const { isAdmin, isAccountant, isManager } = useRoles();
  
  // Optimistic role display to prevent "User" flicker
  const [cachedRoles, setCachedRoles] = useState<string[]>([]);
  useEffect(() => {
    if (user?.id) {
        try {
            const cached = localStorage.getItem(`rigel_roles_${user.id}`);
            if (cached) setCachedRoles(JSON.parse(cached));
        } catch {}
    }
  }, [user?.id]);
  
  // Use cached roles if real roles are still loading or empty, otherwise use real roles
  const effectiveIsAdmin = isAdmin || cachedRoles.includes('administrator');
  const effectiveIsAccountant = isAccountant || cachedRoles.includes('accountant') || effectiveIsAdmin;
  const effectiveIsManager = isManager || cachedRoles.includes('manager') || effectiveIsAdmin;

  const [rateUsOpen, setRateUsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadCompanyInfo = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, first_name, last_name, email")
        .eq("user_id", user?.id)
        .single();
      if (profile) {
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", profile.company_id)
          .single();
        if (company) setCompanyName(company.name);
        const { count: usersCount } = await supabase
          .from("profiles")
          .select("id", { count: "exact" })
          .eq("company_id", profile.company_id)
          .limit(1);
        setAccountInfo({
          name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user?.user_metadata?.name,
          email: profile.email || user?.email || "",
          users_count: (usersCount as number) || 1,
        });
      }
    } catch (error) { console.error("Error loading company:", error); }
  }, [user?.id]);
  useEffect(() => { loadCompanyInfo(); }, [loadCompanyInfo]);

  const initials = (accountInfo.name || "U").charAt(0).toUpperCase();

  const rateUsKey = "rigel_rate_us_v1_done";

  const handleLogoutClick = async () => {
    if (loggingOut) return;
    if (!user?.id) {
      logout();
      return;
    }

    try {
      const localDone = typeof localStorage !== "undefined" ? localStorage.getItem(rateUsKey) === "1" : false;
      if (localDone) {
        logout();
        return;
      }
    } catch {}

    setLoggingOut(true);

    try {
      const { data } = await (supabase as any)
        .from("app_rating_responses")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.user_id) {
        try {
          localStorage.setItem(rateUsKey, "1");
        } catch {}
        logout();
        return;
      }
    } catch {
      try {
        const localDone = typeof localStorage !== "undefined" ? localStorage.getItem(rateUsKey) === "1" : false;
        if (localDone) {
          logout();
          return;
        }
      } catch {}
    }

    setRateUsOpen(true);
    setLoggingOut(false);
  };

  const persistRateUsResponse = async (payload: { rating: number | null; comment: string | null }) => {
    if (!user?.id) return;
    try {
      await (supabase as any)
        .from("app_rating_responses")
        .upsert(
          {
            user_id: user.id,
            rating: payload.rating,
            comment: payload.comment,
          },
          { onConflict: "user_id" },
        );
    } catch {}
  };

  const finishLogout = async () => {
    try {
      localStorage.setItem(rateUsKey, "1");
    } catch {}
    logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:bg-transparent focus-visible:ring-0">
          <Avatar className="h-9 w-9 border border-border shadow-sm ring-2 ring-transparent hover:ring-primary/20 transition-all">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={accountInfo.name} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2 animate-in slide-in-from-top-2 fade-in-20">
        <div className="flex items-center justify-start gap-3 p-2 bg-muted/30 rounded-md mb-1">
          <Avatar className="h-10 w-10 border border-border/50">
            <AvatarImage src={user?.user_metadata?.avatar_url} alt={accountInfo.name} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-0.5 leading-none">
            <p className="font-semibold text-sm text-foreground">
              {accountInfo.name || "User"}
              {effectiveIsAccountant && <span className="ml-2"><Badge variant="outline">Accountant</Badge></span>}
              {!effectiveIsAccountant && effectiveIsAdmin && <span className="ml-2"><Badge variant="outline">Administrator</Badge></span>}
              {!effectiveIsAccountant && !effectiveIsAdmin && effectiveIsManager && <span className="ml-2"><Badge variant="outline">Manager</Badge></span>}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{accountInfo.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer py-2.5">
          <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setOpenAccount(true)} className="cursor-pointer py-2.5">
          <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Account & Billing</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogoutClick} className="text-destructive cursor-pointer focus:text-destructive py-2.5 bg-destructive/5 focus:bg-destructive/10 mt-1">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <RateUsDialog
        open={rateUsOpen}
        onOpenChange={(nextOpen) => {
          setRateUsOpen(nextOpen);
          if (!nextOpen) setLoggingOut(false);
        }}
        onSkip={async () => {
          await persistRateUsResponse({ rating: null, comment: null });
          await finishLogout();
        }}
        onSubmit={async ({ rating, comment }) => {
          await persistRateUsResponse({ rating, comment: comment || null });
          await finishLogout();
        }}
      />

      <Dialog open={openAccount} onOpenChange={setOpenAccount}>
        <DialogContent className="sm:max-w-md">
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <img src="/logo.png" alt="Rigel Business" className="max-w-[60%] grayscale" />
          </div>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Account Overview
            </DialogTitle>
          </DialogHeader>
          <div className="relative space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Name</div>
                <div className="text-sm font-medium">{accountInfo.name || user?.user_metadata?.name || user?.email}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Email</div>
                <div className="text-sm font-medium truncate" title={accountInfo.email || user?.email}>{accountInfo.email || user?.email}</div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Company</div>
                <div className="text-sm font-medium flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  {companyName || '—'}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Users</div>
                <div className="text-sm font-medium">{accountInfo.users_count || 1}</div>
              </div>
            </div>
            <Separator />
            <div className="bg-muted/30 p-3 rounded-lg border border-border/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Plan</span>
                <Badge variant="outline" className="bg-background">{accountInfo.plan || '—'}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <Badge variant={accountInfo.status === 'ACTIVE' ? 'default' : 'secondary'}>{accountInfo.status || 'OPEN'}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Expires</span>
                <span className="font-mono">{accountInfo.expiry || '—'}</span>
              </div>
            </div>
            <div className="text-xs text-center text-muted-foreground">
              License Key: <span className="font-mono select-all bg-muted px-1 py-0.5 rounded">{(accountInfo.license_key || '').slice(0,4)}-****-****-{(accountInfo.license_key || '').slice(-4)}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
};
