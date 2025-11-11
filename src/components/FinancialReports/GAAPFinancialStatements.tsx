import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download, Eye, Calendar, FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  total_debits: number;
  total_credits: number;
  balance: number;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  reference_id: string;
}

export const GAAPFinancialStatements = () => {
  const [loading, setLoading] = useState(false);
  const [periodMode, setPeriodMode] = useState<'monthly' | 'annual'>('annual');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0,7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<string>('balance-sheet');
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1); // January 1st
    return date.toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [drilldownAccount, setDrilldownAccount] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [accountingEquation, setAccountingEquation] = useState<{
    is_valid: boolean;
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    difference: number;
    error_message: string;
  } | null>(null);
  const [cashFlow, setCashFlow] = useState<{
    operating_inflows: number;
    operating_outflows: number;
    net_cash_from_operations: number;
    investing_inflows: number;
    investing_outflows: number;
    net_cash_from_investing: number;
    financing_inflows: number;
    financing_outflows: number;
    net_cash_from_financing: number;
    opening_cash_balance: number;
    closing_cash_balance: number;
    net_change_in_cash: number;
  } | null>(null);

  useEffect(() => {
    loadFinancialData();
  }, [periodStart, periodEnd]);

  useEffect(() => {
    // Recompute period range when mode/month/year changes
    if (periodMode === 'monthly') {
      // selectedMonth format YYYY-MM
      const [y, m] = selectedMonth.split('-').map((v) => parseInt(v, 10));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0); // last day of month
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    } else {
      const start = new Date(selectedYear, 0, 1);
      const end = new Date(selectedYear, 11, 31);
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    }
  }, [periodMode, selectedMonth, selectedYear]);

  // Load cash flow whenever cash-flow tab is active or period changes
  useEffect(() => {
    if (activeTab === 'cash-flow') {
      loadCashFlow();
    }
  }, [activeTab, periodStart, periodEnd]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: companyProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!companyProfile?.company_id) throw new Error("Company not found");

      // Get trial balance from secure function
      const { data: tbData, error: tbError } = await supabase
        .rpc('get_trial_balance_for_company');

      if (tbError) throw tbError;
      setTrialBalance(tbData || []);

      // Validate accounting equation
      const { data: equation, error: eqError } = await supabase
        .rpc('validate_accounting_equation', { _company_id: companyProfile.company_id });

      if (eqError) throw eqError;
      if (equation && equation.length > 0) {
        setAccountingEquation(equation[0]);
      }

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

  const handleRefresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: companyProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyProfile?.company_id) return;

    await supabase.rpc('refresh_afs_cache', { _company_id: companyProfile.company_id });
    await loadFinancialData();
    toast({ title: "Success", description: "Financial statements refreshed" });
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    try {
      if (type === 'pdf') {
        window.print();
        return;
      }
      // Build simple CSV for Excel
      const header = ['Account Code', 'Account Name', 'Type', 'Normal Balance', 'Debits', 'Credits', 'Balance'];
      const rows = trialBalance.map(r => [
        r.account_code,
        r.account_name,
        r.account_type,
        r.normal_balance,
        r.total_debits,
        r.total_credits,
        r.balance,
      ]);
      const csv = [header, ...rows]
        .map(cols => cols.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const label = periodMode === 'monthly' ? selectedMonth : `${selectedYear}`;
      a.download = `AFS_${label}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'Export error', description: e.message || 'Could not export', variant: 'destructive' });
    }
  };

  const loadCashFlow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!profile?.company_id) return;
      const { data, error } = await supabase.rpc('get_cash_flow_statement', {
        _company_id: profile.company_id,
        _period_start: periodStart,
        _period_end: periodEnd,
      });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        // Server returns the exact shape; trust server-side accounting logic
        setCashFlow(data[0] as {
          operating_inflows: number;
          operating_outflows: number;
          net_cash_from_operations: number;
          investing_inflows: number;
          investing_outflows: number;
          net_cash_from_investing: number;
          financing_inflows: number;
          financing_outflows: number;
          net_cash_from_financing: number;
          opening_cash_balance: number;
          closing_cash_balance: number;
          net_change_in_cash: number;
        });
      } else {
        setCashFlow(null);
      }
    } catch (e) {
      // Non-fatal if cash flow RPC missing; keep UI responsive
      setCashFlow(null);
    }
  };

  const handleDrilldown = async (accountId: string, accountName: string) => {
    setDrilldownAccount(accountName);
    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('id, entry_date, description, debit, credit, reference_id')
        .eq('account_id', accountId)
        .gte('entry_date', periodStart)
        .lte('entry_date', periodEnd)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLedgerEntries(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // GAAP Statement of Financial Position (Balance Sheet)
  const renderStatementOfFinancialPosition = () => {
    const currentAssets = trialBalance.filter(r =>
      r.account_type === 'asset' &&
      (r.account_name.toLowerCase().includes('cash') ||
       r.account_name.toLowerCase().includes('bank') ||
       r.account_name.toLowerCase().includes('receivable') ||
       r.account_name.toLowerCase().includes('inventory') ||
       parseInt(r.account_code) < 1500)
    );
    
    const nonCurrentAssets = trialBalance.filter(r =>
      r.account_type === 'asset' && !currentAssets.includes(r)
    );
    
    const currentLiabilities = trialBalance.filter(r =>
      r.account_type === 'liability' &&
      (r.account_name.toLowerCase().includes('payable') ||
       r.account_name.toLowerCase().includes('sars') ||
       r.account_name.toLowerCase().includes('vat') ||
       parseInt(r.account_code) < 2300)
    );
    
    const nonCurrentLiabilities = trialBalance.filter(r =>
      r.account_type === 'liability' && !currentLiabilities.includes(r)
    );
    
    const equity = trialBalance.filter(r => r.account_type === 'equity');

    const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0);
    const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, r) => sum + r.balance, 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    
    const totalEquity = equity.reduce((sum, r) => sum + r.balance, 0);

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Statement of Financial Position</h2>
          <p className="text-muted-foreground">As at {periodEnd}</p>
        </div>

        {/* ASSETS */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 pb-2">ASSETS</h3>
          
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Current Assets</h4>
            {currentAssets.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Current Assets</span>
              <span className="font-mono">R {totalCurrentAssets.toLocaleString()}</span>
            </div>
          </div>

          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Non-current Assets</h4>
            {nonCurrentAssets.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Non-current Assets</span>
              <span className="font-mono">R {totalNonCurrentAssets.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between py-2 text-lg font-bold border-t-2 border-b-2">
            <span>TOTAL ASSETS</span>
            <span className="font-mono">R {totalAssets.toLocaleString()}</span>
          </div>
        </div>

        {/* LIABILITIES */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold border-b-2 pb-2">LIABILITIES</h3>
          
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Current Liabilities</h4>
            {currentLiabilities.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Current Liabilities</span>
              <span className="font-mono">R {totalCurrentLiabilities.toLocaleString()}</span>
            </div>
          </div>

          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Non-current Liabilities</h4>
            {nonCurrentLiabilities.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Non-current Liabilities</span>
              <span className="font-mono">R {totalNonCurrentLiabilities.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between py-2 font-semibold border-t">
            <span>Total Liabilities</span>
            <span className="font-mono">R {totalLiabilities.toLocaleString()}</span>
          </div>
        </div>

        {/* EQUITY */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold border-b-2 pb-2">EQUITY</h3>
          <div className="pl-4">
            {equity.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Equity</span>
              <span className="font-mono">R {totalEquity.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* TOTAL */}
        <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-b-2 bg-primary/5">
          <span>TOTAL LIABILITIES & EQUITY</span>
          <span className="font-mono">R {(totalLiabilities + totalEquity).toLocaleString()}</span>
        </div>

        {/* Validation */}
        {accountingEquation && (
          <div className={`p-4 rounded-lg ${accountingEquation.is_valid ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
            <p className="font-semibold">{accountingEquation.error_message}</p>
            {!accountingEquation.is_valid && (
              <p className="text-sm mt-2">Assets: R {accountingEquation.total_assets.toLocaleString()} | Liabilities: R {accountingEquation.total_liabilities.toLocaleString()} | Equity: R {accountingEquation.total_equity.toLocaleString()}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // GAAP Income Statement
  const renderIncomeStatement = () => {
    const revenue = trialBalance.filter(r => r.account_type === 'revenue');
    const expenses = trialBalance.filter(r => r.account_type === 'expense');
    const costOfSales = expenses.filter(r => r.account_name.toLowerCase().includes('cost of') || r.account_code.startsWith('50'));
    const operatingExpenses = expenses.filter(r => !costOfSales.includes(r));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
    const totalCostOfSales = costOfSales.reduce((sum, r) => sum + r.balance, 0);
    const grossProfit = totalRevenue - totalCostOfSales;
    const totalOperatingExpenses = operatingExpenses.reduce((sum, r) => sum + r.balance, 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Income Statement</h2>
          <p className="text-muted-foreground">For the period {periodStart} to {periodEnd}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 pb-2">REVENUE</h3>
          <div className="pl-4">
            {revenue.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Revenue</span>
              <span className="font-mono">R {totalRevenue.toLocaleString()}</span>
            </div>
          </div>

          {costOfSales.length > 0 && (
            <>
              <h3 className="text-xl font-bold border-b-2 pb-2">COST OF SALES</h3>
              <div className="pl-4">
                {costOfSales.map(row => (
                  <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                       onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                    <span>{row.account_code} - {row.account_name}</span>
                    <span className="font-mono">(R {row.balance.toLocaleString()})</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold border-t mt-2">
                  <span>Total Cost of Sales</span>
                  <span className="font-mono">(R {totalCostOfSales.toLocaleString()})</span>
                </div>
              </div>

              <div className="flex justify-between py-2 text-lg font-bold border-t-2">
                <span>GROSS PROFIT</span>
                <span className="font-mono">R {grossProfit.toLocaleString()}</span>
              </div>
            </>
          )}

          <h3 className="text-xl font-bold border-b-2 pb-2">OPERATING EXPENSES</h3>
          <div className="pl-4">
            {operatingExpenses.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">(R {row.balance.toLocaleString()})</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Operating Expenses</span>
              <span className="font-mono">(R {totalOperatingExpenses.toLocaleString()})</span>
            </div>
          </div>

          <div className={`flex justify-between py-3 text-xl font-bold border-t-2 border-b-2 ${netProfit >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
            <span>NET PROFIT/(LOSS)</span>
            <span className="font-mono">R {netProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCashFlowStatement = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-center w-full mb-2">
            <h2 className="text-2xl font-bold">Cash Flow Statement</h2>
            <p className="text-muted-foreground">For the period {periodStart} to {periodEnd}</p>
          </div>
          <div className="w-0" />
        </div>

        {!cashFlow && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No cash flow data loaded.</p>
            <Button variant="outline" onClick={loadCashFlow}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Load Cash Flow
            </Button>
          </div>
        )}

        {cashFlow && (
          <div className="space-y-6">
            {/* Operating Activities */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold border-b-2 pb-2">Operating Activities</h3>
              <div className="flex justify-between">
                <span>Cash Inflows</span>
                <span className="font-mono">R {cashFlow.operating_inflows.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Outflows</span>
                <span className="font-mono">(R {cashFlow.operating_outflows.toLocaleString()})</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-semibold border-t">
                <span>Net Cash from Operations</span>
                <span className="font-mono">R {cashFlow.net_cash_from_operations.toLocaleString()}</span>
              </div>
            </div>

            {/* Investing Activities */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold border-b-2 pb-2">Investing Activities</h3>
              <div className="flex justify-between">
                <span>Cash Inflows</span>
                <span className="font-mono">R {cashFlow.investing_inflows.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Outflows</span>
                <span className="font-mono">(R {cashFlow.investing_outflows.toLocaleString()})</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-semibold border-t">
                <span>Net Cash from Investing</span>
                <span className="font-mono">R {cashFlow.net_cash_from_investing.toLocaleString()}</span>
              </div>
            </div>

            {/* Financing Activities */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold border-b-2 pb-2">Financing Activities</h3>
              <div className="flex justify-between">
                <span>Cash Inflows</span>
                <span className="font-mono">R {cashFlow.financing_inflows.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Outflows</span>
                <span className="font-mono">(R {cashFlow.financing_outflows.toLocaleString()})</span>
              </div>
              <div className="flex justify-between py-2 text-lg font-semibold border-t">
                <span>Net Cash from Financing</span>
                <span className="font-mono">R {cashFlow.net_cash_from_financing.toLocaleString()}</span>
              </div>
            </div>

            {/* Net Change and Balances */}
            <div className="space-y-2">
              <div className="flex justify-between py-2 text-lg font-bold border-t-2 border-b-2">
                <span>NET CHANGE IN CASH</span>
                <span className="font-mono">R {cashFlow.net_change_in_cash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Cash Balance</span>
                <span className="font-mono">R {cashFlow.opening_cash_balance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Closing Cash Balance</span>
                <span className="font-mono">R {cashFlow.closing_cash_balance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">GAAP Financial Statements</h1>
          <p className="text-muted-foreground">Annual Financial Statements with drill-down</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh AFS
          </Button>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button variant={periodMode === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setPeriodMode('monthly')}>Monthly</Button>
              <Button variant={periodMode === 'annual' ? 'default' : 'outline'} size="sm" onClick={() => setPeriodMode('annual')}>Annual</Button>
            </div>
          </div>

          {periodMode === 'monthly' ? (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="selectedMonth">Month</Label>
                <Input id="selectedMonth" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="selectedYear">Year</Label>
                <Input id="selectedYear" type="number" min={1900} max={2100} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))} />
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="balance-sheet">Statement of Financial Position</TabsTrigger>
          <TabsTrigger value="income">Income Statement</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet">
          <Card>
            <CardContent className="pt-6">
              {renderStatementOfFinancialPosition()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardContent className="pt-6">
              {renderIncomeStatement()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardContent className="pt-6">
              {renderCashFlowStatement()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-down modal */}
      {drilldownAccount && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Ledger Entries: {drilldownAccount}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setDrilldownAccount(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledgerEntries.map(entry => (
                <div key={entry.id} className="flex justify-between border-b pb-2">
                  <div>
                    <p className="font-semibold">{entry.description}</p>
                    <p className="text-sm text-muted-foreground">{entry.entry_date} | Ref: {entry.reference_id}</p>
                  </div>
                  <div className="text-right font-mono">
                    {entry.debit > 0 && <p>Dr: R {entry.debit.toLocaleString()}</p>}
                    {entry.credit > 0 && <p>Cr: R {entry.credit.toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
