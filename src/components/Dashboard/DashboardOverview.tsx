import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  AlertTriangle,
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Briefcase
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export const DashboardOverview = () => {
  const { toast } = useToast();
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

  useEffect(() => {
    loadDashboardData();
  }, []);

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

      // Load transactions
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select(`
          *,
          entries:transaction_entries(
            id,
            debit,
            credit,
            chart_of_accounts(account_type)
          )
        `)
        .eq("company_id", profile.company_id)
        .eq("status", "approved")
        .order("transaction_date", { ascending: false })
        .limit(5);

      if (txError) throw txError;

      // Calculate totals by account type
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

      // Load bank balance
      const { data: banks } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("company_id", profile.company_id);

      const bankBalance = banks?.reduce((sum, b) => sum + b.current_balance, 0) || 0;

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

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your financial overview for ABC Trading (Pty) Ltd
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Jan 2024
          </Badge>
        </div>
      </div>

      {/* Key Metrics - Accounting Elements */}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
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
            <Button variant="outline" className="w-full mt-4">
              View All Transactions
            </Button>
          </CardContent>
        </Card>

        {/* Trial Balance Summary */}
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
                <Button variant="outline" size="sm" className="justify-start">
                  View Trial Balance
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Generate Reports
                </Button>
                <Button variant="outline" size="sm" className="justify-start">
                  Add Transaction
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting Equation */}
      <Card className="card-professional">
        <CardHeader>
          <CardTitle>Accounting Equation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 text-lg font-semibold">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Assets</div>
              <div className="text-2xl text-primary">R {metrics.totalAssets.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="text-3xl">=</div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Liabilities</div>
              <div className="text-2xl text-destructive">R {metrics.totalLiabilities.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="text-3xl">+</div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Equity</div>
              <div className="text-2xl text-accent">R {metrics.totalEquity.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Net Profit</div>
              <div className={`text-2xl font-bold ${
                metrics.totalIncome - metrics.totalExpenses >= 0 ? 'text-primary' : 'text-destructive'
              }`}>
                R {(metrics.totalIncome - metrics.totalExpenses).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Income (R {metrics.totalIncome.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}) - 
                Expenses (R {metrics.totalExpenses.toLocaleString('en-ZA', { maximumFractionDigits: 0 })})
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};