import { useState, useEffect, useCallback } from "react";
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
  const [cashFlowData, setCashFlowData] = useState<FinancialReportLine[]>([]);
  const [activeReport, setActiveReport] = useState<'pl' | 'bs' | 'cf'>('pl');
  const { toast } = useToast();

  const loadFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!profile?.company_id) return;
      const { data: storedStatements, error: fsError } = await supabase
        .rpc('get_latest_financial_statements', { _company_id: profile.company_id });
      if (fsError) throw fsError;
      if (storedStatements && (storedStatements.balance_sheet || storedStatements.income_statement || storedStatements.cash_flow_statement)) {
        if (storedStatements.balance_sheet) { parseStoredBalanceSheet(storedStatements.balance_sheet); }
        if (storedStatements.income_statement) { parseStoredIncomeStatement(storedStatements.income_statement); }
        if (storedStatements.cash_flow_statement) { parseStoredCashFlowStatement(storedStatements.cash_flow_statement); }
      } else {
        const { data: trialBalance, error: tbError } = await supabase.rpc('get_trial_balance_for_company');
        if (tbError) throw tbError;
        if (trialBalance) {
          generateProfitLoss(trialBalance);
          generateBalanceSheet(trialBalance);
          await generateCashFlow(profile.company_id);
        }
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({ title: "Error", description: "Failed to load financial reports", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast, generateCashFlow]);
  useEffect(() => { loadFinancialData(); }, [loadFinancialData]);


  const generateProfitLoss = (trialBalance: any[]) => {
    // Group by account type - use trial balance balances directly
    const income = trialBalance.filter(a => a.account_type.toLowerCase() === 'revenue' || a.account_type.toLowerCase() === 'income');
    const expenses = trialBalance.filter(a => a.account_type.toLowerCase() === 'expense');

    const plData: FinancialReportLine[] = [];

    // Calculate total income - use balance from trial balance directly
    let totalIncome = 0;
    income.forEach(account => {
      // For revenue accounts, balance is already calculated correctly
      const accountTotal = account.balance || 0;
      if (Math.abs(accountTotal) > 0.01) {
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

    // Calculate total expenses - use balance from trial balance directly
    let totalExpenses = 0;
    expenses.forEach(account => {
      // For expense accounts, balance is already calculated correctly
      const accountTotal = account.balance || 0;
      if (Math.abs(accountTotal) > 0.01) {
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

  const generateBalanceSheet = (trialBalance: any[]) => {
    // Group by account type - use trial balance balances directly
    const assets = trialBalance.filter(a => a.account_type.toLowerCase() === 'asset');
    const liabilities = trialBalance.filter(a => a.account_type.toLowerCase() === 'liability');
    const equity = trialBalance.filter(a => a.account_type.toLowerCase() === 'equity');

    const bsData: FinancialReportLine[] = [];

    bsData.push({ account: 'ASSETS', amount: 0, type: 'header' });

    // Calculate total assets - use balance from trial balance directly
    let totalAssets = 0;
    const normalizeName = (name: string) => name.toLowerCase()
      .replace(/accumulated/g, '')
      .replace(/depreciation/g, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const accumulatedRows = assets.filter(a => (a.account_name || '').toLowerCase().includes('accumulated'));
    const nbvFor = (assetRow: any) => {
      const base = normalizeName(assetRow.account_name || '');
      const related = accumulatedRows.filter((ad: any) => {
        const adBase = normalizeName(ad.account_name || '');
        return adBase.includes(base) || base.includes(adBase);
      });
      const accTotal = related.reduce((sum: number, r: any) => sum + (r.balance || 0), 0);
      return (assetRow.balance || 0) - accTotal;
    };

    assets.forEach(account => {
      const isAccumulated = (account.account_name || '').toLowerCase().includes('accumulated');
      const displayAmount = isAccumulated ? 0 : nbvFor(account);
      if (Math.abs(displayAmount) > 0.01) {
        bsData.push({
          account: account.account_name,
          amount: displayAmount,
          type: 'asset'
        });
        totalAssets += displayAmount;
      }
    });

    bsData.push({
      account: 'Total Assets',
      amount: totalAssets,
      type: 'subtotal'
    });

    bsData.push({ account: '', amount: 0, type: 'spacer' });
    bsData.push({ account: 'LIABILITIES', amount: 0, type: 'header' });

    // Calculate total liabilities - use balance from trial balance directly
    let totalLiabilities = 0;
    liabilities.forEach(account => {
      // For liability accounts, balance is already calculated correctly
      const accountTotal = account.balance || 0;
      if (Math.abs(accountTotal) > 0.01) {
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

    // Calculate total equity - use balance from trial balance directly
    let totalEquity = 0;
    equity.forEach(account => {
      // For equity accounts, balance is already calculated correctly
      const accountTotal = account.balance || 0;
      if (Math.abs(accountTotal) > 0.01) {
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

  const generateCashFlow = async (companyId: string) => {
    try {
      // Get date range (current year)
      const currentYear = new Date().getFullYear();
      const periodStart = `${currentYear}-01-01`;
      const periodEnd = `${currentYear}-12-31`;

      const { data, error } = await supabase
        .rpc('generate_cash_flow', {
          _company_id: companyId,
          _period_start: periodStart,
          _period_end: periodEnd
        });

      if (error) throw error;

      if (data && data.length > 0) {
        const cf = data[0];
        const cfData: FinancialReportLine[] = [
          { account: 'CASH FLOW FROM OPERATING ACTIVITIES', amount: 0, type: 'header' },
          { account: 'Operating Activities', amount: cf.operating_activities || 0, type: 'income' },
          { account: '', amount: 0, type: 'spacer' },
          { account: 'CASH FLOW FROM INVESTING ACTIVITIES', amount: 0, type: 'header' },
          { account: 'Investing Activities', amount: cf.investing_activities || 0, type: 'expense' },
          { account: '', amount: 0, type: 'spacer' },
          { account: 'CASH FLOW FROM FINANCING ACTIVITIES', amount: 0, type: 'header' },
          { account: 'Financing Activities', amount: cf.financing_activities || 0, type: 'income' },
          { account: '', amount: 0, type: 'spacer' },
          { account: 'Net Cash Flow', amount: cf.net_cash_flow || 0, type: 'subtotal' },
          { account: '', amount: 0, type: 'spacer' },
          { account: 'Opening Cash Balance', amount: cf.opening_cash || 0, type: 'asset' },
          { account: 'Net Cash Flow', amount: cf.net_cash_flow || 0, type: 'asset' },
          { account: 'Closing Cash Balance', amount: cf.closing_cash || 0, type: 'final' },
        ];
        setCashFlowData(cfData);
      }
    } catch (error) {
      console.error('Error generating cash flow:', error);
      toast({
        title: "Error",
        description: "Failed to generate cash flow statement",
        variant: "destructive"
      });
    }
  };

  const handleExportPDF = () => {
    const data = activeReport === 'pl' ? profitLossData : activeReport === 'bs' ? balanceSheetData : cashFlowData;
    const reportName = activeReport === 'pl' ? 'Profit & Loss Statement' : activeReport === 'bs' ? 'Balance Sheet' : 'Cash Flow Statement';
    const filename = activeReport === 'pl' ? 'profit_loss' : activeReport === 'bs' ? 'balance_sheet' : 'cash_flow';
    
    exportFinancialReportToPDF(data, reportName, new Date().toLocaleDateString('en-ZA'), filename);
    toast({
      title: "Success",
      description: "Report exported to PDF successfully"
    });
  };

  const handleExportExcel = () => {
    const data = activeReport === 'pl' ? profitLossData : activeReport === 'bs' ? balanceSheetData : cashFlowData;
    const reportName = activeReport === 'pl' ? 'Profit & Loss' : activeReport === 'bs' ? 'Balance Sheet' : 'Cash Flow';
    const filename = activeReport === 'pl' ? 'profit_loss' : activeReport === 'bs' ? 'balance_sheet' : 'cash_flow';
    
    exportFinancialReportToExcel(data, reportName, filename);
    toast({
      title: "Success",
      description: "Report exported to Excel successfully"
    });
  };

  const getCurrentData = () => {
    return activeReport === 'pl' ? profitLossData : activeReport === 'bs' ? balanceSheetData : cashFlowData;
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
              <Button
                variant={activeReport === 'cf' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveReport('cf')}
              >
                <Activity className="h-4 w-4 mr-2" />
                Cash Flow
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
