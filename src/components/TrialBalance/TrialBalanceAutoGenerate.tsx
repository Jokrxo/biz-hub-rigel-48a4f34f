import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, RefreshCw, Loader2, ArrowUpRight, ArrowDownLeft, Scale, Filter, FolderTree, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface TrialBalanceEntry {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  category?: string; // Asset, Liability, Equity, Income, Expense
}

export const TrialBalanceAutoGenerate = () => {
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Date filter state
  const [periodType, setPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Group toggles
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Non-current Assets': true,
    'Current Assets': true,
    'Non-current Liabilities': true,
    'Current Liabilities': true,
    'Equity': true,
    'Income': true,
    'Expenses': true
  });

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const getCategoryFromCode = (code: string): string => {
    const firstDigit = code.charAt(0);
    const codeNum = parseInt(code, 10);
    
    if (firstDigit === '1') {
        if (codeNum < 1500) return 'Current Assets';
        return 'Non-current Assets';
    }
    if (firstDigit === '2') {
        if (codeNum < 2500) return 'Current Liabilities';
        return 'Non-current Liabilities';
    }

    switch (firstDigit) {
      case '3': return 'Equity';
      case '4': return 'Income';
      case '5': case '6': case '7': case '8': case '9': return 'Expenses';
      default: return 'Other';
    }
  };

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
          // Calculate Net Balance for correct column placement if needed, 
          // but Trial Balance typically shows Debit vs Credit totals.
          // Standard practice: Asset/Expense = Debit balance, Liab/Equity/Income = Credit balance.
          // However, raw Trial Balance sums total debits and total credits per account.
          // If we want "Net" trial balance (one figure per row), we net them.
          // Let's stick to the previous format but categorized.
          
          trialBalanceData.push({
            account_code: account.account_code,
            account_name: account.account_name,
            debit: totalDebit,
            credit: totalCredit,
            category: getCategoryFromCode(account.account_code)
          });
        }
      });

      // Add missing pinned accounts if they don't exist
      const has1100 = trialBalanceData.some(e => String(e.account_code) === '1100');
      const has3900 = trialBalanceData.some(e => String(e.account_code) === '3900');
      if (!has1100) {
        trialBalanceData.push({ account_code: '1100', account_name: 'Bank', debit: 0, credit: 0, category: 'Assets' });
      }
      if (!has3900) {
        trialBalanceData.push({ account_code: '3900', account_name: 'Opening Balance Equity', debit: 0, credit: 0, category: 'Equity' });
      }

      trialBalanceData.sort((a, b) => String(a.account_code).localeCompare(String(b.account_code)));

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
    const isBalanced = difference < 0.01;
    
    return { totalDebits, totalCredits, difference, isBalanced };
  };

  const handleExportExcel = () => {
    exportToExcel(entries, `trial_balance_${periodType}_${selectedYear}`);
    toast({ title: "Success", description: "Trial balance exported to Excel" });
  };

  const handleExportPDF = () => {
    exportToPDF(entries, `trial_balance_${periodType}_${selectedYear}`);
    toast({ title: "Success", description: "Trial balance exported to PDF" });
  };

  const totals = getTotals();

  // Group entries by category
  const groupedEntries: Record<string, TrialBalanceEntry[]> = {
    'Non-current Assets': [],
    'Current Assets': [],
    'Non-current Liabilities': [],
    'Current Liabilities': [],
    'Equity': [],
    'Income': [],
    'Expenses': []
  };

  entries.forEach(entry => {
    const cat = entry.category || 'Other';
    if (!groupedEntries[cat]) groupedEntries[cat] = [];
    groupedEntries[cat].push(entry);
  });

  const categoryOrder = ['Non-current Assets', 'Current Assets', 'Non-current Liabilities', 'Current Liabilities', 'Equity', 'Income', 'Expenses'];

  const calculateTotal = (categories: string[]) => {
    let debits = 0;
    let credits = 0;
    categories.forEach(cat => {
        const entries = groupedEntries[cat] || [];
        debits += entries.reduce((sum, e) => sum + e.debit, 0);
        credits += entries.reduce((sum, e) => sum + e.credit, 0);
    });
    return { debits, credits };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
          <p className="text-muted-foreground mt-1">Comprehensive financial position by category</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border shadow-sm">
            <Select value={periodType} onValueChange={(val: 'monthly' | 'annual') => setPeriodType(val)}>
              <SelectTrigger className="w-[110px] h-8 border-none bg-transparent focus:ring-0 font-medium">
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
                <SelectTrigger className="w-[130px] h-8 border-none bg-transparent focus:ring-0 font-medium">
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
              <SelectTrigger className="w-[80px] h-8 border-none bg-transparent focus:ring-0 font-medium">
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
            <Button variant="outline" size="icon" onClick={generateTrialBalance} title="Refresh" className="shadow-sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={entries.length === 0} className="shadow-sm">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={entries.length === 0} className="shadow-sm">
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Balance Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-md bg-gradient-to-br from-emerald-500/5 via-background to-background border-l-4 border-l-emerald-500">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Debits</p>
                <div className="text-2xl font-bold text-emerald-700">R {totals.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="p-2 bg-emerald-100 rounded-full">
                <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-blue-500/5 via-background to-background border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Credits</p>
                <div className="text-2xl font-bold text-blue-700">R {totals.totalCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="p-2 bg-blue-100 rounded-full">
                <ArrowUpRight className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-none shadow-md border-l-4 ${totals.isBalanced ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-red-500 bg-red-50/30'}`}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                <div className={`text-2xl font-bold ${totals.isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
                  {totals.isBalanced ? "Balanced" : "Unbalanced"}
                </div>
                {!totals.isBalanced && (
                  <p className="text-xs text-red-600 mt-1 font-medium">Diff: R {totals.difference.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
                )}
              </div>
              <div className={`p-2 rounded-full ${totals.isBalanced ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <Scale className={`h-5 w-5 ${totals.isBalanced ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trial Balance Table */}
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="border-b bg-muted/30 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderTree className="h-5 w-5 text-primary" />
              Account Balances
            </CardTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {entries.length} Active Accounts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground font-medium">Generating report...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No Data Available</h3>
              <p className="text-muted-foreground max-w-sm mt-2 text-sm">
                There are no transactions recorded for this period.
              </p>
            </div>
          ) : (
            <div className="relative">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px] font-bold text-primary pl-6">Code</TableHead>
                    <TableHead className="font-bold text-primary">Account Name</TableHead>
                    <TableHead className="text-right w-[180px] font-bold text-primary">Debit</TableHead>
                    <TableHead className="text-right w-[180px] font-bold text-primary pr-6">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryOrder.map(category => {
                    const catEntries = groupedEntries[category] || [];
                    if (catEntries.length === 0) return null;
                    
                    const isExpanded = expandedGroups[category];
                    const catDebits = catEntries.reduce((sum, e) => sum + e.debit, 0);
                    const catCredits = catEntries.reduce((sum, e) => sum + e.credit, 0);

                    return (
                      <React.Fragment key={category}>
                        {/* Category Header Row */}
                        <TableRow 
                          className="bg-muted/20 hover:bg-muted/30 cursor-pointer border-y border-muted-foreground/10" 
                          onClick={() => toggleGroup(category)}
                        >
                          <TableCell colSpan={2} className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/10 p-1 rounded-md">
                                {isExpanded ? 
                                  <ChevronDown className="h-4 w-4 text-primary" /> : 
                                  <ChevronRight className="h-4 w-4 text-primary" />
                                }
                              </div>
                              <span className="font-bold text-base text-foreground tracking-tight">{category}</span>
                              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 h-5 bg-background/50 text-muted-foreground">
                                {catEntries.length} accounts
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground/70 py-4 px-6 text-sm tabular-nums bg-transparent">
                            {catDebits > 0 ? `R ${catDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-bold text-foreground/70 py-4 px-6 pr-8 text-sm tabular-nums bg-transparent">
                            {catCredits > 0 ? `R ${catCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : '-'}
                          </TableCell>
                        </TableRow>

                        {/* Account Rows */}
                        {isExpanded && catEntries.map((entry, index) => (
                          <TableRow 
                            key={entry.account_code} 
                            className={`
                              border-none group transition-colors
                              ${index % 2 === 0 ? 'bg-white' : 'bg-muted/5'} 
                              hover:bg-blue-50/50
                            `}
                          >
                            <TableCell className="font-mono text-sm text-muted-foreground pl-10 py-4 group-hover:text-primary transition-colors">
                              {entry.account_code}
                            </TableCell>
                            <TableCell className="py-4 text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                              {entry.account_name}
                            </TableCell>
                            <TableCell className="text-right py-4 px-6 font-mono text-sm tabular-nums">
                              {entry.debit > 0 ? (
                                <span className="text-foreground font-medium">
                                  R {entry.debit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/20">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-4 px-6 pr-8 font-mono text-sm tabular-nums">
                              {entry.credit > 0 ? (
                                <span className="text-foreground font-medium">
                                  R {entry.credit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/20">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {/* Total Assets Row */}
                        {category === 'Current Assets' && (
                            <TableRow className="bg-emerald-50/50 border-t border-b border-emerald-200">
                                <TableCell colSpan={2} className="font-bold text-emerald-800 pl-6 py-4">TOTAL ASSETS</TableCell>
                                <TableCell className="text-right font-bold text-emerald-800 py-4 px-6 font-mono">
                                    R {calculateTotal(['Non-current Assets', 'Current Assets']).debits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-bold text-emerald-800 py-4 px-6 pr-8 font-mono">
                                    {calculateTotal(['Non-current Assets', 'Current Assets']).credits > 0 ? 
                                        `R ${calculateTotal(['Non-current Assets', 'Current Assets']).credits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : 
                                        '-'
                                    }
                                </TableCell>
                            </TableRow>
                        )}

                        {/* Total Liab & Equity Row */}
                        {category === 'Equity' && (
                            <TableRow className="bg-purple-50/50 border-t border-b border-purple-200">
                                <TableCell colSpan={2} className="font-bold text-purple-800 pl-6 py-4">TOTAL LIABILITIES & EQUITY</TableCell>
                                <TableCell className="text-right font-bold text-purple-800 py-4 px-6 font-mono">
                                     {calculateTotal(['Non-current Liabilities', 'Current Liabilities', 'Equity']).debits > 0 ? 
                                        `R ${calculateTotal(['Non-current Liabilities', 'Current Liabilities', 'Equity']).debits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : 
                                        '-'
                                    }
                                </TableCell>
                                <TableCell className="text-right font-bold text-purple-800 py-4 px-6 pr-8 font-mono">
                                   R {calculateTotal(['Non-current Liabilities', 'Current Liabilities', 'Equity']).credits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                                </TableCell>
                            </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Balance Check Row */}
                  <TableRow className={totals.isBalanced ? "bg-emerald-50/50" : "bg-red-50/50"}>
                    <TableCell colSpan={4} className="py-4">
                        <div className="flex items-center justify-center gap-2 font-bold">
                            {totals.isBalanced ? (
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <span>Statement is Balanced</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-red-700">
                                        <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <span>Statement is Unbalanced (Diff: R {totals.difference.toLocaleString("en-ZA", { minimumFractionDigits: 2 })})</span>
                                </div>
                            )}
                        </div>
                    </TableCell>
                  </TableRow>

                  {/* Grand Totals Footer */}
                  <TableRow className="bg-muted/30 border-t-2 border-primary/20">
                    <TableCell colSpan={2} className="font-bold text-right pr-8 py-4 text-base">
                      GRAND TOTAL
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold py-4 text-base text-primary">
                      R {totals.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold py-4 pr-6 text-base text-blue-700">
                      R {totals.totalCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
