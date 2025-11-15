import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Edit, TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

interface Budget {
  id: string;
  account_id?: string | null;
  budget_name: string;
  budget_year: number;
  budget_month: number;
  category: string;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  status: string;
  notes: string | null;
}
interface AccountOpt { id: string; account_name: string; account_type: string; normal_balance?: string }

export const BudgetManagement = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState({
    budget_name: "",
    budget_year: currentYear.toString(),
    budget_month: currentMonth.toString(),
    account_id: "",
    category: "",
    budgeted_amount: "",
    notes: "",
  });

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());

  useEffect(() => {
    loadBudgets();

    let channel: any;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      const companyId = (profile as any)?.company_id || "";

      channel = supabase
        .channel('budgets-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `company_id=eq.${companyId}` }, () => {
          loadBudgets();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${companyId}` }, () => {
          updateBudgetActuals();
        })
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [selectedYear, selectedMonth]);

  const loadBudgets = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) return;

      const { data, error } = await supabase
        .from("budgets")
        .select("id, account_id, budget_name, budget_year, budget_month, category, budgeted_amount, actual_amount, variance, status, notes")
        .eq("company_id", profile.company_id)
        .eq("budget_year", parseInt(selectedYear))
        .eq("budget_month", parseInt(selectedMonth))
        .order("budget_name");

      if (error) throw error;

      const { data: accs } = await supabase
        .from("chart_of_accounts")
        .select("id, account_name, account_type, normal_balance")
        .eq("company_id", profile.company_id)
        .eq("is_active", true);
      const acct = (accs || []).filter((a: any) => ["expense", "income"].includes(String(a.account_type || '').toLowerCase()));
      setAccounts(acct.map((a: any) => ({ id: a.id, account_name: a.account_name, account_type: a.account_type, normal_balance: a.normal_balance })));

      const start = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-01`;
      const y = parseInt(selectedYear);
      const m = parseInt(selectedMonth);
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      const { data: te, error: teError } = await supabase
        .from("transaction_entries")
        .select("account_id, debit, credit, status, transactions!inner(transaction_date, company_id, status)")
        .eq("transactions.company_id", profile.company_id)
        .eq("transactions.status", "posted")
        .gte("transactions.transaction_date", start)
        .lte("transactions.transaction_date", end)
        .eq("status", "approved");
      if (teError) throw teError;
      const actualMap: Record<string, number> = {};
      (te || []).forEach((row: any) => {
        const accId = String(row.account_id || '');
        const acc = acct.find((a: any) => a.id === accId);
        const nb = String(acc?.normal_balance || '').toLowerCase();
        const val = nb === 'credit' ? Number(row.credit || 0) - Number(row.debit || 0) : Number(row.debit || 0) - Number(row.credit || 0);
        actualMap[accId] = (actualMap[accId] || 0) + val;
      });

      const budgetsWithActuals = (data || []).map((budget: any) => {
        const actualAmount = actualMap[String(budget.account_id || '')] || 0;
        const variance = Number(budget.budgeted_amount || 0) - actualAmount;
        return { ...budget, actual_amount: actualAmount, variance } as Budget;
      });

      setBudgets(budgetsWithActuals);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateBudgetActuals = async () => {
    await loadBudgets();
  };

  const openDialog = (budget?: Budget) => {
    if (budget) {
      setEditingBudget(budget);
      setFormData({
        budget_name: budget.budget_name,
        budget_year: budget.budget_year.toString(),
        budget_month: budget.budget_month.toString(),
        account_id: budget.account_id ? String(budget.account_id) : "",
        category: budget.category,
        budgeted_amount: budget.budgeted_amount.toString(),
        notes: budget.notes || "",
      });
    } else {
      setEditingBudget(null);
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      budget_name: "",
      budget_year: currentYear.toString(),
      budget_month: currentMonth.toString(),
      account_id: "",
      category: "",
      budgeted_amount: "",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isAccountant) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!formData.account_id) {
        toast({ title: "Account required", description: "Please select an account for this budget.", variant: "destructive" });
        return;
      }

      if (editingBudget) {
        const { error } = await supabase
          .from("budgets")
          .update({
            budget_name: formData.budget_name,
            budget_year: parseInt(formData.budget_year),
            budget_month: parseInt(formData.budget_month),
            account_id: formData.account_id || null,
            category: String(formData.account_id),
            budgeted_amount: parseFloat(formData.budgeted_amount),
            notes: formData.notes || null,
          })
          .eq("id", editingBudget.id)
          .eq("company_id", profile!.company_id);

        if (error) throw error;
        toast({ title: "Success", description: "Budget updated successfully" });
      } else {
        const { data: existing } = await supabase
          .from("budgets")
          .select("id")
          .eq("company_id", profile!.company_id)
          .eq("budget_year", parseInt(formData.budget_year))
          .eq("budget_month", parseInt(formData.budget_month))
          .eq("account_id", formData.account_id);
        if ((existing || []).length > 0) {
          toast({ title: "Duplicate budget", description: "An entry for this account and period already exists.", variant: "destructive" });
          return;
        }
        const { error } = await supabase.from("budgets").insert({
          company_id: profile!.company_id,
          user_id: user!.id,
          budget_name: formData.budget_name || (accounts.find(a => a.id === formData.account_id)?.account_name || ""),
          budget_year: parseInt(formData.budget_year),
          budget_month: parseInt(formData.budget_month),
          account_id: formData.account_id || null,
          category: String(formData.account_id),
          budgeted_amount: parseFloat(formData.budgeted_amount),
          actual_amount: 0,
          variance: parseFloat(formData.budgeted_amount),
          notes: formData.notes || null,
          status: "active"
        });

        if (error) throw error;
        toast({ title: "Success", description: "Budget created successfully" });
      }

      setDialogOpen(false);
      setEditingBudget(null);
      resetForm();
      loadBudgets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteBudget = async (id: string) => {
    if (!confirm("Delete this budget?")) return;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      const { error } = await supabase.from("budgets").delete().eq("id", id).eq("company_id", profile?.company_id || "");
      if (error) throw error;
      toast({ title: "Success", description: "Budget deleted" });
      loadBudgets();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const categories = [
    "Office Supplies",
    "Travel",
    "Utilities",
    "Rent",
    "Insurance",
    "Marketing",
    "Professional Fees",
    "Fuel & Transport",
    "Salaries & Wages",
    "Other"
  ];

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const canEdit = isAdmin || isAccountant;

  const totalBudgeted = budgets.reduce((sum, b) => sum + Number(b.budgeted_amount), 0);
  const totalActual = budgets.reduce((sum, b) => sum + Number(b.actual_amount), 0);
  const totalVariance = totalBudgeted - totalActual;
  const utilizationRate = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;

  const formatCurrency = (value: number) => {
    return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your budgets vs actual spending</p>
        </div>
        {canEdit && (
          <Button className="bg-gradient-primary" onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Budget
          </Button>
        )}
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account *</Label>
              <Select value={formData.account_id} onValueChange={(val) => setFormData({ ...formData, account_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Budgeted</CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudgeted)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
            <TrendingDown className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variance</CardTitle>
            {totalVariance >= 0 ? (
              <TrendingUp className="h-5 w-5 text-primary" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(Math.abs(totalVariance))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilizationRate.toFixed(1)}%</div>
            <Progress value={utilizationRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Budgets Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Budgets for {months[parseInt(selectedMonth) - 1]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : budgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No budgets for this period. Click "Create Budget" to add one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Budgeted</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => {
                  const percentage = budget.budgeted_amount > 0 
                    ? (budget.actual_amount / budget.budgeted_amount) * 100 
                    : 0;
                  const isOverBudget = percentage > 100;

                  return (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">{accounts.find(a => a.id === String(budget.account_id || ''))?.account_name || budget.budget_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(budget.budgeted_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(budget.actual_amount)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${
                        budget.variance >= 0 ? 'text-primary' : 'text-destructive'
                      }`}>
                        {formatCurrency(Math.abs(budget.variance))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          isOverBudget ? 'destructive' :
                          percentage > 90 ? 'secondary' :
                          'default'
                        }>
                          {isOverBudget ? 'Over' : percentage > 90 ? 'Warning' : 'On Track'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={Math.min(percentage, 100)} />
                          <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDialog(budget)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteBudget(budget.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Create Budget"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year *</Label>
                <Select value={formData.budget_year} onValueChange={(val) => setFormData({ ...formData, budget_year: val })} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month *</Label>
                <Select value={formData.budget_month} onValueChange={(val) => setFormData({ ...formData, budget_month: val })} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month, index) => (
                      <SelectItem key={index + 1} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Account *</Label>
              <div className="flex gap-2">
                <Select value={formData.account_id} onValueChange={(val) => setFormData({ ...formData, account_id: val })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setAccountSearchOpen(true)}>Search</Button>
              </div>
            </div>
            <div>
              <Label>Budgeted Amount (R) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.budgeted_amount}
                onChange={(e) => setFormData({ ...formData, budgeted_amount: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Optional notes about this budget"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingBudget(null); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-primary">
                {editingBudget ? "Update Budget" : "Create Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CommandDialog open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
        <CommandInput placeholder="Search chart of accounts..." />
        <CommandList>
          <CommandEmpty>No accounts found</CommandEmpty>
          <CommandGroup heading="Expense">
            {accounts.filter(a => (a.account_type || '').toLowerCase() === 'expense').map(a => (
              <CommandItem key={a.id} onSelect={() => { setFormData(prev => ({ ...prev, account_id: a.id })); setAccountSearchOpen(false); }}>
                {a.account_name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Income">
            {accounts.filter(a => (a.account_type || '').toLowerCase() === 'income').map(a => (
              <CommandItem key={a.id} onSelect={() => { setFormData(prev => ({ ...prev, account_id: a.id })); setAccountSearchOpen(false); }}>
                {a.account_name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
};