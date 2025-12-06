import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, BookOpen, Search, RefreshCw, Wallet, CreditCard, PieChart, TrendingUp, TrendingDown, Filter, LayoutGrid, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

const SA_CHART_OF_ACCOUNTS = [
  // Assets (1000-1999)
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1010", name: "Petty Cash", type: "asset" },
  { code: "1020", name: "Cash Float", type: "asset" },
  { code: "1100", name: "Standard Bank - Current Account", type: "asset" },
  { code: "1110", name: "FNB - Current Account", type: "asset" },
  { code: "1120", name: "ABSA - Current Account", type: "asset" },
  { code: "1130", name: "Nedbank - Current Account", type: "asset" },
  { code: "1140", name: "Capitec - Current Account", type: "asset" },
  { code: "1150", name: "Bank - Savings Account", type: "asset" },
  { code: "1160", name: "Bank - Investment Account", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1210", name: "Allowance for Doubtful Debts", type: "asset" },
  { code: "1220", name: "Notes Receivable", type: "asset" },
  { code: "1230", name: "Interest Receivable", type: "asset" },
  { code: "1300", name: "Inventory - Raw Materials", type: "asset" },
  { code: "1310", name: "Inventory - Work in Progress", type: "asset" },
  { code: "1320", name: "Inventory - Finished Goods", type: "asset" },
  { code: "1330", name: "Inventory - Consumables", type: "asset" },
  { code: "1340", name: "Inventory - Spare Parts", type: "asset" },
  { code: "1400", name: "Prepaid Expenses", type: "asset" },
  { code: "1410", name: "Prepaid Rent", type: "asset" },
  { code: "1420", name: "Prepaid Insurance", type: "asset" },
  { code: "1430", name: "Deposits Paid", type: "asset" },
  { code: "1500", name: "Land", type: "asset" },
  { code: "1510", name: "Buildings", type: "asset" },
  { code: "1520", name: "Accumulated Depreciation - Buildings", type: "asset" },
  { code: "1530", name: "Plant & Machinery", type: "asset" },
  { code: "1540", name: "Accumulated Depreciation - Plant", type: "asset" },
  { code: "1600", name: "Motor Vehicles", type: "asset" },
  { code: "1610", name: "Accumulated Depreciation - Vehicles", type: "asset" },
  { code: "1700", name: "Furniture & Fixtures", type: "asset" },
  { code: "1710", name: "Accumulated Depreciation - Furniture", type: "asset" },
  { code: "1800", name: "Computer Equipment", type: "asset" },
  { code: "1810", name: "Accumulated Depreciation - Computers", type: "asset" },
  { code: "1820", name: "Computer Software", type: "asset" },
  { code: "1830", name: "Accumulated Amortization - Software", type: "asset" },
  { code: "1900", name: "Goodwill", type: "asset" },
  { code: "1910", name: "Patents & Trademarks", type: "asset" },
  { code: "1920", name: "Long-term Investments", type: "asset" },
  
  // Liabilities (2000-2999)
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2010", name: "Trade Creditors", type: "liability" },
  { code: "2100", name: "VAT Output (15%)", type: "liability" },
  { code: "2110", name: "VAT Input", type: "liability" },
  { code: "2120", name: "VAT Control Account", type: "liability" },
  { code: "2200", name: "PAYE Payable", type: "liability" },
  { code: "2210", name: "UIF Payable", type: "liability" },
  { code: "2220", name: "SDL Payable (Skills Development Levy)", type: "liability" },
  { code: "2230", name: "Provident Fund Payable", type: "liability" },
  { code: "2240", name: "Medical Aid Payable", type: "liability" },
  { code: "2250", name: "Pension Fund Payable", type: "liability" },
  { code: "2300", name: "Short-term Loan", type: "liability" },
  { code: "2310", name: "Bank Overdraft", type: "liability" },
  { code: "2320", name: "Credit Card Payable", type: "liability" },
  { code: "2400", name: "Long-term Loan", type: "liability" },
  { code: "2410", name: "Mortgage Payable", type: "liability" },
  { code: "2420", name: "Vehicle Finance", type: "liability" },
  { code: "2500", name: "Accrued Expenses", type: "liability" },
  { code: "2510", name: "Accrued Salaries", type: "liability" },
  { code: "2520", name: "Accrued Interest", type: "liability" },
  { code: "2600", name: "Deferred Revenue", type: "liability" },
  { code: "2700", name: "Provisions", type: "liability" },
  
  // Equity (3000-3999)
  { code: "3000", name: "Owner's Capital", type: "equity" },
  { code: "3100", name: "Share Capital", type: "equity" },
  { code: "3200", name: "Retained Earnings", type: "equity" },
  { code: "3300", name: "Current Year Earnings", type: "equity" },
  { code: "3400", name: "Drawings", type: "equity" },
  { code: "3500", name: "Dividends Declared", type: "equity" },
  
  // Revenue/Income (4000-4999)
  { code: "4000", name: "Sales Revenue - Local", type: "revenue" },
  { code: "4010", name: "Sales Revenue - Export", type: "revenue" },
  { code: "4100", name: "Service Revenue", type: "revenue" },
  { code: "4110", name: "Consulting Revenue", type: "revenue" },
  { code: "4120", name: "Professional Fees", type: "revenue" },
  { code: "4200", name: "Interest Income", type: "revenue" },
  { code: "4210", name: "Dividend Income", type: "revenue" },
  { code: "4300", name: "Other Income", type: "revenue" },
  { code: "4310", name: "Sundry Income", type: "revenue" },
  { code: "4400", name: "Rental Income", type: "revenue" },
  { code: "4500", name: "Commission Income", type: "revenue" },
  { code: "4600", name: "Discount Received", type: "revenue" },
  { code: "4700", name: "Foreign Exchange Gain", type: "revenue" },
  
  // Cost of Sales (5000-5999)
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Purchases - Local", type: "expense" },
  { code: "5110", name: "Purchases - Import", type: "expense" },
  { code: "5200", name: "Freight & Delivery Inwards", type: "expense" },
  { code: "5300", name: "Direct Labour", type: "expense" },
  { code: "5400", name: "Manufacturing Overheads", type: "expense" },
  { code: "5500", name: "Inventory Adjustments", type: "expense" },
  { code: "5600", name: "Opening Stock", type: "expense" },
  { code: "5700", name: "Closing Stock", type: "expense" },
  
  // Operating Expenses (6000-6999)
  { code: "6000", name: "Salaries & Wages", type: "expense" },
  { code: "6010", name: "Management Salaries", type: "expense" },
  { code: "6020", name: "Staff Salaries", type: "expense" },
  { code: "6030", name: "Overtime", type: "expense" },
  { code: "6040", name: "Bonuses", type: "expense" },
  { code: "6050", name: "Commission Paid", type: "expense" },
  { code: "6100", name: "Rent Expense", type: "expense" },
  { code: "6110", name: "Rates & Taxes", type: "expense" },
  { code: "6120", name: "Levies", type: "expense" },
  { code: "6200", name: "Utilities - Electricity", type: "expense" },
  { code: "6210", name: "Utilities - Water", type: "expense" },
  { code: "6220", name: "Utilities - Gas", type: "expense" },
  { code: "6300", name: "Telephone & Internet", type: "expense" },
  { code: "6310", name: "Postage & Courier", type: "expense" },
  { code: "6400", name: "Insurance - General", type: "expense" },
  { code: "6410", name: "Insurance - Vehicle", type: "expense" },
  { code: "6420", name: "Insurance - Public Liability", type: "expense" },
  { code: "6500", name: "Motor Vehicle Expenses", type: "expense" },
  { code: "6510", name: "Vehicle Maintenance", type: "expense" },
  { code: "6520", name: "Vehicle License", type: "expense" },
  { code: "6600", name: "Fuel & Oil", type: "expense" },
  { code: "6700", name: "Repairs & Maintenance - Building", type: "expense" },
  { code: "6710", name: "Repairs & Maintenance - Equipment", type: "expense" },
  { code: "6800", name: "Office Supplies", type: "expense" },
  { code: "6810", name: "Stationery & Printing", type: "expense" },
  { code: "6820", name: "Cleaning & Hygiene", type: "expense" },
  { code: "6900", name: "Bank Charges", type: "expense" },
  { code: "6910", name: "Accounting Fees", type: "expense" },
  { code: "6920", name: "Legal Fees", type: "expense" },
  { code: "6930", name: "Consulting Fees", type: "expense" },
  { code: "6940", name: "Audit Fees", type: "expense" },
  { code: "7000", name: "Advertising & Marketing", type: "expense" },
  { code: "7010", name: "Website & Digital Marketing", type: "expense" },
  { code: "7020", name: "Promotions", type: "expense" },
  { code: "7100", name: "Training & Development", type: "expense" },
  { code: "7110", name: "Staff Welfare", type: "expense" },
  { code: "7120", name: "Recruitment", type: "expense" },
  { code: "7200", name: "Travel & Accommodation", type: "expense" },
  { code: "7210", name: "Meals & Entertainment", type: "expense" },
  { code: "7300", name: "Subscriptions & Memberships", type: "expense" },
  { code: "7310", name: "Licenses & Permits", type: "expense" },
  { code: "7400", name: "Depreciation Expense", type: "expense" },
  { code: "7410", name: "Amortization Expense", type: "expense" },
  { code: "7500", name: "Bad Debts", type: "expense" },
  { code: "7510", name: "Provision for Bad Debts", type: "expense" },
  { code: "7600", name: "Donations & Sponsorships", type: "expense" },
  { code: "7700", name: "Security Services", type: "expense" },
  { code: "7800", name: "Interest Expense", type: "expense" },
  { code: "7900", name: "Foreign Exchange Loss", type: "expense" },
  { code: "8000", name: "Sundry Expenses", type: "expense" },
];

export const ChartOfAccountsManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const TRANSACTION_TYPES = [
    { key: "deposit", label: "Deposit" },
    { key: "payment", label: "Payment" },
    { key: "expense", label: "Expense" },
    { key: "income", label: "Income" },
    { key: "transfer", label: "Transfer" },
  ];
  const [mappings] = useState<Record<string, { debit_account_id: string | null; credit_account_id: string | null }>>({});
  
  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "asset",
  });

  const loadAccounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (!profile) {
        toast({ title: "Error", description: "Company profile not found", variant: "destructive" });
        return;
      }
      setCompanyId(String((profile as any).company_id || ""));
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("account_code");
      setAccounts(data || []);
    } catch {}
  }, []);
  const loadMappings = useCallback(async () => {
    try {
      // Mapping persistence not available; feature disabled until backend support exists
      return;
    } catch {}
  }, []);
  useEffect(() => {
    loadAccounts();
    loadMappings();
  }, [loadAccounts, loadMappings]);

  

  const saveMappings = async () => {
    try {
      toast({ title: "Unavailable", description: "Saving mappings is currently unsupported.", variant: "destructive" });
    } catch {}
  };

  const loadSAChartOfAccounts = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", authUser.id)
        .single();

      if (!profile) {
        toast({ title: "Error", description: "Company profile not found", variant: "destructive" });
        return;
      }

      // Check if accounts already exist
      const { data: existing } = await supabase
        .from("chart_of_accounts")
        .select("account_code")
        .eq("company_id", profile.company_id);

      const existingCodes = new Set(existing?.map(a => a.account_code) || []);
      
      // Filter out accounts that already exist
      const newAccounts = SA_CHART_OF_ACCOUNTS.filter(acc => !existingCodes.has(acc.code));

      if (newAccounts.length === 0) {
        toast({ title: "Info", description: "All SA chart of accounts are already loaded" });
        return;
      }

      const accountsToInsert = newAccounts.map(acc => ({
        company_id: profile.company_id,
        account_code: acc.code,
        account_name: acc.name,
        account_type: acc.type,
        is_active: true,
      }));

      const { error } = await supabase
        .from("chart_of_accounts")
        .insert(accountsToInsert);

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `Added ${newAccounts.length} SA chart of accounts` 
      });
      loadAccounts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.account_code || !formData.account_name) {
        toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) return;

      if (editingAccount) {
        const { error } = await supabase
          .from("chart_of_accounts")
          .update({
            account_code: formData.account_code,
            account_name: formData.account_name,
            account_type: formData.account_type,
          })
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast({ title: "Success", description: "Account updated successfully" });
      } else {
        const { error } = await supabase
          .from("chart_of_accounts")
          .insert({
            company_id: profile.company_id,
            account_code: formData.account_code,
            account_name: formData.account_name,
            account_type: formData.account_type,
            is_active: true,
          });

        if (error) throw error;
        toast({ title: "Success", description: "Account created successfully" });
      }

      setIsDialogOpen(false);
      setEditingAccount(null);
      setFormData({ account_code: "", account_name: "", account_type: "asset" });
      loadAccounts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;

    try {
      const acc = accounts.find(a => a.id === id);
      if (acc) {
        const code = String(acc.account_code || '').trim();
        const name = String(acc.account_name || '').toLowerCase();
        const isAsset = String(acc.account_type || '').toLowerCase() === 'asset';
        const isFixedAssetFamily = code.startsWith('15') || name.includes('accumulated depreciation') || name.includes('accumulated amortization') || name.includes('land') || name.includes('building') || name.includes('plant') || name.includes('machinery') || name.includes('vehicle') || name.includes('furniture') || name.includes('equipment') || name.includes('computer') || name.includes('software') || name.includes('goodwill');
        if (isAsset && isFixedAssetFamily) {
          toast({ title: "Protected Account", description: "Fixed asset accounts cannot be deleted.", variant: "destructive" });
          return;
        }
      }
      const { error } = await supabase
        .from("chart_of_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Account deleted successfully" });
      loadAccounts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleActive = async (account: Account) => {
    try {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update({ is_active: !account.is_active })
        .eq("id", account.id);

      if (error) throw error;
      toast({ title: "Success", description: `Account ${account.is_active ? 'deactivated' : 'activated'}` });
      loadAccounts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.account_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.account_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || acc.account_type.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesType;
  });

  const accountsByType = {
    Assets: filteredAccounts.filter(a => a.account_type === "asset").length,
    Liabilities: filteredAccounts.filter(a => a.account_type === "liability").length,
    Equity: filteredAccounts.filter(a => a.account_type === "equity").length,
    Revenue: filteredAccounts.filter(a => a.account_type === "revenue").length,
    Expenses: filteredAccounts.filter(a => a.account_type === "expense").length,
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset': return Wallet;
      case 'liability': return CreditCard;
      case 'equity': return PieChart;
      case 'revenue': case 'income': return TrendingUp;
      case 'expense': return TrendingDown;
      default: return Filter;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'asset': return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case 'liability': return "text-rose-600 bg-rose-50 border-rose-200";
      case 'equity': return "text-blue-600 bg-blue-50 border-blue-200";
      case 'revenue': case 'income': return "text-indigo-600 bg-indigo-50 border-indigo-200";
      case 'expense': return "text-amber-600 bg-amber-50 border-amber-200";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Chart of Accounts</h2>
          <p className="text-muted-foreground">Manage your accounting structure and codes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadSAChartOfAccounts} className="h-9">
            <BookOpen className="h-4 w-4 mr-2" />
            Load SA Template
          </Button>
          <Button variant="outline" size="sm" onClick={loadAccounts} className="h-9">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary h-9" onClick={() => {
                setEditingAccount(null);
                setFormData({ account_code: "", account_name: "", account_type: "asset" });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Edit Account" : "Create New Account"}</DialogTitle>
                <DialogDescription>
                  {editingAccount ? "Modify the details of the existing account." : "Add a new account to your chart of accounts."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account Code *</Label>
                    <Input
                      value={formData.account_code}
                      onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                      placeholder="e.g., 1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Type *</Label>
                    <Select value={formData.account_type} onValueChange={(val) => setFormData({ ...formData, account_type: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset">Asset</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                        <SelectItem value="equity">Equity</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Account Name *</Label>
                  <Input
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="e.g., Cash on Hand"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} className="bg-gradient-primary">
                  {editingAccount ? "Save Changes" : "Create Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {Object.entries(accountsByType).map(([type, count]) => {
           const Icon = getTypeIcon(type === 'Assets' ? 'asset' : type === 'Liabilities' ? 'liability' : type === 'Equity' ? 'equity' : type === 'Revenue' ? 'revenue' : 'expense');
           const colorClass = getTypeColor(type === 'Assets' ? 'asset' : type === 'Liabilities' ? 'liability' : type === 'Equity' ? 'equity' : type === 'Revenue' ? 'revenue' : 'expense');
           
           return (
            <Card key={type} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{type}</p>
                  <div className="text-2xl font-bold">{count}</div>
                </div>
                <div className={cn("p-2 rounded-full border", colorClass.replace('text-', 'bg-opacity-10 text-'))}>
                  <Icon className={cn("h-5 w-5", colorClass.split(' ')[0])} />
                </div>
              </CardContent>
            </Card>
           );
        })}
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
        {/* Advanced Filters */}
        <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Accounts', icon: LayoutGrid },
              { id: 'asset', label: 'Assets', icon: Wallet },
              { id: 'liability', label: 'Liabilities', icon: CreditCard },
              { id: 'equity', label: 'Equity', icon: PieChart },
              { id: 'revenue', label: 'Revenue', icon: TrendingUp },
              { id: 'expense', label: 'Expenses', icon: TrendingDown },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 border select-none",
                  filterType === tab.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
              >
                 <tab.icon className="h-3.5 w-3.5" />
                 <span>{tab.label}</span>
              </button>
            ))}
        </div>

        <div className="h-px bg-border/50" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search account code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 focus:bg-background transition-colors h-10"
          />
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-32 pl-6">Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32 text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Filter className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium">No accounts found</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto text-center">
                        We couldn't find any accounts matching your search. Try adjusting your filters or create a new account.
                      </p>
                      {filteredAccounts.length === 0 && accounts.length === 0 && (
                         <Button variant="outline" onClick={loadSAChartOfAccounts} className="mt-4">
                           Load Default SA Chart
                         </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => {
                  const TypeIcon = getTypeIcon(account.account_type);
                  const typeColor = getTypeColor(account.account_type);
                  
                  return (
                  <TableRow key={account.id} className="hover:bg-muted/50 transition-colors group">
                    <TableCell className="font-mono font-medium text-foreground pl-6">{account.account_code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-md bg-opacity-10", typeColor.split(' ')[1])}>
                           <TypeIcon className={cn("h-4 w-4", typeColor.split(' ')[0])} />
                        </div>
                        <span className="font-medium">{account.account_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-normal capitalize", typeColor)}>
                        {account.account_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? "default" : "secondary"} className={cn(
                        "font-normal", 
                        account.is_active ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      )}>
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(account)}
                        >
                          <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(account)}
                        >
                          {account.is_active ? 
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> : 
                            <ShieldAlert className="h-4 w-4 text-amber-600" />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDelete(account.id)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
