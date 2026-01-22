import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, BookOpen, Search, RefreshCw, Wallet, CreditCard, PieChart, TrendingUp, TrendingDown, Filter, LayoutGrid, ShieldCheck, ShieldAlert, History, Upload, Loader2, AlertTriangle, Download, MoreHorizontal, FileSpreadsheet, ChevronDown, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Papa from "papaparse";
import { Textarea } from "@/components/ui/textarea";
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

  // Deactivate State
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [accountToDeactivate, setAccountToDeactivate] = useState<Account | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);

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

  const handleDeactivate = async () => {
    if (!accountToDeactivate) return;
    if (!deactivateReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for deactivation.", variant: "destructive" });
      return;
    }

    setIsDeactivating(true);
    try {
      const acc = accountToDeactivate;
      const code = String(acc.account_code || '').trim();
      const name = String(acc.account_name || '').toLowerCase();
      const isAsset = String(acc.account_type || '').toLowerCase() === 'asset';
      const isFixedAssetFamily = code.startsWith('15') || name.includes('accumulated depreciation') || name.includes('accumulated amortization') || name.includes('land') || name.includes('building') || name.includes('plant') || name.includes('machinery') || name.includes('vehicle') || name.includes('furniture') || name.includes('equipment') || name.includes('computer') || name.includes('software') || name.includes('goodwill');
      
      if (isAsset && isFixedAssetFamily) {
        toast({ title: "Protected Account", description: "Fixed asset accounts cannot be deactivated.", variant: "destructive" });
        setIsDeactivating(false);
        return;
      }

      // Instead of deleting, we mark as inactive and log the reason in the name or description if available
      // Chart of Accounts table usually has description? No, just name.
      // We'll append [INACTIVE] to name if not already there, and maybe log reason elsewhere or just toast it for now.
      // Actually, since we have is_active, we just set it to false.
      
      const newName = acc.account_name.startsWith("[INACTIVE]") ? acc.account_name : `[INACTIVE] ${acc.account_name}`;

      const { error } = await supabase
        .from("chart_of_accounts")
        .update({ 
            is_active: false,
            account_name: newName
        })
        .eq("id", accountToDeactivate.id);

      if (error) throw error;
      toast({ title: "Success", description: "Account deactivated successfully" });
      setDeactivateOpen(false);
      setAccountToDeactivate(null);
      setDeactivateReason("");
      loadAccounts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeactivating(false);
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

  const handleDownloadTemplate = () => {
    const template = [
      ["account_code", "account_name", "account_type"],
      ["1000", "Cash on Hand", "asset"],
      ["2000", "Accounts Payable", "liability"],
      ["3000", "Owner's Capital", "equity"],
      ["4000", "Sales Revenue", "revenue"],
      ["5000", "Cost of Goods Sold", "expense"]
    ];
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "chart_of_accounts_template.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const { data } = results;
          if (!data || data.length === 0) {
             toast({ title: "Error", description: "CSV file is empty", variant: "destructive" });
             return;
          }
          
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("user_id", user?.id)
            .single();

          if (!profile) {
             toast({ title: "Error", description: "Company profile not found", variant: "destructive" });
             return;
          }

          const accountsToInsert = data.map((row: any) => ({
            company_id: profile.company_id,
            account_code: row.account_code,
            account_name: row.account_name,
            account_type: row.account_type?.toLowerCase(),
            is_active: true
          })).filter((acc: any) => acc.account_code && acc.account_name && acc.account_type);

           if (accountsToInsert.length === 0) {
             toast({ title: "Error", description: "No valid accounts found in CSV", variant: "destructive" });
             return;
          }
          
          const { data: existing } = await supabase
            .from("chart_of_accounts")
            .select("account_code")
            .eq("company_id", profile.company_id);
            
          const existingCodes = new Set(existing?.map(a => a.account_code) || []);
          const newAccounts = accountsToInsert.filter((acc: any) => !existingCodes.has(acc.account_code));
          
          if (newAccounts.length === 0) {
             toast({ title: "Info", description: "All accounts in CSV already exist" });
             return;
          }

          const { error } = await supabase
            .from("chart_of_accounts")
            .insert(newAccounts);

          if (error) throw error;

          toast({ title: "Success", description: `Successfully imported ${newAccounts.length} accounts` });
          loadAccounts();
          
        } catch (error: any) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        }
        
        // Reset input
        event.target.value = '';
      },
      error: (error) => {
         toast({ title: "Error", description: `CSV parsing error: ${error.message}`, variant: "destructive" });
      }
    });
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
        <div className="flex items-center gap-2">
          <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="hidden"
                id="csv-upload"
              />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                Actions
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Template Management</DropdownMenuLabel>
              <DropdownMenuItem onClick={loadSAChartOfAccounts}>
                <BookOpen className="mr-2 h-4 w-4" />
                <span>Load SA Template</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                <span>Download Template</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Data Operations</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => document.getElementById('csv-upload')?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                <span>Import CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={loadAccounts}>
                <RefreshCw className="mr-2 h-4 w-4" />
                <span>Refresh Data</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-9 transition-all hover:scale-105" onClick={() => {
                setEditingAccount(null);
                setFormData({ account_code: "", account_name: "", account_type: "asset" });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              <DialogHeader className="pt-6">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {editingAccount ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </div>
                  {editingAccount ? "Edit Account" : "Create New Account"}
                </DialogTitle>
                <DialogDescription>
                  {editingAccount ? "Modify the details of the existing account." : "Add a new account to your chart of accounts."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 py-4">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground/80">Account Code <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">#</span>
                      <Input
                        value={formData.account_code}
                        onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                        placeholder="e.g., 1000"
                        className="pl-7 h-10 transition-all focus:ring-2 focus:ring-primary/20 hover:border-primary/50 bg-background/50 focus:bg-background border-muted-foreground/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground/80">Account Type <span className="text-red-500">*</span></Label>
                    <Select value={formData.account_type} onValueChange={(val) => setFormData({ ...formData, account_type: val })}>
                      <SelectTrigger className={cn(
                        "h-10 transition-all focus:ring-2 focus:ring-primary/20 hover:border-primary/50 bg-background/50 focus:bg-background border-muted-foreground/20",
                        !formData.account_type && "text-muted-foreground"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset" className="cursor-pointer"><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-500" /> Asset</div></SelectItem>
                        <SelectItem value="liability" className="cursor-pointer"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-rose-500" /> Liability</div></SelectItem>
                        <SelectItem value="equity" className="cursor-pointer"><div className="flex items-center gap-2"><PieChart className="h-4 w-4 text-blue-500" /> Equity</div></SelectItem>
                        <SelectItem value="revenue" className="cursor-pointer"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-500" /> Revenue</div></SelectItem>
                        <SelectItem value="expense" className="cursor-pointer"><div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-amber-500" /> Expense</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground/80">Account Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="e.g., Cash on Hand"
                    className="h-10 transition-all focus:ring-2 focus:ring-primary/20 hover:border-primary/50 bg-background/50 focus:bg-background border-muted-foreground/20"
                  />
                </div>
              </div>
              <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 border-t mt-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="hover:bg-muted/80">Cancel</Button>
                <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 min-w-[120px]">
                  {editingAccount ? "Save Changes" : "Create Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {Object.entries(accountsByType).map(([type, count], index) => {
           const Icon = getTypeIcon(type === 'Assets' ? 'asset' : type === 'Liabilities' ? 'liability' : type === 'Equity' ? 'equity' : type === 'Revenue' ? 'revenue' : 'expense');
           const colorClass = getTypeColor(type === 'Assets' ? 'asset' : type === 'Liabilities' ? 'liability' : type === 'Equity' ? 'equity' : type === 'Revenue' ? 'revenue' : 'expense');
           // Extract base color for gradient
           const baseColor = type === 'Assets' ? 'emerald' : type === 'Liabilities' ? 'rose' : type === 'Equity' ? 'blue' : type === 'Revenue' ? 'indigo' : 'amber';
           
           return (
            <Card key={type} className={cn(
              "overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer relative",
              `hover:border-${baseColor}-200 dark:hover:border-${baseColor}-800`
            )}
            style={{ animationDelay: `${index * 100}ms` }}
            onClick={() => setFilterType(type === 'Assets' ? 'asset' : type === 'Liabilities' ? 'liability' : type === 'Equity' ? 'equity' : type === 'Revenue' ? 'revenue' : 'expense')}
            >
              <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br", `from-${baseColor}-50/50 to-transparent dark:from-${baseColor}-950/30`)} />
              <CardContent className="p-5 flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    {type}
                    <span className={cn("w-1.5 h-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300", `bg-${baseColor}-500`)}></span>
                  </p>
                  <div className="text-3xl font-bold tracking-tight">{count}</div>
                </div>
                <div className={cn(
                  "p-3 rounded-xl border shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3", 
                  colorClass.replace('text-', 'bg-opacity-10 text-').replace('border-', 'border-opacity-20 border-')
                )}>
                  <Icon className={cn("h-6 w-6", colorClass.split(' ')[0])} />
                </div>
              </CardContent>
            </Card>
           );
        })}
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-4 delay-300">
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
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2.5 border select-none relative overflow-hidden group",
                  filterType === tab.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]" 
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground hover:border-primary/30"
                )}
              >
                 {filterType === tab.id && <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />}
                 <tab.icon className={cn("h-4 w-4 transition-transform duration-300", filterType === tab.id ? "scale-110" : "group-hover:scale-110")} />
                 <span>{tab.label}</span>
              </button>
            ))}
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="relative group">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search account code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background/50 focus:bg-background transition-all h-11 border-muted-foreground/20 focus:border-primary focus:ring-2 focus:ring-primary/20 hover:border-primary/50"
          />
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 delay-500 bg-transparent">
        <div className="rounded-xl border bg-card/95 backdrop-blur-sm">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b border-border/60">
                <TableHead className="w-32 pl-6 font-semibold">Code</TableHead>
                <TableHead className="font-semibold">Account Name</TableHead>
                <TableHead className="w-32 font-semibold">Type</TableHead>
                <TableHead className="w-24 font-semibold">Status</TableHead>
                <TableHead className="w-32 text-right pr-6 font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
                      <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <Filter className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium">No accounts found</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto text-center">
                        We couldn't find any accounts matching your search. Try adjusting your filters or create a new account.
                      </p>
                      {filteredAccounts.length === 0 && accounts.length === 0 && (
                         <Button variant="outline" onClick={loadSAChartOfAccounts} className="mt-4 border-primary/20 hover:border-primary/50 hover:text-primary">
                           Load Default SA Chart
                         </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account, index) => {
                  const TypeIcon = getTypeIcon(account.account_type);
                  const typeColor = getTypeColor(account.account_type);
                  
                  return (
                  <TableRow 
                    key={account.id} 
                    className="hover:bg-muted/30 transition-colors group animate-in fade-in slide-in-from-bottom-2 duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <TableCell className="font-mono font-medium text-foreground/80 pl-6 group-hover:text-primary transition-colors">{account.account_code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg bg-opacity-10 transition-transform duration-300 group-hover:scale-110", typeColor.split(' ')[1])}>
                           <TypeIcon className={cn("h-4 w-4", typeColor.split(' ')[0])} />
                        </div>
                        <span className="font-medium text-foreground/90">{account.account_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-medium capitalize px-2.5 py-0.5 shadow-sm", typeColor)}>
                        {account.account_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_active ? "default" : "secondary"} className={cn(
                        "font-medium px-2.5 py-0.5 transition-all", 
                        account.is_active 
                          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200 dark:border-emerald-800" 
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", account.is_active ? "bg-emerald-500" : "bg-slate-400")}></span>
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(account)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Account
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleActive(account)}>
                            {account.is_active ? <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" /> : <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />}
                            {account.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          {account.is_active && (
                            <DropdownMenuItem onClick={() => {
                                setAccountToDeactivate(account);
                                setDeactivateOpen(true);
                            }} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                              <History className="mr-2 h-4 w-4" />
                              Deactivate with Reason
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      {/* Deactivate/Archive Dialog */}
      <Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <History className="h-5 w-5" />
              Deactivate Account
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will mark the account as inactive. It cannot be deleted for audit purposes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm font-medium flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                For audit compliance, accounts cannot be deleted. Use this form to deactivate them.
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reason for Deactivation</Label>
              <Textarea 
                value={deactivateReason} 
                onChange={(e) => setDeactivateReason(e.target.value)} 
                placeholder="Reason for deactivation..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Supporting Document (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toast({ title: "Upload", description: "File upload will be available in the next update." })}>
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8 opacity-50" />
                  <span className="text-sm">Click to upload document</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeactivateOpen(false)} className="w-full sm:w-auto">Dismiss</Button>
            <Button 
              onClick={handleDeactivate}
              disabled={isDeactivating || !deactivateReason.trim()}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isDeactivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <History className="mr-2 h-4 w-4" />
                  Confirm Deactivation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
