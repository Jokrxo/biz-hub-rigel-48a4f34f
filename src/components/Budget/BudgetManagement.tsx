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
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";

interface Budget {
  id: string;
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

export const BudgetManagement = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [formData, setFormData] = useState({
    budget_name: "",
    budget_year: currentYear.toString(),
    budget_month: currentMonth.toString(),
    category: "",
    budgeted_amount: "",
    notes: "",
  });

  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());

  useEffect(() => {
    loadBudgets();

    // Real-time updates
    const channel = supabase
      .channel('budgets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => {
        loadBudgets();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
        updateBudgetActuals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("budget_year", parseInt(selectedYear))
        .eq("budget_month", parseInt(selectedMonth))
        .order("category");

      if (error) throw error;

      // Calculate actual amounts
      const budgetsWithActuals = await Promise.all(
        (data || []).map(async (budget) => {
          const { data: expenses } = await supabase
            .from("expenses")
            .select("amount")
            .eq("company_id", profile.company_id)
            .eq("category", budget.category)
            .gte("expense_date", `${budget.budget_year}-${String(budget.budget_month).padStart(2, '0')}-01`)
            .lte("expense_date", `${budget.budget_year}-${String(budget.budget_month).padStart(2, '0')}-31`)
            .eq("status", "approved");

          const actualAmount = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
          const variance = Number(budget.budgeted_amount) - actualAmount;

          // Update budget with actual amounts
          await supabase
            .from("budgets")
            .update({ actual_amount: actualAmount, variance: variance })
            .eq("id", budget.id);

          return {
            ...budget,
            actual_amount: actualAmount,
            variance: variance
          };
        })
      );

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

      if (editingBudget) {
        const { error } = await supabase
          .from("budgets")
          .update({
            budget_name: formData.budget_name,
            budget_year: parseInt(formData.budget_year),
            budget_month: parseInt(formData.budget_month),
            category: formData.category,
            budgeted_amount: parseFloat(formData.budgeted_amount),
            notes: formData.notes || null,
          })
          .eq("id", editingBudget.id);

        if (error) throw error;
        toast({ title: "Success", description: "Budget updated successfully" });
      } else {
        const { error } = await supabase.from("budgets").insert({
          company_id: profile!.company_id,
          user_id: user!.id,
          budget_name: formData.budget_name,
          budget_year: parseInt(formData.budget_year),
          budget_month: parseInt(formData.budget_month),
          category: formData.category,
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
      const { error } = await supabase.from("budgets").delete().eq("id", id);
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
                  <TableHead>Budget Name</TableHead>
                  <TableHead>Category</TableHead>
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
                      <TableCell className="font-medium">{budget.budget_name}</TableCell>
                      <TableCell>{budget.category}</TableCell>
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
            <div>
              <Label>Budget Name *</Label>
              <Input
                value={formData.budget_name}
                onChange={(e) => setFormData({ ...formData, budget_name: e.target.value })}
                placeholder="e.g., Q1 Marketing Budget"
                required
              />
            </div>
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
              <Label>Category *</Label>
              <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
};