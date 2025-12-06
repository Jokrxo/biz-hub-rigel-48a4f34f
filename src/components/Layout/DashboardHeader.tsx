import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Bell, Menu, Search, LogOut, Building2, Settings, User, CreditCard, PanelLeft, CheckCheck, Trash2, Info, CheckCircle2, AlertCircle, X, Calendar } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [openAccount, setOpenAccount] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ name?: string; email?: string; plan?: string; status?: string; expiry?: string; license_key?: string; users_count?: number }>({});

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
            <p className="font-semibold text-sm text-foreground">{accountInfo.name || "User"}</p>
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
        <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer focus:text-destructive py-2.5 bg-destructive/5 focus:bg-destructive/10 mt-1">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      <Dialog open={openAccount} onOpenChange={setOpenAccount}>
        <DialogContent className="sm:max-w-md">
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Business" className="max-w-[60%] grayscale" />
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

export const DashboardHeader = ({ onMenuClick }: DashboardHeaderProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; description: string; created_at: string; read: boolean; type?: 'info' | 'success' | 'warning' | 'error' }>>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ type: string; label: string; sublabel?: string; navigateTo: string }>>([]);

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const init = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user?.id)
          .maybeSingle();
        if (!profile?.company_id) return;
        setCompanyId(profile.company_id);

        const channel = (supabase as any)
          .channel('notifications')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload: any) => {
            const row: any = payload?.new || payload?.old || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            const status = String(row.status || '').toLowerCase();
            const title = status === 'approved' || status === 'posted' ? 'Transaction Posted' : 'Transaction Updated';
            const desc = `${row.description || 'Transaction'} • ${row.transaction_date || ''}`;
            const type = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info';
            pushNotification(title, desc, type);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, (payload: any) => {
            const row: any = payload?.new || payload?.old || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            const status = String(row.status || '').toLowerCase();
            if (status === 'sent') {
              pushNotification('Invoice Sent', `Invoice ${row.invoice_number || row.id}`, 'success');
            } else if (status === 'paid') {
              pushNotification('Invoice Paid', `Invoice ${row.invoice_number || row.id}`, 'success');
            } else {
              pushNotification('Invoice Updated', `Invoice ${row.invoice_number || row.id}`, 'info');
            }
          })
          .on('postgres_changes', { event: 'insert', schema: 'public', table: 'bank_accounts' }, (payload: any) => {
            const row: any = payload?.new || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            pushNotification('Bank Account Added', `${row.bank_name || ''} • ${row.account_name || ''}`, 'info');
          })
          .on('postgres_changes', { event: 'insert', schema: 'public', table: 'chart_of_accounts' }, (payload: any) => {
            const row: any = payload?.new || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            pushNotification('Account Created', `${row.account_code || ''} • ${row.account_name || ''}`, 'success');
          })
          .subscribe();

        return () => {
          (supabase as any).removeChannel(channel);
        };
      } catch (e) {
        // non-blocking
      }
    };
    init();

    // Reminder Check
    const checkReminders = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Get company_id efficiently
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (!profile?.company_id) return;
        const cid = profile.company_id;

        // 1. Check for Unallocated Transactions (pending/unposted)
        const { count: unallocatedCount, error: txError } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', cid)
          .in('status', ['pending', 'unposted']);

        if (!txError && unallocatedCount && unallocatedCount > 0) {
          const msg = `You have ${unallocatedCount} unallocated transactions requiring attention.`;
          pushNotification('Action Required', msg, 'warning');
          toast({
            title: "Unallocated Transactions",
            description: msg,
            action: <Button variant="outline" size="sm" onClick={() => navigate('/transactions')}>View</Button>,
          });
        }

        // 2. Check for Unpaid/Overdue Invoices
        const today = new Date().toISOString().split('T')[0];
        const { count: overdueCount, error: invError } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', cid)
          .neq('status', 'paid')
          .lt('due_date', today);

        if (!invError && overdueCount && overdueCount > 0) {
          const msg = `You have ${overdueCount} overdue invoices. Please follow up.`;
          pushNotification('Overdue Invoices', msg, 'error');
          toast({
            title: "Overdue Invoices",
            description: msg,
            variant: "destructive",
            action: <Button variant="outline" size="sm" className="bg-white text-black hover:bg-gray-100 border-none" onClick={() => navigate('/sales?tab=invoices')}>View</Button>,
          });
        }
      } catch (e) {
        console.error("Reminder check failed", e);
      }
    };

    // Run check after a short delay to ensure auth is ready
    const timeout = setTimeout(checkReminders, 2000);
    return () => clearTimeout(timeout);

  }, [user?.id, toast, navigate]);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Bell sound: sine wave with smooth decay
      osc.frequency.setValueAtTime(880, t); // A5
      osc.type = 'sine';
      
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.00001, t + 1);
      
      osc.start(t);
      osc.stop(t + 1);
    } catch (e) {
      console.error("Failed to play notification sound", e);
    }
  };

  const pushNotification = (title: string, description: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    playNotificationSound();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => [{ id, title, description, created_at: new Date().toISOString(), read: false, type }, ...prev].slice(0, 50));
  };

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      const q = (searchQuery || "").trim();
      if (!q) { setSearchResults([]); return; }
      try {
        const results: Array<{ type: string; label: string; sublabel?: string; navigateTo: string }> = [];
        const tx = await supabase
          .from('transactions')
          .select('id, description, transaction_date')
          .ilike('description', `%${q}%`)
          .limit(5);
        (tx.data || []).forEach((row: any) => {
          results.push({ type: 'Transaction', label: row.description || 'Transaction', sublabel: row.transaction_date || '', navigateTo: '/transactions' });
        });
        const inv = await supabase
          .from('invoices')
          .select('id, invoice_number, customer_name')
          .or(`invoice_number.ilike.%${q}%,customer_name.ilike.%${q}%`)
          .limit(5);
        (inv.data || []).forEach((row: any) => {
          results.push({ type: 'Invoice', label: row.invoice_number || String(row.id), sublabel: row.customer_name || '', navigateTo: '/sales?tab=invoices' });
        });
        const cust = await supabase
          .from('customers')
          .select('id, name, email')
          .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(5);
        (cust.data || []).forEach((row: any) => {
          results.push({ type: 'Customer', label: row.name || 'Customer', sublabel: row.email || '', navigateTo: '/customers' });
        });
        const items = await supabase
          .from('items')
          .select('id, name, description')
          .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
          .limit(5);
        (items.data || []).forEach((row: any) => {
          results.push({ type: 'Product', label: row.name || 'Item', sublabel: row.description || '', navigateTo: '/sales?tab=products' });
        });
        setSearchResults(results.slice(0, 10));
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const executeSearch = () => {
    setSearchOpen(true);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        
        <div className="relative w-full max-w-xs sm:max-w-md md:w-96 group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search transactions, invoices, customers..."
            className="pl-9 h-10 bg-muted/40 border-transparent focus:border-primary/20 focus:bg-background focus:ring-2 focus:ring-primary/10 transition-all rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') executeSearch(); }}
          />
          {searchOpen && (searchResults.length > 0 ? (
            <div className="absolute mt-2 w-full rounded-xl border bg-background shadow-xl ring-1 ring-black/5 z-50 overflow-hidden animate-in zoom-in-95 fade-in-50 duration-100">
              <div className="py-1">
                {searchResults.map((r, idx) => (
                  <button key={idx} className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center gap-3 transition-colors border-b last:border-0 border-border/50" onClick={() => { navigate(r.navigateTo); setSearchOpen(false); }}>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-5 font-normal">{r.type}</Badge>
                    <span className="text-sm font-medium truncate text-foreground">{r.label}</span>
                    {r.sublabel && <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">{r.sublabel}</span>}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            searchQuery && <div className="absolute mt-2 w-full rounded-xl border bg-background shadow-xl z-50 p-6 text-sm text-muted-foreground text-center animate-in zoom-in-95 fade-in-50 duration-100">No results found</div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setNotificationOpen(true)}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
          )}
        </Button>

        <Dialog open={notificationOpen} onOpenChange={setNotificationOpen}>
          <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl border shadow-2xl">
            <DialogHeader className="p-4 border-b bg-muted/10 flex flex-row items-center justify-between space-y-0">
               <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-semibold">Notifications</DialogTitle>
                  {unreadCount > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20">{unreadCount} new</Badge>}
               </div>
               {unreadCount > 0 && (
                 <Button variant="ghost" size="sm" onClick={markAllRead} className="h-8 text-xs gap-1.5 text-primary hover:text-primary/80 hover:bg-primary/5">
                   <CheckCheck className="h-3.5 w-3.5" />
                   Mark all as read
                 </Button>
               )}
            </DialogHeader>
            
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
               <div className="px-4 pt-2 border-b bg-muted/5">
                 <TabsList className="w-full justify-start h-9 bg-transparent p-0 gap-4">
                    <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-xs">All Notifications</TabsTrigger>
                    <TabsTrigger value="unread" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-xs">Unread</TabsTrigger>
                 </TabsList>
               </div>
               
               <TabsContent value="all" className="m-0">
                  <ScrollArea className="h-[400px]">
                     {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
                          <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
                            <Bell className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-sm font-medium text-foreground">No notifications</p>
                             <p className="text-xs text-muted-foreground">You're all caught up! Check back later.</p>
                          </div>
                        </div>
                     ) : (
                        <div className="flex flex-col">
                           {notifications.map(n => (
                              <div key={n.id} className={cn("flex gap-4 p-4 border-b last:border-0 hover:bg-muted/30 transition-colors relative group", !n.read && "bg-primary/5 hover:bg-primary/10")}>
                                 <div className={cn("mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 border", 
                                    n.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : 
                                    n.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-600" : 
                                    n.type === 'warning' ? "bg-amber-50 border-amber-100 text-amber-600" : 
                                    "bg-blue-50 border-blue-100 text-blue-600"
                                 )}>
                                    {n.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : 
                                     n.type === 'error' ? <AlertCircle className="h-4 w-4" /> : 
                                     n.type === 'warning' ? <AlertCircle className="h-4 w-4" /> : 
                                     <Info className="h-4 w-4" />}
                                 </div>
                                 <div className="flex-1 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                       <p className={cn("text-sm font-medium leading-none", !n.read && "text-primary")}>{n.title}</p>
                                       <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                                 </div>
                                 {!n.read && <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary" />}
                              </div>
                           ))}
                        </div>
                     )}
                  </ScrollArea>
               </TabsContent>
               
               <TabsContent value="unread" className="m-0">
                  <ScrollArea className="h-[400px]">
                     {notifications.filter(n => !n.read).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-4 space-y-3">
                          <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center">
                            <CheckCheck className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                          <div className="space-y-1">
                             <p className="text-sm font-medium text-foreground">No unread notifications</p>
                             <p className="text-xs text-muted-foreground">You've read everything important.</p>
                          </div>
                        </div>
                     ) : (
                        <div className="flex flex-col">
                           {notifications.filter(n => !n.read).map(n => (
                              <div key={n.id} className="flex gap-4 p-4 border-b last:border-0 bg-primary/5 hover:bg-primary/10 transition-colors relative">
                                 <div className={cn("mt-1 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 border", 
                                    n.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" : 
                                    n.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-600" : 
                                    n.type === 'warning' ? "bg-amber-50 border-amber-100 text-amber-600" : 
                                    "bg-blue-50 border-blue-100 text-blue-600"
                                 )}>
                                    {n.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : 
                                     n.type === 'error' ? <AlertCircle className="h-4 w-4" /> : 
                                     n.type === 'warning' ? <AlertCircle className="h-4 w-4" /> : 
                                     <Info className="h-4 w-4" />}
                                 </div>
                                 <div className="flex-1 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                       <p className="text-sm font-medium leading-none text-primary">{n.title}</p>
                                       <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </ScrollArea>
               </TabsContent>
            </Tabs>
            
            {notifications.length > 0 && (
              <div className="p-3 border-t bg-muted/10 flex justify-between items-center">
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8">
                   <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                   Clear all
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setNotificationOpen(false)} className="h-8 text-xs">
                   Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div className="h-8 w-px bg-border/50 mx-1 hidden sm:block" />

        <UserMenu />
      </div>
    </header>
  );
};
