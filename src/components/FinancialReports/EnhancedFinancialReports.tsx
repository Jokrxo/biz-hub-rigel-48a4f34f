import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { exportFinancialReportToExcel, exportFinancialReportToPDF } from "@/lib/export-utils";
import type { FinancialReportLine } from "@/lib/export-utils";
import { AccountDrilldown } from "./AccountDrilldown";
import { 
  FileText, 
  Download, 
  TrendingUp, 
  BarChart3, 
  Activity,
  Loader2,
  Calendar,
  Eye
} from "lucide-react";

export const EnhancedFinancialReports = () => {
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'pl' | 'bs' | 'cf'>('pl');
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-01-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<{
    profitLoss: any[];
    balanceSheet: any[];
    cashFlow: any[];
  }>({ profitLoss: [], balanceSheet: [], cashFlow: [] });
  
  const [drilldownAccount, setDrilldownAccount] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadFinancialData();
  }, [periodStart, periodEnd]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      // Defensive data check: warn on transactions with NULL dates (excluded from reports)
      try {
        const { count: nullTxCount } = await supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', profile.company_id)
          .is('transaction_date', null);

        if ((nullTxCount || 0) > 0) {
          toast({
            title: 'Missing transaction dates detected',
            description: `${nullTxCount} transaction(s) have no date and were excluded from period reports. Please update their dates for accurate reporting.`,
            variant: 'warning'
          });
        }
      } catch (warnErr) {
        // Non-blocking warning check
        console.warn('Null-date check failed:', warnErr);
      }

      // Build trial balance for the selected period from ledger entries
      const trialBalance = await fetchTrialBalanceForPeriod(profile.company_id, periodStart, periodEnd);

      const pl = generateProfitLoss(trialBalance);
      const bs = generateBalanceSheet(trialBalance);
      const cf = await generateCashFlow(profile.company_id);
      
      setReportData({
        profitLoss: pl,
        balanceSheet: bs,
        cashFlow: cf
      });
    } catch (error: any) {
      console.error('Error loading financial data:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch period-specific trial balance using transaction_entries joined to transactions.date within range
  const fetchTrialBalanceForPeriod = async (companyId: string, start: string, end: string) => {
    // Ensure valid ISO date strings
    const startDateObj = new Date(start);
    const startISO = startDateObj.toISOString();
    const endDateObj = new Date(end);
    // Set to end-of-day to make filter inclusive
    endDateObj.setHours(23, 59, 59, 999);
    const endISO = endDateObj.toISOString();

    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select(`
        id,
        account_code,
        account_name,
        account_type,
        transaction_entries (
          debit,
          credit,
          transactions!inner (
            transaction_date
          )
        )
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .not('transaction_entries.transactions.transaction_date', 'is', null)
      .gte('transaction_entries.transactions.transaction_date', startISO)
      .lte('transaction_entries.transactions.transaction_date', endISO)
      .order('account_code');

    if (error) throw error;

    const trialBalance: Array<{ account_id: string; account_code: string; account_name: string; account_type: string; balance: number; }> = [];

    (data || []).forEach((acc: any) => {
      let sumDebit = 0;
      let sumCredit = 0;
      (acc.transaction_entries || []).forEach((le: any) => {
        const dStr = le.transactions?.transaction_date;
        const d = dStr ? new Date(dStr) : null;
        // Strict period enforcement: only include entries with valid date within range
        if (d && d >= startDateObj && d <= endDateObj) {
          sumDebit += Number(le.debit || 0);
          sumCredit += Number(le.credit || 0);
        }
      });

      // Map sign convention by account type
      const type = (acc.account_type || '').toLowerCase();
      const naturalDebit = type === 'asset' || type === 'expense';
      const balance = naturalDebit ? (sumDebit - sumCredit) : (sumCredit - sumDebit);

      if (Math.abs(balance) > 0.01) {
        trialBalance.push({
          account_id: acc.id,
          account_code: acc.account_code,
          account_name: acc.account_name,
          account_type: acc.account_type,
          balance
        });
      }
    });

    return trialBalance;
  };

  const generateProfitLoss = (trialBalance: any[]): any[] => {
    const data: any[] = [];
    
    // Revenue Section - use trial balance balances directly
    data.push({ type: 'header', account: 'REVENUE', amount: 0, accountId: null });
    const revenue = trialBalance.filter(a => 
      a.account_type.toLowerCase() === 'revenue' || 
      a.account_type.toLowerCase() === 'income'
    );
    
    let totalRevenue = 0;
    revenue.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'income', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalRevenue += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Revenue', amount: totalRevenue, accountId: null });

    // Cost of Sales - use trial balance balances directly
    data.push({ type: 'spacer', account: '', amount: 0, accountId: null });
    data.push({ type: 'header', account: 'COST OF SALES', amount: 0, accountId: null });
    const cogs = trialBalance.filter(a => 
      a.account_type.toLowerCase() === 'expense' && 
      (a.account_name.toLowerCase().includes('cost of') || a.account_code.startsWith('5000'))
    );
    
    let totalCOGS = 0;
    cogs.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'expense', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalCOGS += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Cost of Sales', amount: totalCOGS, accountId: null });
    data.push({ type: 'subtotal', account: 'Gross Profit', amount: totalRevenue - totalCOGS, accountId: null });

    // Operating Expenses - use trial balance balances directly
    data.push({ type: 'spacer', account: '', amount: 0, accountId: null });
    data.push({ type: 'header', account: 'OPERATING EXPENSES', amount: 0, accountId: null });
    const opex = trialBalance.filter(a => 
      a.account_type.toLowerCase() === 'expense' && 
      !a.account_name.toLowerCase().includes('cost of') &&
      !a.account_code.startsWith('5000')
    );
    
    let totalOpex = 0;
    opex.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'expense', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalOpex += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Operating Expenses', amount: totalOpex, accountId: null });
    
    const netProfit = totalRevenue - totalCOGS - totalOpex;
    data.push({ type: 'spacer', account: '', amount: 0, accountId: null });
    data.push({ type: 'final', account: 'Net Profit / (Loss)', amount: netProfit, accountId: null });

    return data;
  };

  const generateBalanceSheet = (trialBalance: any[]): any[] => {
    const data: any[] = [];

    // ASSETS - use trial balance balances directly
    data.push({ type: 'header', account: 'ASSETS', amount: 0, accountId: null });
    
    // Current Assets
    data.push({ type: 'subheader', account: 'Current Assets', amount: 0, accountId: null });
    const currentAssets = trialBalance.filter(a => 
      a.account_type.toLowerCase() === 'asset' && 
      parseInt(a.account_code || '0') < 1500
    );
    
    let totalCurrentAssets = 0;
    currentAssets.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'asset', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalCurrentAssets += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Current Assets', amount: totalCurrentAssets, accountId: null });

    // Fixed Assets
    data.push({ type: 'subheader', account: 'Fixed Assets', amount: 0, accountId: null });
    const fixedAssets = trialBalance.filter(a => 
      a.account_type.toLowerCase() === 'asset' && 
      parseInt(a.account_code || '0') >= 1500
    );
    
    let totalFixedAssets = 0;
    fixedAssets.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'asset', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalFixedAssets += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Fixed Assets', amount: totalFixedAssets, accountId: null });
    data.push({ type: 'total', account: 'TOTAL ASSETS', amount: totalCurrentAssets + totalFixedAssets, accountId: null });

    // LIABILITIES & EQUITY - use trial balance balances directly
    data.push({ type: 'spacer', account: '', amount: 0, accountId: null });
    data.push({ type: 'header', account: 'LIABILITIES', amount: 0, accountId: null });
    
    const liabilities = trialBalance.filter(a => a.account_type.toLowerCase() === 'liability');
    let totalLiabilities = 0;
    liabilities.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'liability', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalLiabilities += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Liabilities', amount: totalLiabilities, accountId: null });

    data.push({ type: 'spacer', account: '', amount: 0, accountId: null });
    data.push({ type: 'header', account: 'EQUITY', amount: 0, accountId: null });
    
    const equity = trialBalance.filter(a => a.account_type.toLowerCase() === 'equity');
    let totalEquity = 0;
    equity.forEach(acc => {
      // Use balance from trial balance directly
      const total = acc.balance || 0;
      if (Math.abs(total) > 0.01) {
        data.push({ 
          type: 'equity', 
          account: acc.account_name, 
          amount: total,
          accountId: acc.account_id,
          accountCode: acc.account_code
        });
        totalEquity += total;
      }
    });
    data.push({ type: 'subtotal', account: 'Total Equity', amount: totalEquity, accountId: null });
    data.push({ type: 'final', account: 'TOTAL LIABILITIES & EQUITY', amount: totalLiabilities + totalEquity, accountId: null });

    return data;
  };

  const generateCashFlow = async (companyId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase.rpc('generate_cash_flow', {
        _company_id: companyId,
        _period_start: periodStart,
        _period_end: periodEnd
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const cf = data[0];
        return [
          { type: 'header', account: 'OPERATING ACTIVITIES', amount: 0, accountId: null },
          { type: 'income', account: 'Net cash from operating activities', amount: cf.operating_activities || 0, accountId: null },
          { type: 'spacer', account: '', amount: 0, accountId: null },
          { type: 'header', account: 'INVESTING ACTIVITIES', amount: 0, accountId: null },
          { type: 'expense', account: 'Net cash from investing activities', amount: cf.investing_activities || 0, accountId: null },
          { type: 'spacer', account: '', amount: 0, accountId: null },
          { type: 'header', account: 'FINANCING ACTIVITIES', amount: 0, accountId: null },
          { type: 'income', account: 'Net cash from financing activities', amount: cf.financing_activities || 0, accountId: null },
          { type: 'spacer', account: '', amount: 0, accountId: null },
          { type: 'subtotal', account: 'Net Increase in Cash', amount: cf.net_cash_flow || 0, accountId: null },
          { type: 'asset', account: 'Opening Cash Balance', amount: cf.opening_cash || 0, accountId: null },
          { type: 'final', account: 'Closing Cash Balance', amount: cf.closing_cash || 0, accountId: null },
        ];
      }
    } catch (error) {
      console.error('Error generating cash flow:', error);
    }
    return [];
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const data = activeReport === 'pl' ? reportData.profitLoss : 
                 activeReport === 'bs' ? reportData.balanceSheet : 
                 reportData.cashFlow;
    
    const reportName = activeReport === 'pl' ? 'Income Statement' : 
                       activeReport === 'bs' ? 'Statement of Financial Position' : 
                       'Cash Flow Statement';
    
    const filename = `${reportName.toLowerCase().replace(/ /g, '_')}_${periodStart}_to_${periodEnd}`;

    if (format === 'pdf') {
      exportFinancialReportToPDF(
        data.map(d => ({ account: d.account, amount: d.amount, type: d.type })), 
        reportName, 
        `${periodStart} to ${periodEnd}`, 
        filename
      );
    } else {
      exportFinancialReportToExcel(
        data.map(d => ({ account: d.account, amount: d.amount, type: d.type })), 
        reportName, 
        filename
      );
    }
    
    toast({ title: "Success", description: `Report exported to ${format.toUpperCase()}` });
  };

  const handleRowClick = (item: any) => {
    if (item.accountId) {
      setDrilldownAccount({
        id: item.accountId,
        name: item.account,
        code: item.accountCode
      });
    }
  };

  const getCurrentData = () => {
    return activeReport === 'pl' ? reportData.profitLoss : 
           activeReport === 'bs' ? reportData.balanceSheet : 
           reportData.cashFlow;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Annual Financial Statements</h1>
          <p className="text-muted-foreground mt-1">GAAP-compliant financial statements with drill-down capability</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={loadFinancialData}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Period Selection
          </CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                setPeriodStart(start.toISOString().split('T')[0]);
                setPeriodEnd(end.toISOString().split('T')[0]);
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const q = Math.floor(now.getMonth() / 3); // 0-based quarter
                const qStartMonth = q * 3;
                const start = new Date(now.getFullYear(), qStartMonth, 1);
                const end = new Date(now.getFullYear(), qStartMonth + 3, 0);
                setPeriodStart(start.toISOString().split('T')[0]);
                setPeriodEnd(end.toISOString().split('T')[0]);
              }}
            >
              This Quarter
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31);
                setPeriodStart(start.toISOString().split('T')[0]);
                setPeriodEnd(end.toISOString().split('T')[0]);
              }}
            >
              This Year
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Period Start</Label>
              <Input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Period End</Label>
              <Input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeReport} onValueChange={(v) => setActiveReport(v as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="pl">
            <TrendingUp className="h-4 w-4 mr-2" />
            Income Statement
          </TabsTrigger>
          <TabsTrigger value="bs">
            <BarChart3 className="h-4 w-4 mr-2" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="cf">
            <Activity className="h-4 w-4 mr-2" />
            Cash Flow
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeReport}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {activeReport === 'pl' ? 'Income Statement' : 
                   activeReport === 'bs' ? 'Statement of Financial Position' : 
                   'Cash Flow Statement'}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {getCurrentData().length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No financial data for the selected period
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount (ZAR)</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCurrentData().map((item, index) => {
                      if (item.type === 'spacer') {
                        return <TableRow key={index}><TableCell colSpan={3} className="h-4"></TableCell></TableRow>;
                      }
                      if (item.type === 'header') {
                        return (
                          <TableRow key={index} className="bg-muted/50">
                            <TableCell colSpan={3} className="font-bold text-lg">{item.account}</TableCell>
                          </TableRow>
                        );
                      }
                      if (item.type === 'subheader') {
                        return (
                          <TableRow key={index}>
                            <TableCell colSpan={3} className="font-semibold text-sm pl-4">{item.account}</TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <TableRow 
                          key={index}
                          className={`${
                            item.type === 'subtotal' || item.type === 'total' || item.type === 'final' 
                              ? 'bg-muted/30 font-medium' 
                              : item.accountId ? 'cursor-pointer hover:bg-muted/20' : ''
                          }`}
                          onClick={() => handleRowClick(item)}
                        >
                          <TableCell 
                            className={`${
                              item.type === 'total' || item.type === 'final' ? 'font-bold' : ''
                            } ${
                              ['expense', 'asset', 'liability', 'equity'].includes(item.type) ? 'pl-8' : ''
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
                          <TableCell>
                            {item.accountId && <Eye className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                Period: {new Date(periodStart).toLocaleDateString('en-ZA')} to {new Date(periodEnd).toLocaleDateString('en-ZA')}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {drilldownAccount && (
        <AccountDrilldown
          open={!!drilldownAccount}
          onOpenChange={(open) => !open && setDrilldownAccount(null)}
          accountId={drilldownAccount.id}
          accountName={drilldownAccount.name}
          accountCode={drilldownAccount.code}
        />
      )}
    </div>
  );
};
