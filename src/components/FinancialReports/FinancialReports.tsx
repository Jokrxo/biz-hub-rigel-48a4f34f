import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  FileText, 
  Download,
  Calendar,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportFinancialReportToExcel, exportFinancialReportToPDF } from "@/lib/export-utils";
import type { FinancialReportLine } from "@/lib/export-utils";

export const FinancialReports = () => {
  const [loading, setLoading] = useState(true);
  const [profitLossData, setProfitLossData] = useState<FinancialReportLine[]>([]);
  const [balanceSheetData, setBalanceSheetData] = useState<FinancialReportLine[]>([]);
  const [activeReport, setActiveReport] = useState<'pl' | 'bs' | 'cf'>('pl');
  const { toast } = useToast();

  useEffect(() => {
    loadFinancialData();
  }, []);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Fetch chart of accounts with transaction entries
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select(`
          *,
          transaction_entries (
            debit,
            credit
          )
        `)
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      if (accounts) {
        generateProfitLoss(accounts);
        generateBalanceSheet(accounts);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({
        title: "Error",
        description: "Failed to load financial reports",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateProfitLoss = (accounts: any[]) => {
    // Group by account type
    const income = accounts.filter(a => a.account_type.toLowerCase().includes('income') || a.account_type.toLowerCase().includes('revenue'));
    const expenses = accounts.filter(a => a.account_type.toLowerCase().includes('expense') || a.account_type.toLowerCase().includes('cost'));

    const plData: FinancialReportLine[] = [];

    // Calculate total income
    let totalIncome = 0;
    income.forEach(account => {
      const accountTotal = (account.transaction_entries || []).reduce((sum: number, entry: any) => 
        sum + (entry.credit || 0) - (entry.debit || 0), 0
      );
      if (accountTotal !== 0) {
        plData.push({
          account: account.account_name,
          amount: accountTotal,
          type: 'income'
        });
        totalIncome += accountTotal;
      }
    });

    plData.push({
      account: 'Total Income',
      amount: totalIncome,
      type: 'subtotal'
    });

    // Calculate total expenses
    let totalExpenses = 0;
    expenses.forEach(account => {
      const accountTotal = (account.transaction_entries || []).reduce((sum: number, entry: any) => 
        sum + (entry.debit || 0) - (entry.credit || 0), 0
      );
      if (accountTotal !== 0) {
        plData.push({
          account: account.account_name,
          amount: accountTotal,
          type: 'expense'
        });
        totalExpenses += accountTotal;
      }
    });

    plData.push({
      account: 'Total Expenses',
      amount: totalExpenses,
      type: 'subtotal'
    });

    // Net Profit
    plData.push({
      account: 'Net Profit / (Loss)',
      amount: totalIncome - totalExpenses,
      type: 'final'
    });

    setProfitLossData(plData);
  };

  const generateBalanceSheet = (accounts: any[]) => {
    // Group by account type
    const assets = accounts.filter(a => a.account_type.toLowerCase().includes('asset'));
    const liabilities = accounts.filter(a => a.account_type.toLowerCase().includes('liability'));
    const equity = accounts.filter(a => a.account_type.toLowerCase().includes('equity'));

    const bsData: FinancialReportLine[] = [];

    bsData.push({ account: 'ASSETS', amount: 0, type: 'header' });

    // Calculate total assets
    let totalAssets = 0;
    assets.forEach(account => {
      const accountTotal = (account.transaction_entries || []).reduce((sum: number, entry: any) => 
        sum + (entry.debit || 0) - (entry.credit || 0), 0
      );
      if (accountTotal !== 0) {
        bsData.push({
          account: account.account_name,
          amount: accountTotal,
          type: 'asset'
        });
        totalAssets += accountTotal;
      }
    });

    bsData.push({
      account: 'Total Assets',
      amount: totalAssets,
      type: 'subtotal'
    });

    bsData.push({ account: '', amount: 0, type: 'spacer' });
    bsData.push({ account: 'LIABILITIES', amount: 0, type: 'header' });

    // Calculate total liabilities
    let totalLiabilities = 0;
    liabilities.forEach(account => {
      const accountTotal = (account.transaction_entries || []).reduce((sum: number, entry: any) => 
        sum + (entry.credit || 0) - (entry.debit || 0), 0
      );
      if (accountTotal !== 0) {
        bsData.push({
          account: account.account_name,
          amount: accountTotal,
          type: 'liability'
        });
        totalLiabilities += accountTotal;
      }
    });

    bsData.push({
      account: 'Total Liabilities',
      amount: totalLiabilities,
      type: 'subtotal'
    });

    bsData.push({ account: '', amount: 0, type: 'spacer' });
    bsData.push({ account: 'EQUITY', amount: 0, type: 'header' });

    // Calculate total equity
    let totalEquity = 0;
    equity.forEach(account => {
      const accountTotal = (account.transaction_entries || []).reduce((sum: number, entry: any) => 
        sum + (entry.credit || 0) - (entry.debit || 0), 0
      );
      if (accountTotal !== 0) {
        bsData.push({
          account: account.account_name,
          amount: accountTotal,
          type: 'equity'
        });
        totalEquity += accountTotal;
      }
    });

    bsData.push({
      account: 'Total Equity',
      amount: totalEquity,
      type: 'subtotal'
    });

    bsData.push({
      account: 'Total Liabilities & Equity',
      amount: totalLiabilities + totalEquity,
      type: 'final'
    });

    setBalanceSheetData(bsData);
  };

  const handleExportPDF = () => {
    const data = activeReport === 'pl' ? profitLossData : balanceSheetData;
    const reportName = activeReport === 'pl' ? 'Profit & Loss Statement' : 'Balance Sheet';
    const filename = activeReport === 'pl' ? 'profit_loss' : 'balance_sheet';
    
    exportFinancialReportToPDF(data, reportName, new Date().toLocaleDateString('en-ZA'), filename);
    toast({
      title: "Success",
      description: "Report exported to PDF successfully"
    });
  };

  const handleExportExcel = () => {
    const data = activeReport === 'pl' ? profitLossData : balanceSheetData;
    const reportName = activeReport === 'pl' ? 'Profit & Loss' : 'Balance Sheet';
    const filename = activeReport === 'pl' ? 'profit_loss' : 'balance_sheet';
    
    exportFinancialReportToExcel(data, reportName, filename);
    toast({
      title: "Success",
      description: "Report exported to Excel successfully"
    });
  };

  const getCurrentData = () => {
    return activeReport === 'pl' ? profitLossData : balanceSheetData;
  };

  const getStats = () => {
    if (profitLossData.length === 0) {
      return { income: 0, expenses: 0, profit: 0, margin: 0 };
    }

    const totalIncome = profitLossData.find(d => d.type === 'subtotal' && d.account === 'Total Income')?.amount || 0;
    const totalExpenses = profitLossData.find(d => d.type === 'subtotal' && d.account === 'Total Expenses')?.amount || 0;
    const netProfit = profitLossData.find(d => d.type === 'final')?.amount || 0;
    const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return { income: totalIncome, expenses: totalExpenses, profit: netProfit, margin };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">
            View comprehensive financial statements based on your transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={loadFinancialData}>
            <Activity className="h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-xl font-bold">R {stats.income.toLocaleString('en-ZA')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold">R {stats.expenses.toLocaleString('en-ZA')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={`text-xl font-bold ${stats.profit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  R {stats.profit.toLocaleString('en-ZA')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <PieChart className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-xl font-bold">{stats.margin.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Card className="card-professional">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Financial Statements
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={activeReport === 'pl' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveReport('pl')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                P&L
              </Button>
              <Button
                variant={activeReport === 'bs' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveReport('bs')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Balance Sheet
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {getCurrentData().length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No financial data available. Create transactions to generate reports.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Account</TableHead>
                      <TableHead className="text-right font-semibold">Amount (ZAR)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCurrentData().map((item, index) => {
                      if (item.type === 'spacer') {
                        return <TableRow key={index}><TableCell colSpan={2} className="h-4"></TableCell></TableRow>;
                      }
                      if (item.type === 'header') {
                        return (
                          <TableRow key={index} className="bg-muted/50">
                            <TableCell colSpan={2} className="font-bold text-lg">{item.account}</TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <TableRow 
                          key={index} 
                          className={`${
                            item.type === 'subtotal' || item.type === 'total' || item.type === 'final' 
                              ? 'bg-muted/30 font-medium' 
                              : ''
                          }`}
                        >
                          <TableCell 
                            className={`${
                              item.type === 'total' || item.type === 'final' ? 'font-bold' : ''
                            } ${
                              item.type === 'expense' || item.type === 'asset' || item.type === 'liability' || item.type === 'equity' 
                                ? 'pl-8' 
                                : ''
                            }`}
                          >
                            {item.account}
                          </TableCell>
                          <TableCell 
                            className={`text-right font-mono ${
                              item.type === 'income' || item.type === 'subtotal' || item.type === 'total' 
                                ? 'text-primary font-bold' 
                                : item.type === 'final'
                                ? item.amount >= 0 ? 'text-primary font-bold' : 'text-destructive font-bold'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {item.type === 'expense' ? '(' : ''}
                            R {Math.abs(item.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            {item.type === 'expense' ? ')' : ''}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Generated on: {new Date().toLocaleDateString('en-ZA')}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={handleExportPDF}>
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleExportExcel}>
                    <Download className="h-4 w-4" />
                    Export Excel
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
};