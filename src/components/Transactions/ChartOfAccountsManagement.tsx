import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, BookOpen, Search } from "lucide-react";
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
  { code: "1000", name: "Cash on Hand", type: "Asset" },
  { code: "1010", name: "Petty Cash", type: "Asset" },
  { code: "1100", name: "Bank - Current Account", type: "Asset" },
  { code: "1110", name: "Bank - Savings Account", type: "Asset" },
  { code: "1200", name: "Accounts Receivable", type: "Asset" },
  { code: "1210", name: "Allowance for Doubtful Debts", type: "Asset" },
  { code: "1300", name: "Inventory - Raw Materials", type: "Asset" },
  { code: "1310", name: "Inventory - Finished Goods", type: "Asset" },
  { code: "1400", name: "Prepaid Expenses", type: "Asset" },
  { code: "1500", name: "Property, Plant & Equipment", type: "Asset" },
  { code: "1510", name: "Accumulated Depreciation - PPE", type: "Asset" },
  { code: "1600", name: "Motor Vehicles", type: "Asset" },
  { code: "1610", name: "Accumulated Depreciation - Vehicles", type: "Asset" },
  { code: "1700", name: "Furniture & Fixtures", type: "Asset" },
  { code: "1710", name: "Accumulated Depreciation - Furniture", type: "Asset" },
  { code: "1800", name: "Computer Equipment", type: "Asset" },
  { code: "1810", name: "Accumulated Depreciation - Computers", type: "Asset" },
  
  // Liabilities (2000-2999)
  { code: "2000", name: "Accounts Payable", type: "Liability" },
  { code: "2100", name: "VAT Payable (Output)", type: "Liability" },
  { code: "2110", name: "VAT Receivable (Input)", type: "Liability" },
  { code: "2200", name: "PAYE Payable", type: "Liability" },
  { code: "2210", name: "UIF Payable", type: "Liability" },
  { code: "2220", name: "SDL Payable", type: "Liability" },
  { code: "2300", name: "Short-term Loan", type: "Liability" },
  { code: "2400", name: "Long-term Loan", type: "Liability" },
  { code: "2500", name: "Credit Card Payable", type: "Liability" },
  
  // Equity (3000-3999)
  { code: "3000", name: "Owner's Capital", type: "Equity" },
  { code: "3100", name: "Retained Earnings", type: "Equity" },
  { code: "3200", name: "Current Year Earnings", type: "Equity" },
  { code: "3300", name: "Drawings", type: "Equity" },
  
  // Income (4000-4999)
  { code: "4000", name: "Sales Revenue", type: "Income" },
  { code: "4100", name: "Service Revenue", type: "Income" },
  { code: "4200", name: "Interest Income", type: "Income" },
  { code: "4300", name: "Other Income", type: "Income" },
  { code: "4400", name: "Rental Income", type: "Income" },
  
  // Cost of Sales (5000-5999)
  { code: "5000", name: "Cost of Goods Sold", type: "Expense" },
  { code: "5100", name: "Purchases", type: "Expense" },
  { code: "5200", name: "Freight & Delivery", type: "Expense" },
  
  // Operating Expenses (6000-6999)
  { code: "6000", name: "Salaries & Wages", type: "Expense" },
  { code: "6100", name: "Rent Expense", type: "Expense" },
  { code: "6200", name: "Utilities - Electricity", type: "Expense" },
  { code: "6210", name: "Utilities - Water", type: "Expense" },
  { code: "6300", name: "Telephone & Internet", type: "Expense" },
  { code: "6400", name: "Insurance", type: "Expense" },
  { code: "6500", name: "Motor Vehicle Expenses", type: "Expense" },
  { code: "6600", name: "Fuel & Oil", type: "Expense" },
  { code: "6700", name: "Repairs & Maintenance", type: "Expense" },
  { code: "6800", name: "Office Supplies", type: "Expense" },
  { code: "6900", name: "Bank Charges", type: "Expense" },
  { code: "6910", name: "Professional Fees", type: "Expense" },
  { code: "6920", name: "Advertising & Marketing", type: "Expense" },
  { code: "6930", name: "Training & Development", type: "Expense" },
  { code: "6940", name: "Travel & Accommodation", type: "Expense" },
  { code: "6950", name: "Depreciation Expense", type: "Expense" },
  { code: "6960", name: "Bad Debts", type: "Expense" },
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
  
  const [formData, setFormData] = useState({
    account_code: "",
    account_name: "",
    account_type: "Asset",
  });

  useEffect(() => {
    loadAccounts();
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

      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("account_code");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
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
      setFormData({ account_code: "", account_name: "", account_type: "Asset" });
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
    Asset: filteredAccounts.filter(a => a.account_type === "Asset").length,
    Liability: filteredAccounts.filter(a => a.account_type === "Liability").length,
    Equity: filteredAccounts.filter(a => a.account_type === "Equity").length,
    Income: filteredAccounts.filter(a => a.account_type === "Income").length,
    Expense: filteredAccounts.filter(a => a.account_type === "Expense").length,
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
            Load SA Chart of Accounts
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" onClick={() => {
                setEditingAccount(null);
                setFormData({ account_code: "", account_name: "", account_type: "Asset" });
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
                      <SelectItem value="Asset">Asset</SelectItem>
                      <SelectItem value="Liability">Liability</SelectItem>
                      <SelectItem value="Equity">Equity</SelectItem>
                      <SelectItem value="Income">Income</SelectItem>
                      <SelectItem value="Expense">Expense</SelectItem>
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
                <SelectItem value="income">Income</SelectItem>
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
                {filteredAccounts.map((account) => (
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
