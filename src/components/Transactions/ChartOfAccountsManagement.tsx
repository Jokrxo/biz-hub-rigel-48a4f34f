import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, BookOpen, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

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
  const [mappings, setMappings] = useState<Record<string, { debit_account_id: string | null; credit_account_id: string | null }>>({});
  
  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "asset",
  });

  useEffect(() => {
    loadAccounts();
    loadMappings();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) return;
      setCompanyId(profile.company_id);

      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("account_code");

      if (error) throw error;

      // Ensure SA Chart of Accounts defaults exist for all companies: insert any missing ones
      const existingCodes = new Set((data || []).map(acc => acc.account_code));
      const missingDefaults = SA_CHART_OF_ACCOUNTS.filter(acc => !existingCodes.has(acc.code));

      if (missingDefaults.length > 0) {
        const accountsToInsert = missingDefaults.map(acc => ({
          company_id: profile.company_id,
          account_code: acc.code,
          account_name: acc.name,
          account_type: acc.type,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from("chart_of_accounts")
          .insert(accountsToInsert);

        if (insertError) throw insertError;

        const { data: seeded } = await supabase
          .from("chart_of_accounts")
          .select("*")
          .eq("company_id", profile.company_id)
          .order("account_code");

        setAccounts(seeded || []);
        toast({ title: "Defaults Loaded", description: `Added ${accountsToInsert.length} missing SA accounts` });
      } else {
        setAccounts(data || []);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();
      if (!profile) return;
      setCompanyId(profile.company_id);

      const { data, error } = await supabase
        .from("transaction_type_mappings")
        .select("transaction_type, debit_account_id, credit_account_id")
        .eq("company_id", profile.company_id);

      if (error) {
        // If table is missing, don’t crash — show info toast and use empty defaults
        toast({ title: "Info", description: "Mapping table not found; using empty defaults.", variant: "secondary" });
        setMappings({});
        return;
      }

      const map: Record<string, { debit_account_id: string | null; credit_account_id: string | null }> = {};
      (data || []).forEach((row: any) => {
        map[row.transaction_type] = {
          debit_account_id: row.debit_account_id || null,
          credit_account_id: row.credit_account_id || null,
        };
      });
      setMappings(map);
    } catch (error: any) {
      // Swallow errors to avoid blocking the rest of the page
      console.warn("loadMappings error", error);
    }
  };

  const saveMappings = async () => {
    try {
      if (!companyId) throw new Error("Company context not found");
      const payload = TRANSACTION_TYPES.map(tt => ({
        company_id: companyId,
        transaction_type: tt.key,
        debit_account_id: mappings[tt.key]?.debit_account_id || null,
        credit_account_id: mappings[tt.key]?.credit_account_id || null,
      }));

      const { error } = await supabase
        .from("transaction_type_mappings")
        .upsert(payload, { onConflict: "company_id,transaction_type" });
      if (error) throw error;
      toast({ title: "Saved", description: "Transaction type mappings updated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const loadSAChartOfAccounts = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) return;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chart of Accounts</h2>
          <p className="text-muted-foreground">Manage your accounting codes and mappings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadSAChartOfAccounts}>
            <BookOpen className="h-4 w-4 mr-2" />
            Load SA Chart of Accounts
          </Button>
          <Button variant="outline" onClick={loadAccounts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" onClick={() => {
                setEditingAccount(null);
                setFormData({ account_code: "", account_name: "", account_type: "asset" });
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Edit Account" : "Add New Account"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
            <div>
              <Label>Account Code *</Label>
              <Input
                value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                placeholder="e.g., 1000"
              />
            </div>
            <div>
              <Label>Account Name *</Label>
              <Input
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="e.g., Cash on Hand"
              />
            </div>
            <div>
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
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} className="bg-gradient-primary">
                  {editingAccount ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(accountsByType).map(([type, count]) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{type}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by code or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <BookOpen className="h-12 w-12 text-muted-foreground mb-2" />
                        <h3 className="text-lg font-semibold">No Chart of Accounts Found</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                          You don't have any chart of accounts set up yet. You can either load the predefined South African chart of accounts or create your own custom accounts.
                        </p>
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" onClick={loadSAChartOfAccounts}>
                            <BookOpen className="h-4 w-4 mr-2" />
                            Load SA Chart
                          </Button>
                          <Button onClick={() => {
                            setEditingAccount(null);
                            setFormData({ account_code: "", account_name: "", account_type: "asset" });
                            setIsDialogOpen(true);
                          }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Custom Account
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Need help with SA chart of accounts? Contact your creditor or system administrator.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                      <TableCell>{account.account_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.account_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "secondary"}>
                          {account.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleActive(account)}
                          >
                            {account.is_active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleDelete(account.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Type → Account Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Type Mappings</CardTitle>
          <CardDescription>
            Define default debit and credit accounts for each transaction type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {TRANSACTION_TYPES.map(tt => (
              <div key={tt.key} className="rounded-md border p-4">
                <div className="font-semibold mb-2">{tt.label}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Debit Account</Label>
                    <Select
                      value={mappings[tt.key]?.debit_account_id || ""}
                      onValueChange={(val) => setMappings(prev => ({
                        ...prev,
                        [tt.key]: { ...prev[tt.key], debit_account_id: val }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} — {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Credit Account</Label>
                    <Select
                      value={mappings[tt.key]?.credit_account_id || ""}
                      onValueChange={(val) => setMappings(prev => ({
                        ...prev,
                        [tt.key]: { ...prev[tt.key], credit_account_id: val }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} — {a.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={saveMappings} className="bg-gradient-primary">Save Mappings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
