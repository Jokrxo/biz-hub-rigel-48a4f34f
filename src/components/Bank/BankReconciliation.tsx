import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  current_balance: number;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  total_amount: number;
  status: string;
  bank_account_id: string;
}

interface ReconciliationProps {
  bankAccounts: BankAccount[];
}

export const BankReconciliation = ({ bankAccounts }: ReconciliationProps) => {
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statementBalance, setStatementBalance] = useState("");
  const [tolerance, setTolerance] = useState("0.01");
  const [selectedTxs, setSelectedTxs] = useState<Set<string>>(new Set());
  const [autoMatching, setAutoMatching] = useState(false);

  useEffect(() => {
    if (selectedBank) {
      loadTransactions();
    }
  }, [selectedBank]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("bank_account_id", selectedBank)
        .eq("status", "pending")
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTransaction = (txId: string) => {
    const newSelected = new Set(selectedTxs);
    if (newSelected.has(txId)) {
      newSelected.delete(txId);
    } else {
      newSelected.add(txId);
    }
    setSelectedTxs(newSelected);
  };

  const handleBulkReconcile = async () => {
    if (selectedTxs.size === 0) {
      toast({ title: "No transactions selected", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      // Load full transaction details for selected items
      const { data: txs, error: txLoadErr } = await supabase
        .from("transactions")
        .select("id, company_id, transaction_date, description, total_amount, transaction_type, bank_account_id")
        .in("id", Array.from(selectedTxs));
      if (txLoadErr) throw txLoadErr;

      if (!txs || txs.length === 0) {
        toast({ title: "No transactions found", variant: "destructive" });
        return;
      }

      // Helper: ensure required ledger accounts exist
      const ensureAccounts = async (companyId: string, bankAccountId: string) => {
        // Get bank account name for ledger naming
        const { data: bankAcc } = await supabase
          .from("bank_accounts")
          .select("id, account_name")
          .eq("id", bankAccountId)
          .single();

        const bankLedgerName = bankAcc?.account_name ? `Bank - ${bankAcc.account_name}` : "Bank - Main";

        const { data: accountsList } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type, is_cash_equivalent, financial_statement_category")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("account_code");

        const findByName = (name: string) => (accountsList || []).find(a => (a.account_name || "").toLowerCase() === name.toLowerCase());
        const findByTypeIncludes = (type: string, includes: string) => (accountsList || []).find(a => (a.account_type || "").toLowerCase() === type.toLowerCase() && (a.account_name || "").toLowerCase().includes(includes));
        const nextCode = (prefix: string) => {
          const codes = (accountsList || [])
            .map(a => parseInt(String(a.account_code), 10))
            .filter(n => !isNaN(n));
          let code = parseInt(prefix, 10);
          while (codes.includes(code)) code += 1;
          return String(code);
        };

        let bankLedger = findByName(bankLedgerName) || findByTypeIncludes('asset', 'bank') || findByTypeIncludes('asset', 'cash');
        let uncIncome = findByName('Uncategorized Income') || findByTypeIncludes('income', 'uncategorized');
        let uncExpense = findByName('Uncategorized Expense') || findByTypeIncludes('expense', 'uncategorized');

        if (!bankLedger) {
          const { data: newBankAcc, error: createBankErr } = await supabase
            .from("chart_of_accounts")
            .insert({
              company_id: companyId,
              account_code: nextCode('1100'),
              account_name: bankLedgerName,
              account_type: 'asset',
              is_active: true,
              // Ensure it appears under Cash and Cash Equivalents in SFP
              is_cash_equivalent: true,
              financial_statement_category: 'current_asset',
            })
            .select("id, account_code, account_name, account_type, is_cash_equivalent, financial_statement_category")
            .single();
          if (createBankErr) throw createBankErr;
          bankLedger = newBankAcc as any;
        } else {
          // If existing, ensure classification as cash equivalent/current asset
          if (!(bankLedger as any).is_cash_equivalent || (bankLedger as any).financial_statement_category !== 'current_asset') {
            await supabase
              .from("chart_of_accounts")
              .update({ is_cash_equivalent: true, financial_statement_category: 'current_asset' })
              .eq("id", (bankLedger as any).id);
          }
        }

        if (!uncIncome) {
          const { data: newInc } = await supabase
            .from("chart_of_accounts")
            .insert({ company_id: companyId, account_code: nextCode('4000'), account_name: 'Uncategorized Income', account_type: 'income', is_active: true })
            .select("id, account_code, account_name, account_type")
            .single();
          uncIncome = newInc as any;
        }

        if (!uncExpense) {
          const { data: newExp } = await supabase
            .from("chart_of_accounts")
            .insert({ company_id: companyId, account_code: nextCode('6000'), account_name: 'Uncategorized Expense', account_type: 'expense', is_active: true })
            .select("id, account_code, account_name, account_type")
            .single();
          uncExpense = newExp as any;
        }

        return { bankLedger, uncIncome, uncExpense };
      };

      // Post each transaction to the ledger without VAT impact
      for (const tx of txs) {
        const { bankLedger, uncIncome, uncExpense } = await ensureAccounts(tx.company_id, tx.bank_account_id);

        const description = tx.description || 'Bank statement import';
        const amount = Number(tx.total_amount || 0);
        const isInflow = String(tx.transaction_type).toLowerCase() === 'income' || String(tx.transaction_type).toLowerCase() === 'deposit' || String(tx.transaction_type).toLowerCase() === 'transfer_in';

        // Insert ledger legs explicitly to ensure TB and SFP reflect cash
        const legs = isInflow
          ? [
              { transaction_id: tx.id, account_id: (bankLedger as any).id, debit: amount, credit: 0, description, status: 'posted' },
              { transaction_id: tx.id, account_id: (uncIncome as any).id, debit: 0, credit: amount, description, status: 'posted' },
            ]
          : [
              { transaction_id: tx.id, account_id: (uncExpense as any).id, debit: amount, credit: 0, description, status: 'posted' },
              { transaction_id: tx.id, account_id: (bankLedger as any).id, debit: 0, credit: amount, description, status: 'posted' },
            ];

        // Write to transaction_entries (for app detail views)
        const { error: entryErr } = await supabase.from("transaction_entries").insert(legs);
        if (entryErr) throw entryErr;

        // Write to ledger_entries (for TB and Cash Flow reporting)
        const ledgerLegs = legs.map(l => ({
          company_id: tx.company_id,
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit,
          entry_date: tx.transaction_date,
          is_reversed: false,
          transaction_id: tx.id,
          description: l.description,
        }));
        const { error: ledgerErr } = await supabase.from("ledger_entries").insert(ledgerLegs as any);
        if (ledgerErr) throw ledgerErr;

        // Update transaction status to approved to indicate fully posted
        await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id);

        // Update bank running balance via RPC if available
        try {
          await supabase.rpc('update_bank_balance', { _bank_account_id: tx.bank_account_id, _amount: amount, _operation: isInflow ? 'add' : 'subtract' });
        } catch (_) {
          // Ignore if RPC not present
        }
      }

      toast({ 
        title: "Success", 
        description: `Reconciled & posted ${selectedTxs.size} transaction(s) without VAT` 
      });
      setSelectedTxs(new Set());
      loadTransactions();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!selectedBank || !statementBalance) {
      toast({ title: "Missing data", description: "Select bank and enter statement balance", variant: "destructive" });
      return;
    }

    setAutoMatching(true);
    try {
      const targetBalance = parseFloat(statementBalance);
      const toleranceValue = parseFloat(tolerance);
      const currentBank = bankAccounts.find(b => b.id === selectedBank);
      
      if (!currentBank) return;

      // Calculate unreconciled balance
      const unreconciledSum = transactions
        .filter(tx => selectedTxs.has(tx.id))
        .reduce((sum, tx) => sum + tx.total_amount, 0);

      const calculatedBalance = currentBank.current_balance + unreconciledSum;
      const difference = Math.abs(calculatedBalance - targetBalance);

      if (difference <= toleranceValue) {
        toast({ 
          title: "Auto-match successful!", 
          description: `Balance matches within tolerance (diff: R${difference.toFixed(2)})`,
        });
      } else {
        toast({ 
          title: "Balance mismatch", 
          description: `Difference: R${difference.toFixed(2)} exceeds tolerance`,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAutoMatching(false);
    }
  };

  const selectedBank_obj = bankAccounts.find(b => b.id === selectedBank);
  const selectedSum = transactions
    .filter(tx => selectedTxs.has(tx.id))
    .reduce((sum, tx) => sum + tx.total_amount, 0);
  const calculatedBalance = selectedBank_obj ? selectedBank_obj.current_balance + selectedSum : 0;
  const statementDiff = statementBalance ? calculatedBalance - parseFloat(statementBalance) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bank Reconciliation</h2>
        <p className="text-muted-foreground">Match bank statement transactions with your records</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Bank Account</Label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.account_name} ({bank.bank_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Statement Balance</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Enter bank statement balance"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
              />
            </div>

            <div>
              <Label>Match Tolerance (R)</Label>
              <Input
                type="number"
                step="0.01"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleAutoMatch} 
              disabled={!selectedBank || !statementBalance || autoMatching}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoMatching ? "animate-spin" : ""}`} />
              Auto-Match
            </Button>
            <Button 
              onClick={handleBulkReconcile}
              disabled={selectedTxs.size === 0}
              className="bg-gradient-primary"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Reconcile Selected ({selectedTxs.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedBank && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">System Balance</p>
                <p className="text-2xl font-bold">R {selectedBank_obj?.current_balance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selected Transactions</p>
                <p className="text-2xl font-bold">R {selectedSum.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calculated Balance</p>
                <p className="text-2xl font-bold">R {calculatedBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Difference</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${Math.abs(statementDiff) <= parseFloat(tolerance) ? "text-primary" : "text-destructive"}`}>
                    R {Math.abs(statementDiff).toFixed(2)}
                  </p>
                  {statementBalance && (
                    Math.abs(statementDiff) <= parseFloat(tolerance) ? 
                      <CheckCircle2 className="h-5 w-5 text-primary" /> : 
                      <AlertCircle className="h-5 w-5 text-destructive" />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedBank && (
        <Card>
          <CardHeader>
            <CardTitle>Unallocated Transactions ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No Unallocated Transactions to reconcile
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTxs.size === transactions.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTxs(new Set(transactions.map(t => t.id)));
                          } else {
                            setSelectedTxs(new Set());
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedTxs.has(tx.id)}
                          onCheckedChange={() => handleToggleTransaction(tx.id)}
                        />
                      </TableCell>
                      <TableCell>{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className="font-mono text-sm">{tx.reference_number || "-"}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        R {tx.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{tx.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};


