import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, FileText, RefreshCw, Loader2 } from "lucide-react";
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

  useEffect(() => {
    generateTrialBalance();
  }, []);

  const generateTrialBalance = async () => {
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

      // Fetch all accounts with their transaction entries
      const { data: accounts, error } = await supabase
        .from("chart_of_accounts")
        .select(`
          account_code,
          account_name,
          transaction_entries (
            debit,
            credit
          )
        `)
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("account_code");

      if (error) throw error;

      // Calculate balances for each account
      const trialBalanceData: TrialBalanceEntry[] = [];
      
      accounts?.forEach(account => {
        let totalDebit = 0;
        let totalCredit = 0;

        // Sum up all transaction entries
        account.transaction_entries?.forEach((entry: any) => {
          totalDebit += entry.debit || 0;
          totalCredit += entry.credit || 0;
        });

        // Only include accounts with non-zero balances
        if (totalDebit > 0 || totalCredit > 0) {
          trialBalanceData.push({
            account_code: account.account_code,
            account_name: account.account_name,
            debit: totalDebit,
            credit: totalCredit
          });
        }
      });

      setEntries(trialBalanceData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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
    
    exportToExcel(exportData, `trial_balance_${new Date().toISOString().split('T')[0]}`);
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
    
    exportToPDF(exportData, `trial_balance_${new Date().toISOString().split('T')[0]}`);
    toast({ title: "Success", description: "Trial balance exported to PDF" });
  };

  const totals = getTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">Auto-generated from transaction entries</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateTrialBalance}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={entries.length === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={entries.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Balance Status */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-2xl font-bold">R {totals.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold">R {totals.totalCredits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={totals.isBalanced ? "default" : "destructive"}>
                  {totals.isBalanced ? "Balanced" : "Not Balanced"}
                </Badge>
                {!totals.isBalanced && (
                  <span className="text-sm text-muted-foreground">
                    Diff: R {totals.difference.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trial Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto opacity-50 mb-4" />
              <p className="text-muted-foreground">No transactions found. Create transactions to generate trial balance.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.account_code}>
                    <TableCell className="font-mono">{entry.account_code}</TableCell>
                    <TableCell>{entry.account_name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit > 0 ? `R ${entry.debit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit > 0 ? `R ${entry.credit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={2}>TOTALS</TableCell>
                  <TableCell className="text-right font-mono">
                    R {totals.totalDebits.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono">
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
