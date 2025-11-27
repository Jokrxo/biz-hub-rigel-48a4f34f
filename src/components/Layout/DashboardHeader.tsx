import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/useAuth";
import { Bell, Menu, Search, Plus, LogOut, Building2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface DashboardHeaderProps {
  onMenuClick: () => void;
}

const UserMenu = () => {
  const { user, logout } = useAuth();
  const [companyName, setCompanyName] = useState("");

  const loadCompanyInfo = useCallback(async () => {
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
    } catch (error) { console.error("Error loading company:", error); }
  }, [user?.id]);
  useEffect(() => { loadCompanyInfo(); }, [loadCompanyInfo]);


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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; description: string; created_at: string; read: boolean }>>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const unreadCount = notifications.filter(n => !n.read).length;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ type: string; label: string; sublabel?: string; navigateTo: string }>>([]);

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
            pushNotification(title, desc);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, (payload: any) => {
            const row: any = payload?.new || payload?.old || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            const status = String(row.status || '').toLowerCase();
            if (status === 'sent') {
              pushNotification('Invoice Sent', `Invoice ${row.invoice_number || row.id}`);
            } else if (status === 'paid') {
              pushNotification('Invoice Paid', `Invoice ${row.invoice_number || row.id}`);
            } else {
              pushNotification('Invoice Updated', `Invoice ${row.invoice_number || row.id}`);
            }
          })
          .on('postgres_changes', { event: 'insert', schema: 'public', table: 'bank_accounts' }, (payload: any) => {
            const row: any = payload?.new || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            pushNotification('Bank Account Added', `${row.bank_name || ''} • ${row.account_name || ''}`);
          })
          .on('postgres_changes', { event: 'insert', schema: 'public', table: 'chart_of_accounts' }, (payload: any) => {
            const row: any = payload?.new || {};
            if (row.company_id && row.company_id !== profile.company_id) return;
            pushNotification('Account Created', `${row.account_code || ''} • ${row.account_name || ''}`);
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
  }, [user?.id]);

  const pushNotification = (title: string, description: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNotifications(prev => [{ id, title, description, created_at: new Date().toISOString(), read: false }, ...prev].slice(0, 50));
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="relative w-full max-w-xs sm:max-w-md md:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions, invoices, customers..."
            className="pl-10 bg-muted/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') executeSearch(); }}
          />
          <Button variant="outline" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={executeSearch}>Search</Button>
          {searchOpen && (searchResults.length > 0 ? (
            <div className="absolute mt-2 w-full rounded-md border bg-background shadow z-50">
              {searchResults.map((r, idx) => (
                <button key={idx} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2" onClick={() => { navigate(r.navigateTo); setSearchOpen(false); }}>
                  <span className="text-xs text-muted-foreground">{r.type}</span>
                  <span className="text-sm font-medium">{r.label}</span>
                  {r.sublabel && <span className="ml-auto text-xs text-muted-foreground">{r.sublabel}</span>}
                </button>
              ))}
            </div>
          ) : (
            searchQuery && <div className="absolute mt-2 w-full rounded-md border bg-background shadow z-50 p-3 text-sm text-muted-foreground">No results</div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/settings')}>Profile</Button>

        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-destructive text-xs flex items-center justify-center">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
                  <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No notifications yet</div>
              ) : (
                notifications.slice(0, 10).map(n => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2 w-full">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      <span className="font-medium text-sm">{n.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground w-full">{n.description}</div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <UserMenu />
      </div>
    </header>
  );
};
