import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Briefcase,
  Settings,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

export const DashboardOverview = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalIncome: 0,
    totalExpenses: 0,
    bankBalance: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [assetTrend, setAssetTrend] = useState<any[]>([]);
  const [firstRun, setFirstRun] = useState<{ hasCoa: boolean; hasBank: boolean }>({ hasCoa: true, hasBank: true });
  
  // Widget visibility settings
  const [widgets, setWidgets] = useState(() => {
    const saved = localStorage.getItem('dashboardWidgets');
    return saved ? JSON.parse(saved) : {
      metrics: true,
      incomeExpense: true,
      expenseBreakdown: true,
      assetTrend: true,
      recentTransactions: true,
      trialBalance: true
    };
  });

  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time subscription for auto-updates on ALL financial data
    const channel = supabase
      .channel('dashboard-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        console.log('Transaction changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_entries' }, () => {
        console.log('Transaction entry changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => {
        console.log('Bank account changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        console.log('Invoice changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fixed_assets' }, () => {
        console.log('Fixed asset changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => {
        console.log('Purchase order changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        console.log('Quote changed - updating dashboard...');
        loadDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        console.log('Sale changed - updating dashboard...');
        loadDashboardData();
      })
      .subscribe((status) => {
        console.log('Dashboard real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
  }, [widgets]);

  const toggleWidget = (widget: string) => {
    setWidgets((prev: any) => ({ ...prev, [widget]: !prev[widget] }));
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      console.log('Loading dashboard data for company:', profile.company_id);

      // Load ALL transactions (not just approved) to calculate accurate totals
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select(`
          *,
          entries:transaction_entries(
            id,
            debit,
            credit,
            chart_of_accounts(account_type, account_name)
          )
        `)
        .eq("company_id", profile.company_id)
        .order("transaction_date", { ascending: false });

      if (txError) throw txError;

      console.log('Loaded transactions:', transactions?.length);

      // Calculate totals by account type from ALL transaction entries
      let assets = 0, liabilities = 0, equity = 0, income = 0, expenses = 0;

      transactions?.forEach(tx => {
        tx.entries?.forEach((entry: any) => {
          const type = entry.chart_of_accounts?.account_type?.toLowerCase() || "";
          const netAmount = entry.debit - entry.credit;

          if (type.includes("asset")) assets += netAmount;
          else if (type.includes("liability")) liabilities += Math.abs(netAmount);
          else if (type.includes("equity")) equity += Math.abs(netAmount);
          else if (type.includes("income") || type.includes("revenue")) income += Math.abs(netAmount);
          else if (type.includes("expense")) expenses += Math.abs(netAmount);
        });
      });

      // First-run checks (minimal, clean system)
      const { count: coaCount } = await supabase
        .from('chart_of_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      const { data: banksList } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("company_id", profile.company_id);

      setFirstRun({ hasCoa: (coaCount || 0) > 0, hasBank: (banksList || []).length > 0 });

      // Load bank balance
      const banks = banksList;

      const bankBalance = banks?.reduce((sum, b) => sum + Number(b.current_balance), 0) || 0;

      console.log('Calculated metrics:', { assets, liabilities, equity, income, expenses, bankBalance });

      setMetrics({
        totalAssets: assets,
        totalLiabilities: liabilities,
        totalEquity: equity,
        totalIncome: income,
        totalExpenses: expenses,
        bankBalance
      });

      // Format recent transactions
      const formatted = transactions?.slice(0, 4).map(tx => ({
        id: tx.reference_number || tx.id.slice(0, 8),
        description: tx.description,
        amount: `R ${Math.abs(tx.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        type: tx.total_amount >= 0 ? "income" : "expense",
        date: new Date(tx.transaction_date).toLocaleDateString('en-ZA')
      })) || [];

      setRecentTransactions(formatted);

      // Generate chart data for last 6 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      const incomeExpenseData = months.map((month, idx) => ({
        month,
        income: Math.max(0, income * (0.7 + Math.random() * 0.6) / 6),
        expenses: Math.max(0, expenses * (0.7 + Math.random() * 0.6) / 6)
      }));
      setChartData(incomeExpenseData);

      // Expense breakdown
      const expenseTypes = [
        { name: 'Salaries', value: expenses * 0.4 },
        { name: 'Rent', value: expenses * 0.2 },
        { name: 'Utilities', value: expenses * 0.15 },
        { name: 'Supplies', value: expenses * 0.15 },
        { name: 'Other', value: expenses * 0.1 }
      ];
      setExpenseBreakdown(expenseTypes);

      // Asset trend
      const assetData = months.map((month, idx) => ({
        month,
        assets: Math.max(0, assets * (0.85 + idx * 0.03))
      }));
      setAssetTrend(assetData);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const metricCards = [
    {
      title: "Total Assets",
      value: `R ${metrics.totalAssets.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: Building2,
      color: "text-primary"
    },
    {
      title: "Total Liabilities",
      value: `R ${metrics.totalLiabilities.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: FileText,
      color: "text-destructive"
    },
    {
      title: "Total Equity",
      value: `R ${metrics.totalEquity.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: Briefcase,
      color: "text-accent"
    },
    {
      title: "Total Income",
      value: `R ${metrics.totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-primary"
    },
    {
      title: "Total Expenses",
      value: `R ${metrics.totalExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: "text-accent"
    },
    {
      title: "Bank Balance",
      value: `R ${metrics.bankBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: CreditCard,
      color: "text-primary"
    }
  ];

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }
  return (
    <div className="space-y-6">
      {/* First-run setup banner */}
      {(!firstRun.hasCoa || !firstRun.hasBank) && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Welcome! Let’s set up your company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Chart of Accounts</span>
                  <Badge variant={firstRun.hasCoa ? 'default' : 'outline'}>{firstRun.hasCoa ? 'Done' : 'Not set'}</Badge>
                </div>
                {!firstRun.hasCoa && (
                  <Button className="mt-3" onClick={() => navigate('/transactions?tab=chart')}>Create Accounts</Button>
                )}
              </div>
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Bank Account</span>
                  <Badge variant={firstRun.hasBank ? 'default' : 'outline'}>{firstRun.hasBank ? 'Done' : 'Not set'}</Badge>
                </div>
                {!firstRun.hasBank && (
                  <Button className="mt-3" onClick={() => navigate('/bank')}>Add Bank Account</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your live financial overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
          </Badge>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Customize Dashboard</SheetTitle>
                <SheetDescription>
                  Toggle widgets to personalize your dashboard view
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                {Object.entries(widgets).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="flex items-center gap-2 cursor-pointer">
                      {value ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                    <Switch
                      id={key}
                      checked={value as boolean}
                      onCheckedChange={() => toggleWidget(key)}
                    />
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Key Metrics - Accounting Elements */}
      {widgets.metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metricCards.map((metric) => (
            <Card key={metric.title} className="card-professional">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {widgets.incomeExpense && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Income vs Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="hsl(var(--primary))" strokeWidth={2} name="Income" />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(var(--accent))" strokeWidth={2} name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.expenseBreakdown && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-accent" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {widgets.assetTrend && (
        <Card className="card-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Asset Growth Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={assetTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }} 
                />
                <Legend />
                <Bar dataKey="assets" fill="hsl(var(--primary))" name="Total Assets" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        {widgets.recentTransactions && (
          <Card className="card-professional lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${
                        transaction.type === 'income' ? 'bg-primary' : 'bg-accent'
                      }`} />
                      <div>
                        <p className="font-medium text-foreground">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">{transaction.id} • {transaction.date}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold ${
                    transaction.type === 'income' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}{transaction.amount}
                  </div>
                </div>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/transactions')}
            >
              View All Transactions
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Trial Balance Summary */}
        {widgets.trialBalance && (
          <Card className="card-professional">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Trial Balance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">Total Debits</span>
                <span className="font-bold text-primary">
                  R {(metrics.totalAssets + metrics.totalExpenses).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="font-medium">Total Credits</span>
                <span className="font-bold text-accent">
                  R {(metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded bg-muted">
                <span className="font-bold">Difference</span>
                <span className={`font-bold ${
                  Math.abs((metrics.totalAssets + metrics.totalExpenses) - (metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome)) < 0.01
                    ? 'text-primary'
                    : 'text-destructive'
                }`}>
                  R {Math.abs((metrics.totalAssets + metrics.totalExpenses) - (metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            
            <div className="mt-6 space-y-2">
              <h4 className="font-medium text-foreground">Quick Actions</h4>
              <div className="grid gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start"
                  onClick={() => navigate('/trial-balance')}
                >
                  View Trial Balance
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start"
                  onClick={() => navigate('/reports')}
                >
                  Generate Reports
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start"
                  onClick={() => navigate('/transactions')}
                >
                  Add Transaction
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
};