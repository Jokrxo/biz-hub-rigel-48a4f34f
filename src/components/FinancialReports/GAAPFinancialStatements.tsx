import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download, Eye } from "lucide-react";
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

  useEffect(() => {
    loadFinancialData();
  }, [periodStart, periodEnd]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      // Get trial balance from secure function
      const { data: tbData, error: tbError } = await supabase
        .rpc('get_trial_balance_for_company');

      if (tbError) throw tbError;
      setTrialBalance(tbData || []);

      // Validate accounting equation
      const { data: equation, error: eqError } = await supabase
        .rpc('validate_accounting_equation', { _company_id: profile.company_id });

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) return;

    await supabase.rpc('refresh_afs_cache', { _company_id: profile.company_id });
    await loadFinancialData();
    toast({ title: "Success", description: "Financial statements refreshed" });
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
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh AFS
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reporting Period</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
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
        </CardContent>
      </Card>

      <Tabs defaultValue="balance-sheet">
        <TabsList>
          <TabsTrigger value="balance-sheet">Statement of Financial Position</TabsTrigger>
          <TabsTrigger value="income">Income Statement</TabsTrigger>
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
