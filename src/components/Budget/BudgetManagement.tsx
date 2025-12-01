import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, Download } from "lucide-react";
import { exportFinancialReportToPDF } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
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
  const [activeBudget, setActiveBudget] = useState<'pl' | 'bs' | 'cf'>('pl');
  const [actualMap, setActualMap] = useState<Record<string, number>>({});
  const [bsActualMap, setBsActualMap] = useState<Record<string, number>>({});
  const [cfActual, setCfActual] = useState<{ operating: number; investing: number; financing: number; net: number; opening: number; closing: number }>({ operating: 0, investing: 0, financing: 0, net: 0, opening: 0, closing: 0 });
  
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryValues, setEntryValues] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

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

  const loadBudgets = useCallback(async () => {
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
      const acctAll = (accs || []).map((a: any) => ({ id: a.id, account_name: a.account_name, account_type: a.account_type, normal_balance: a.normal_balance }));
      setAccounts(acctAll);
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
      const actuals: Record<string, number> = {};
      (te || []).forEach((row: any) => {
        const accId = String(row.account_id || '');
        const acc = acctAll.find((a: any) => a.id === accId);
        const nb = String(acc?.normal_balance || '').toLowerCase();
        const val = nb === 'credit' ? Number(row.credit || 0) - Number(row.debit || 0) : Number(row.debit || 0) - Number(row.credit || 0);
        actuals[accId] = (actuals[accId] || 0) + val;
      });
      setActualMap(actuals);

      const { data: led } = await supabase
        .from('ledger_entries')
        .select('account_id, debit, credit, entry_date, company_id')
        .eq('company_id', profile.company_id)
        .lte('entry_date', end);
      const bsActuals: Record<string, number> = {};
      (led || []).forEach((row: any) => {
        const accId = String(row.account_id || '');
        const acc = acctAll.find((a: any) => a.id === accId);
        const nb = String(acc?.normal_balance || '').toLowerCase();
        const val = nb === 'credit' ? Number(row.credit || 0) - Number(row.debit || 0) : Number(row.debit || 0) - Number(row.credit || 0);
        bsActuals[accId] = (bsActuals[accId] || 0) + val;
      });
      setBsActualMap(bsActuals);

      try {
        const { data: cfData } = await supabase.rpc('generate_cash_flow', { _company_id: profile.company_id, _period_start: start, _period_end: end });
        if (cfData && cfData.length > 0) {
          const cf = cfData[0];
          setCfActual({
            operating: Number(cf.operating_activities || 0),
            investing: Number(cf.investing_activities || 0),
            financing: Number(cf.financing_activities || 0),
            net: Number(cf.net_cash_flow || 0),
            opening: Number(cf.opening_cash || 0),
            closing: Number(cf.closing_cash || 0),
          });
        } else {
          setCfActual({ operating: 0, investing: 0, financing: 0, net: 0, opening: 0, closing: 0 });
        }
      } catch {}
      const budgetsWithActuals = (data || []).map((budget: any) => {
        const actualAmount = actuals[String(budget.account_id || '')] || 0;
        const variance = Number(budget.budgeted_amount || 0) - actualAmount;
        return { ...budget, actual_amount: actualAmount, variance } as Budget;
      });
      setBudgets(budgetsWithActuals);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [user?.id, selectedYear, selectedMonth, toast]);
  function updateBudgetActuals() { return loadBudgets(); }
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
  }, [selectedYear, selectedMonth, loadBudgets, user?.id]);


  

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
        const { data: existing } = await (supabase as any)
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

  const budgetLookup = Object.fromEntries(budgets.map(b => [String(b.account_id || b.category), Number(b.budgeted_amount || 0)]));

  const upsertBudgetAmount = async (opts: { accountId?: string; category?: string; amount: number }) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (!profile?.company_id) return;
      const q: any = (supabase as any).from('budgets')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('budget_year', parseInt(selectedYear))
        .eq('budget_month', parseInt(selectedMonth));
      if (opts.accountId) q.eq('account_id', opts.accountId); else q.is('account_id', null).eq('category', opts.category || '');
      const { data: existing } = await q;
      if ((existing || []).length > 0) {
        const id = (existing || [])[0].id as string;
        await supabase.from('budgets').update({ budgeted_amount: opts.amount }).eq('id', id);
      } else {
        await supabase.from('budgets').insert({
          company_id: profile.company_id,
          user_id: user!.id,
          budget_name: opts.accountId ? (accounts.find(a => a.id === opts.accountId)?.account_name || '') : (opts.category || ''),
          budget_year: parseInt(selectedYear),
          budget_month: parseInt(selectedMonth),
          account_id: opts.accountId || null,
          category: opts.accountId ? String(opts.accountId) : String(opts.category || ''),
          budgeted_amount: opts.amount,
          actual_amount: 0,
          variance: opts.amount,
          status: 'active',
          notes: null,
        } as any);
      }
      loadBudgets();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const openBudgetEntry = () => {
    const initial: Record<string, number> = {};
    if (activeBudget === 'pl') {
      accounts
        .filter(a => ['income','revenue','expense'].includes(String(a.account_type).toLowerCase()))
        .forEach(a => { initial[a.id] = Number(budgetLookup[a.id] || 0); });
    } else if (activeBudget === 'bs') {
      accounts
        .filter(a => ['asset','liability','equity'].includes(String(a.account_type).toLowerCase()))
        .forEach(a => { initial[a.id] = Number(budgetLookup[a.id] || 0); });
    } else {
      ['operating','investing','financing','net'].forEach(k => {
        const key = `cashflow_${k}`;
        initial[key] = Number(budgetLookup[key] || 0);
      });
    }
    setEntryValues(initial);
    setEntryOpen(true);
  };

  const submitBudgetEntries = async () => {
    try {
      setSubmitting(true);
      const keys = Object.keys(entryValues);
      for (const key of keys) {
        const amt = Number(entryValues[key] || 0);
        if (!isFinite(amt)) continue;
        if (key.startsWith('cashflow_')) {
          await upsertBudgetAmount({ category: key, amount: amt });
        } else {
          await upsertBudgetAmount({ accountId: key, amount: amt });
        }
      }
      await loadBudgets();
      setEntryOpen(false);
      toast({ title: 'Success', description: 'Budget submitted' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your budgets vs actual spending</p>
        </div>
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

      {/* Budget Structures */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Budget Structure</CardTitle>
            <div className="flex gap-2">
              <Button variant={activeBudget==='pl'?'default':'outline'} size="sm" onClick={() => setActiveBudget('pl')}>Income Statement</Button>
              <Button variant={activeBudget==='bs'?'default':'outline'} size="sm" onClick={() => setActiveBudget('bs')}>Balance Sheet</Button>
              <Button variant={activeBudget==='cf'?'default':'outline'} size="sm" onClick={() => setActiveBudget('cf')}>Cash Flow</Button>
              <Button variant="outline" size="sm" onClick={() => setActionsOpen(true)}>Actions</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeBudget === 'pl' && (
            <div className="space-y-6">
              <div>
                <div className="font-semibold mb-2">Income</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts
                      .filter(a => ['income','revenue'].includes(String(a.account_type).toLowerCase()))
                      .map(acc => {
                        const budgetAmt = Number(budgetLookup[acc.id] || 0);
                        const actualAmt = Number(actualMap[acc.id] || 0);
                        if (Math.abs(budgetAmt) < 0.0001 && Math.abs(actualAmt) < 0.0001) return null;
                        const variance = budgetAmt - actualAmt;
                        return (
                          <TableRow key={acc.id}>
                            <TableCell className="font-medium">{acc.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(budgetAmt)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                            <TableCell>
                              <Badge variant={variance >= 0 ? 'default' : 'destructive'}>{variance >= 0 ? 'On Track' : 'Not On Track'}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-2">Expenses</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts
                      .filter(a => String(a.account_type).toLowerCase()==='expense')
                      .map(acc => {
                        const budgetAmt = Number(budgetLookup[acc.id] || 0);
                        const actualAmt = Number(actualMap[acc.id] || 0);
                        if (Math.abs(budgetAmt) < 0.0001 && Math.abs(actualAmt) < 0.0001) return null;
                        const variance = budgetAmt - actualAmt;
                        return (
                          <TableRow key={acc.id}>
                            <TableCell className="font-medium">{acc.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(budgetAmt)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                            <TableCell>
                              <Badge variant={variance >= 0 ? 'default' : 'destructive'}>{variance >= 0 ? 'On Track' : 'Not On Track'}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {activeBudget === 'bs' && (
            <div className="space-y-6">
              <div>
                <div className="font-semibold mb-2">Assets</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter(a => String(a.account_type).toLowerCase()==='asset').map(acc => {
                      const budgetAmt = Number(budgetLookup[acc.id] || 0);
                      const actualAmt = Number(bsActualMap[acc.id] || 0);
                      if (Math.abs(budgetAmt) < 0.0001 && Math.abs(actualAmt) < 0.0001) return null;
                      const variance = budgetAmt - actualAmt;
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(budgetAmt)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                          <TableCell>
                            <Badge variant={variance >= 0 ? 'default' : 'destructive'}>{variance >= 0 ? 'On Track' : 'Not On Track'}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-2">Liabilities</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter(a => String(a.account_type).toLowerCase()==='liability').map(acc => {
                      const budgetAmt = Number(budgetLookup[acc.id] || 0);
                      const actualAmt = Number(bsActualMap[acc.id] || 0);
                      if (Math.abs(budgetAmt) < 0.0001 && Math.abs(actualAmt) < 0.0001) return null;
                      const variance = budgetAmt - actualAmt;
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(budgetAmt)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                          <TableCell>
                            <Badge variant={variance >= 0 ? 'default' : 'destructive'}>{variance >= 0 ? 'On Track' : 'Not On Track'}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-2">Equity</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter(a => String(a.account_type).toLowerCase()==='equity').map(acc => {
                      const budgetAmt = Number(budgetLookup[acc.id] || 0);
                      const actualAmt = Number(bsActualMap[acc.id] || 0);
                      if (Math.abs(budgetAmt) < 0.0001 && Math.abs(actualAmt) < 0.0001) return null;
                      const variance = budgetAmt - actualAmt;
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(budgetAmt)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                          <TableCell>
                            <Badge variant={variance >= 0 ? 'default' : 'destructive'}>{variance >= 0 ? 'On Track' : 'Not On Track'}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {activeBudget === 'cf' && (
            <div className="space-y-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { key: 'operating', name: 'Operating Activities' },
                    { key: 'investing', name: 'Investing Activities' },
                    { key: 'financing', name: 'Financing Activities' },
                    { key: 'net', name: 'Net Cash Flow' },
                  ].map(row => {
                    const budgetKey = `cashflow_${row.key}`;
                    const budgetAmt = Number(budgetLookup[budgetKey] || 0);
                    const actualAmt = Number((cfActual as any)[row.key] || 0);
                    if (Math.abs(budgetAmt) < 0.0001 && Math.abs(actualAmt) < 0.0001) return null;
                    const variance = budgetAmt - actualAmt;
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(budgetAmt)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                        <TableCell>
                          <Badge variant={variance >= 0 ? 'default' : 'destructive'}>{variance >= 0 ? 'On Track' : 'Not On Track'}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
        <SheetContent className="sm:max-w-[520px]">
          <div className="space-y-4">
            <div className="text-lg font-semibold">Quick Actions</div>
            <div className="text-sm text-muted-foreground">Manage budgets and export statements</div>
            <div className="grid gap-3">
              <Button className="w-full" onClick={() => { setActionsOpen(false); openBudgetEntry(); }}>
                Budget
              </Button>
              <Button className="w-full" variant="outline" onClick={() => {
                const periodLabel = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}`;
                const lines: { account: string; amount: number; type?: string }[] = [];
                if (activeBudget === 'pl') {
                  lines.push({ account: 'INCOME', amount: 0, type: 'header' });
                  const inc = accounts.filter(a => ['income','revenue'].includes(String(a.account_type).toLowerCase()))
                    .map(a => ({ a, budget: Number(budgetLookup[a.id]||0), actual: Number(actualMap[a.id]||0) }))
                    .filter(x => Math.abs(x.budget) > 0.0001 || Math.abs(x.actual) > 0.0001);
                  let incTotal = 0;
                  inc.forEach(x => { lines.push({ account: x.a.account_name, amount: x.budget, type: 'income' }); incTotal += x.budget; });
                  lines.push({ account: 'Total Income (Budget)', amount: incTotal, type: 'subtotal' });
                  lines.push({ account: '', amount: 0, type: 'spacer' });
                  lines.push({ account: 'EXPENSES', amount: 0, type: 'header' });
                  const exp = accounts.filter(a => String(a.account_type).toLowerCase()==='expense')
                    .map(a => ({ a, budget: Number(budgetLookup[a.id]||0), actual: Number(actualMap[a.id]||0) }))
                    .filter(x => Math.abs(x.budget) > 0.0001 || Math.abs(x.actual) > 0.0001);
                  let expTotal = 0;
                  exp.forEach(x => { lines.push({ account: x.a.account_name, amount: x.budget, type: 'expense' }); expTotal += x.budget; });
                  lines.push({ account: 'Total Expenses (Budget)', amount: expTotal, type: 'subtotal' });
                  lines.push({ account: 'Net Profit (Budget)', amount: incTotal - expTotal, type: 'final' });
                } else if (activeBudget === 'bs') {
                  lines.push({ account: 'ASSETS', amount: 0, type: 'header' });
                  const assets = accounts.filter(a => String(a.account_type).toLowerCase()==='asset')
                    .map(a => ({ a, budget: Number(budgetLookup[a.id]||0), actual: Number(bsActualMap[a.id]||0) }))
                    .filter(x => Math.abs(x.budget) > 0.0001 || Math.abs(x.actual) > 0.0001);
                  let assetTotal = 0; assets.forEach(x => { lines.push({ account: x.a.account_name, amount: x.budget, type: 'asset' }); assetTotal += x.budget; });
                  lines.push({ account: 'Total Assets (Budget)', amount: assetTotal, type: 'subtotal' });
                  lines.push({ account: '', amount: 0, type: 'spacer' });
                  lines.push({ account: 'LIABILITIES', amount: 0, type: 'header' });
                  const liabs = accounts.filter(a => String(a.account_type).toLowerCase()==='liability')
                    .map(a => ({ a, budget: Number(budgetLookup[a.id]||0), actual: Number(bsActualMap[a.id]||0) }))
                    .filter(x => Math.abs(x.budget) > 0.0001 || Math.abs(x.actual) > 0.0001);
                  let liabTotal = 0; liabs.forEach(x => { lines.push({ account: x.a.account_name, amount: x.budget, type: 'liability' }); liabTotal += x.budget; });
                  lines.push({ account: 'Total Liabilities (Budget)', amount: liabTotal, type: 'subtotal' });
                  lines.push({ account: '', amount: 0, type: 'spacer' });
                  lines.push({ account: 'EQUITY', amount: 0, type: 'header' });
                  const eq = accounts.filter(a => String(a.account_type).toLowerCase()==='equity')
                    .map(a => ({ a, budget: Number(budgetLookup[a.id]||0), actual: Number(bsActualMap[a.id]||0) }))
                    .filter(x => Math.abs(x.budget) > 0.0001 || Math.abs(x.actual) > 0.0001);
                  let eqTotal = 0; eq.forEach(x => { lines.push({ account: x.a.account_name, amount: x.budget, type: 'equity' }); eqTotal += x.budget; });
                  lines.push({ account: 'Total Equity (Budget)', amount: eqTotal, type: 'subtotal' });
                  lines.push({ account: 'Total Liabilities & Equity (Budget)', amount: liabTotal + eqTotal, type: 'final' });
                } else {
                  const cats = [
                    { key: 'operating', name: 'Operating Activities' },
                    { key: 'investing', name: 'Investing Activities' },
                    { key: 'financing', name: 'Financing Activities' },
                    { key: 'net', name: 'Net Cash Flow' },
                  ];
                  cats.forEach(c => {
                    const budgetKey = `cashflow_${c.key}`;
                    const budgetAmt = Number(budgetLookup[budgetKey] || 0);
                    lines.push({ account: c.name, amount: budgetAmt, type: c.key });
                  });
                }
                exportFinancialReportToPDF(lines, `Budget - ${activeBudget.toUpperCase()}`, periodLabel, `budget_${activeBudget}`);
                toast({ title: 'Exported', description: 'Budget exported to PDF' });
                setActionsOpen(false);
              }}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Budget Entry</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mb-4">
            <Button variant={activeBudget==='pl'?'default':'outline'} size="sm" onClick={() => setActiveBudget('pl')}>Income Statement</Button>
            <Button variant={activeBudget==='bs'?'default':'outline'} size="sm" onClick={() => setActiveBudget('bs')}>Balance Sheet</Button>
            <Button variant={activeBudget==='cf'?'default':'outline'} size="sm" onClick={() => setActiveBudget('cf')}>Cash Flow</Button>
          </div>
          {activeBudget === 'pl' && (
            <div className="space-y-6">
              <div>
                <div className="font-semibold mb-2">Income</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts
                      .filter(a => ['income','revenue'].includes(String(a.account_type).toLowerCase()))
                      .map(acc => {
                        const actualAmt = Number(actualMap[acc.id] || 0);
                        const budgetAmt = Number(entryValues[acc.id] || 0);
                        const variance = budgetAmt - actualAmt;
                        return (
                          <TableRow key={acc.id}>
                            <TableCell className="font-medium">{acc.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                            <TableCell className="text-right">
                              <Input className="text-right" value={String(budgetAmt)} onChange={(e) => {
                                const v = parseFloat(e.target.value || '0');
                                setEntryValues(prev => ({ ...prev, [acc.id]: isNaN(v)?0:v }));
                              }} />
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-2">Expenses</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts
                      .filter(a => String(a.account_type).toLowerCase()==='expense')
                      .map(acc => {
                        const actualAmt = Number(actualMap[acc.id] || 0);
                        const budgetAmt = Number(entryValues[acc.id] || 0);
                        const variance = budgetAmt - actualAmt;
                        return (
                          <TableRow key={acc.id}>
                            <TableCell className="font-medium">{acc.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                            <TableCell className="text-right">
                              <Input className="text-right" value={String(budgetAmt)} onChange={(e) => {
                                const v = parseFloat(e.target.value || '0');
                                setEntryValues(prev => ({ ...prev, [acc.id]: isNaN(v)?0:v }));
                              }} />
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {activeBudget === 'bs' && (
            <div className="space-y-6">
              <div>
                <div className="font-semibold mb-2">Assets</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter(a => String(a.account_type).toLowerCase()==='asset').map(acc => {
                      const actualAmt = Number(bsActualMap[acc.id] || 0);
                      const budgetAmt = Number(entryValues[acc.id] || 0);
                      const variance = budgetAmt - actualAmt;
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                          <TableCell className="text-right">
                            <Input className="text-right" value={String(budgetAmt)} onChange={(e) => {
                              const v = parseFloat(e.target.value || '0');
                              setEntryValues(prev => ({ ...prev, [acc.id]: isNaN(v)?0:v }));
                            }} />
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-2">Liabilities</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter(a => String(a.account_type).toLowerCase()==='liability').map(acc => {
                      const actualAmt = Number(bsActualMap[acc.id] || 0);
                      const budgetAmt = Number(entryValues[acc.id] || 0);
                      const variance = budgetAmt - actualAmt;
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                          <TableCell className="text-right">
                            <Input className="text-right" value={String(budgetAmt)} onChange={(e) => {
                              const v = parseFloat(e.target.value || '0');
                              setEntryValues(prev => ({ ...prev, [acc.id]: isNaN(v)?0:v }));
                            }} />
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="font-semibold mb-2">Equity</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.filter(a => String(a.account_type).toLowerCase()==='equity').map(acc => {
                      const actualAmt = Number(bsActualMap[acc.id] || 0);
                      const budgetAmt = Number(entryValues[acc.id] || 0);
                      const variance = budgetAmt - actualAmt;
                      return (
                        <TableRow key={acc.id}>
                          <TableCell className="font-medium">{acc.account_name}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                          <TableCell className="text-right">
                            <Input className="text-right" value={String(budgetAmt)} onChange={(e) => {
                              const v = parseFloat(e.target.value || '0');
                              setEntryValues(prev => ({ ...prev, [acc.id]: isNaN(v)?0:v }));
                            }} />
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {activeBudget === 'cf' && (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { key: 'operating', name: 'Operating Activities' },
                    { key: 'investing', name: 'Investing Activities' },
                    { key: 'financing', name: 'Financing Activities' },
                    { key: 'net', name: 'Net Cash Flow' },
                  ].map(row => {
                    const budgetKey = `cashflow_${row.key}`;
                    const actualAmt = Number((cfActual as any)[row.key] || 0);
                    const budgetAmt = Number(entryValues[budgetKey] || 0);
                    const variance = budgetAmt - actualAmt;
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(actualAmt)}</TableCell>
                        <TableCell className="text-right">
                          <Input className="text-right" value={String(budgetAmt)} onChange={(e) => {
                            const v = parseFloat(e.target.value || '0');
                            setEntryValues(prev => ({ ...prev, [budgetKey]: isNaN(v)?0:v }));
                          }} />
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Math.abs(variance))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 bg-background p-3 border-t">
            <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button>
            <Button onClick={submitBudgetEntries} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Budget'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Old Budgets Table removed per request */}

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
