import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, RefreshCw, Loader2, Calendar, ArrowUpRight, ArrowDownLeft, Scale, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface TrialBalanceEntry {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export const TrialBalanceAutoGenerate = () => {
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Date filter state
  const [periodType, setPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const generateTrialBalance = useCallback(async () => {
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

      // Calculate end-of-period cutoff
      let endDate: Date;
      if (periodType === 'monthly') {
        // End of the selected month
        endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
      } else {
        // End of the selected year
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59);
      }

      // Fetch all active accounts
      const { data: accounts, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select('account_code, account_name, id')
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("account_code");

      if (accountsError) throw accountsError;

      // Fetch transaction entries up to end of selected period
      const { data: txEntries, error: txError } = await supabase
        .from("transaction_entries")
        .select(`
          transaction_id,
          account_id,
          debit,
          credit,
          transactions!inner (
            transaction_date
          )
        `)
        .eq("transactions.company_id", profile.company_id)
        .lte("transactions.transaction_date", endDate.toISOString());

      if (txError) throw txError;

      // Fetch ledger entries up to end of selected period
      const { data: ledgerEntries, error: ledgerError } = await supabase
        .from("ledger_entries")
        .select('transaction_id, account_id, debit, credit, entry_date')
        .eq("company_id", profile.company_id)
        .lte("entry_date", endDate.toISOString());

      if (ledgerError) throw ledgerError;

      // Calculate balances for each account
      const trialBalanceData: TrialBalanceEntry[] = [];
      
      const ledgerTxIds = new Set<string>((ledgerEntries || []).map((e: any) => String(e.transaction_id || '')));
      const filteredTxEntries = (txEntries || []).filter((e: any) => !ledgerTxIds.has(String(e.transaction_id || '')));

      const pinnedCodes = new Set(['1100','3900']);
      accounts?.forEach(account => {
        let totalDebit = 0;
        let totalCredit = 0;

        // Sum transaction entries
        filteredTxEntries?.forEach((entry: any) => {
          if (entry.account_id === account.id) {
            totalDebit += entry.debit || 0;
            totalCredit += entry.credit || 0;
          }
        });

        // Sum ledger entries
        ledgerEntries?.forEach((entry: any) => {
          if (entry.account_id === account.id) {
            totalDebit += entry.debit || 0;
            totalCredit += entry.credit || 0;
          }
        });

        // Only include accounts with non-zero balances
        const isInventoryName = (account.account_name || '').toLowerCase().includes('inventory');
        const isPrimaryInventory = account.account_code === '1300';
        const isPinned = pinnedCodes.has(String(account.account_code || ''));
        const shouldShow = isPinned || ((totalDebit > 0 || totalCredit > 0) && (!isInventoryName || isPrimaryInventory));
        if (shouldShow) {
          trialBalanceData.push({
            account_code: account.account_code,
            account_name: account.account_name,
            debit: totalDebit,
            credit: totalCredit
          });
        }
      });
      const has1100 = trialBalanceData.some(e => String(e.account_code) === '1100');
      const has3900 = trialBalanceData.some(e => String(e.account_code) === '3900');
      if (!has1100) {
        trialBalanceData.push({ account_code: '1100', account_name: 'Bank', debit: 0, credit: 0 });
      }
      if (!has3900) {
        trialBalanceData.push({ account_code: '3900', account_name: 'Opening Balance Equity', debit: 0, credit: 0 });
      }
      trialBalanceData.sort((a, b) => {
        const aPinned = pinnedCodes.has(String(a.account_code));
        const bPinned = pinnedCodes.has(String(b.account_code));
        if (aPinned && !bPinned) return -1;
        if (bPinned && !aPinned) return 1;
        return String(a.account_code).localeCompare(String(b.account_code));
      });

      setEntries(trialBalanceData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, periodType, toast]);

  useEffect(() => {
    generateTrialBalance();
  }, [generateTrialBalance]);

  const getTotals = () => {
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
    const difference = Math.abs(totalDebits - totalCredits);
    const isBalanced = difference < 0.01; // Allow for minor floating point differences
    
    return { totalDebits, totalCredits, difference, isBalanced };
  };

  const handleExportExcel = () => {
    const exportData = entries.map(e => ({
      id: e.account_code,
      account_code: e.account_code,
      account_name: e.account_name,
      debit: e.debit,
      credit: e.credit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: "",
      company_id: "",
      period_start: null,
      period_end: null
    }));
    
    exportToExcel(exportData, `trial_balance_${periodType}_${selectedYear}${periodType === 'monthly' ? '_' + selectedMonth : ''}`);
    toast({ title: "Success", description: "Trial balance exported to Excel" });
  };

  const handleExportPDF = () => {
    const exportData = entries.map(e => ({
      id: e.account_code,
      account_code: e.account_code,
      account_name: e.account_name,
      debit: e.debit,
      credit: e.credit,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: "",
      company_id: "",
      period_start: null,
      period_end: null
    }));
    
    exportToPDF(exportData, `trial_balance_${periodType}_${selectedYear}${periodType === 'monthly' ? '_' + selectedMonth : ''}`);
    toast({ title: "Success", description: "Trial balance exported to PDF" });
  };

  const totals = getTotals();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
          <p className="text-muted-foreground mt-1">Comprehensive view of all account balances</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
            <Select value={periodType} onValueChange={(val: 'monthly' | 'annual') => setPeriodType(val)}>
              <SelectTrigger className="w-[110px] h-8 border-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>

            <div className="h-4 w-px bg-border" />

            {periodType === 'monthly' && (
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-[110px] h-8 border-none bg-transparent focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={m.toString()}>
                      {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-[80px] h-8 border-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={generateTrialBalance} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={entries.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={entries.length === 0}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Balance Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-md bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Debits</CardTitle>
            <ArrowDownLeft className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R {totals.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Total assets & expenses</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits</CardTitle>
            <ArrowUpRight className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">R {totals.totalCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Total liabilities, equity & income</p>
          </CardContent>
        </Card>

        <Card className={`border-none shadow-md bg-gradient-to-br ${totals.isBalanced ? 'from-emerald-500/10 via-emerald-500/5' : 'from-red-500/10 via-red-500/5'} to-background`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance Status</CardTitle>
            <Scale className={`h-5 w-5 ${totals.isBalanced ? 'text-emerald-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
              {totals.isBalanced ? "Balanced" : "Unbalanced"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.isBalanced ? "Debits match Credits" : `Difference: R ${totals.difference.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trial Balance Table */}
      <Card className="border-none shadow-md">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Ledger Entries
            </CardTitle>
            <Badge variant="secondary" className="font-normal">
              {entries.length} Accounts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Calculating balances...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted/50 p-4 rounded-full mb-4">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No Data Found</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                No transaction data found for the selected period. Try adjusting your filters or adding new transactions.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/5">
                <TableRow>
                  <TableHead className="w-[150px]">Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right w-[200px]">Debit</TableHead>
                  <TableHead className="text-right w-[200px]">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.account_code} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono font-medium text-muted-foreground">{entry.account_code}</TableCell>
                    <TableCell className="font-medium">{entry.account_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit > 0 ? (
                        <span className="text-primary">R {entry.debit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit > 0 ? (
                        <span className="text-blue-600">R {entry.credit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20 border-t-2 border-muted">
                  <TableCell colSpan={2} className="font-bold text-right pr-8 text-lg">TOTALS</TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg border-t-2 border-primary/20">
                    R {totals.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-lg border-t-2 border-blue-500/20">
                    R {totals.totalCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
