import { useState, useEffect, useMemo } from "react";
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
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, SplitSquareHorizontal, Undo2, Download, Lock, Unlock, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [search, setSearch] = useState("");
  const [dateToleranceDays, setDateToleranceDays] = useState("3");
  const [matches, setMatches] = useState<Record<string, { status: string; score: number; hints: string[] }>>({});
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitTx, setSplitTx] = useState<Transaction | null>(null);
  const [splitLegs, setSplitLegs] = useState<Array<{ accountId: string; debit: number; credit: number; memo: string }>>([]);
  const [reconciled, setReconciled] = useState<Transaction[]>([]);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockedMonths, setLockedMonths] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (selectedBank) {
      loadTransactions();
    }
  }, [selectedBank]);

  useEffect(() => {
    const channel = supabase
      .channel('bank-recon-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `bank_account_id=eq.${selectedBank}` }, () => {
        if (selectedBank) loadTransactions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => {
        if (selectedBank) loadTransactions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      const { data: posted } = await supabase
        .from("transactions")
        .select("*")
        .eq("bank_account_id", selectedBank)
        .in("status", ["approved","posted"]) as any;
      setReconciled((posted || []) as any);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const compute = async () => {
      if (!selectedBank) return;
      const tolDays = parseInt(dateToleranceDays || "0", 10);
      const companyId = await (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "";
        const { data } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
        return String((data as any)?.company_id || "");
      })();
      const { data: book } = await supabase
        .from("transactions")
        .select("id, transaction_date, description, total_amount, status, reference_number")
        .eq("company_id", companyId)
        .in("status", ["approved","posted"]) as any;
      const bookList = (book || []) as Array<{ id: string; transaction_date: string; description: string; total_amount: number; status: string; reference_number: string | null }>;
      const indexByAmt = new Map<number, Array<typeof bookList[0]>>();
      bookList.forEach(b => {
        const arr = indexByAmt.get(Number(b.total_amount)) || [];
        arr.push(b); indexByAmt.set(Number(b.total_amount), arr);
      });
      const newMatches: Record<string, { status: string; score: number; hints: string[] }> = {};
      for (const tx of transactions) {
        const candidates = indexByAmt.get(Number(tx.total_amount)) || [];
        let bestScore = 0; let status = "No Match"; const hints: string[] = [];
        const desc = String(tx.description || "").toLowerCase();
        const targetDate = new Date(tx.transaction_date).getTime();
        let foundCount = 0;
        for (const c of candidates) {
          const d2 = new Date(c.transaction_date).getTime();
          const dateDiffDays = Math.abs((targetDate - d2) / (1000 * 60 * 60 * 24));
          const dateScore = dateDiffDays <= tolDays ? 0.4 : 0.0;
          const descSim = (() => {
            const a = desc.split(/\s+/).filter(Boolean);
            const b = String(c.description || "").toLowerCase().split(/\s+/).filter(Boolean);
            const setA = new Set(a); const common = b.filter(x => setA.has(x)).length;
            return Math.min(0.4, common / Math.max(1, Math.min(a.length, b.length)) * 0.4);
          })();
          const refScore = c.reference_number && tx.reference_number && c.reference_number === tx.reference_number ? 0.2 : 0.0;
          const score = dateScore + descSim + refScore;
          if (score > 0) foundCount += 1;
          if (score > bestScore) { bestScore = score; }
        }
        if (bestScore >= 0.9) { status = "Matched"; }
        else if (foundCount > 1 && bestScore >= 0.4) { status = "Multiple Matches Found"; }
        else if (bestScore >= 0.4) { status = "Possible Match"; }
        else { status = "Manual Entry Required"; }
        if (/transfer|xfer|move/i.test(desc)) hints.push("Possible Transfer");
        try {
          const { data: dup } = await supabase.rpc('check_duplicate_transaction', {
            _company_id: companyId,
            _bank_account_id: selectedBank,
            _transaction_date: tx.transaction_date,
            _total_amount: Number(tx.total_amount || 0),
            _description: tx.description || ''
          });
          if (dup) hints.push("Duplicate Detected");
        } catch {}
        newMatches[tx.id] = { status, score: Number(bestScore.toFixed(2)), hints };
      }
      setMatches(newMatches);
    };
    compute();
  }, [transactions, selectedBank, dateToleranceDays]);

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
        const monthKey = String(new Date(tx.transaction_date).toISOString().slice(0,7));
        if (lockedMonths.has(monthKey)) {
          toast({ title: "Period Locked", description: `Month ${monthKey} is locked. Unlock to reconcile.`, variant: "destructive" });
          continue;
        }
        const { bankLedger, uncIncome, uncExpense } = await ensureAccounts(tx.company_id, tx.bank_account_id);

        const description = tx.description || 'Bank statement import';
        const amount = Number(tx.total_amount || 0);
        const isInflow = String(tx.transaction_type).toLowerCase() === 'income' || String(tx.transaction_type).toLowerCase() === 'deposit' || String(tx.transaction_type).toLowerCase() === 'transfer_in';

        // Insert ledger legs explicitly to ensure TB and SFP reflect cash
        const legs = splitTx && splitTx.id === tx.id && splitLegs.length > 0
          ? splitLegs.map(l => ({ transaction_id: tx.id, account_id: l.accountId, debit: l.debit, credit: l.credit, description: l.memo || description, status: 'approved' }))
          : isInflow
          ? [
              { transaction_id: tx.id, account_id: (bankLedger as any).id, debit: amount, credit: 0, description, status: 'approved' },
              { transaction_id: tx.id, account_id: (uncIncome as any).id, debit: 0, credit: amount, description, status: 'approved' },
            ]
          : [
              { transaction_id: tx.id, account_id: (uncExpense as any).id, debit: amount, credit: 0, description, status: 'approved' },
              { transaction_id: tx.id, account_id: (bankLedger as any).id, debit: 0, credit: amount, description, status: 'approved' },
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
          reference_id: tx.id,
          description: l.description,
        }));
        const { error: ledgerErr } = await supabase.from("ledger_entries").insert(ledgerLegs as any);
        if (ledgerErr) throw ledgerErr;

        // Update transaction status to approved to indicate fully posted
        await supabase.from('transactions').update({ status: 'approved' }).eq('id', tx.id);

        // Update bank running balance via RPC only
        try {
          await supabase.rpc('update_bank_balance', { _bank_account_id: tx.bank_account_id, _amount: amount, _operation: isInflow ? 'add' : 'subtract' });
        } catch (_) {}
      }

      try { const { data: { user } } = await supabase.auth.getUser(); if (user) { const { data: prof } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).single(); if (prof?.company_id) { await supabase.rpc('refresh_afs_cache', { _company_id: prof.company_id }); } } } catch {}
      toast({ title: "Success", description: `Reconciled & approved ${selectedTxs.size} transaction(s)` });
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
  const filteredTransactions = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(t => !q || String(t.description || '').toLowerCase().includes(q) || String(t.reference_number || '').toLowerCase().includes(q));
  }, [transactions, search]);

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
            <div>
              <Label>Date Tolerance (days)</Label>
              <Input type="number" value={dateToleranceDays} onChange={(e) => setDateToleranceDays(e.target.value)} />
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
            <Button variant="outline" onClick={() => setLockOpen(true)}>
              <Lock className="h-4 w-4 mr-2" />
              Lock Periods
            </Button>
            <Button variant="outline" onClick={async () => {
              try {
                setExporting(true);
                const rows = transactions.map(t => ({ date: t.transaction_date, description: t.description, reference: t.reference_number || '', amount: t.total_amount, status: t.status, match_status: matches[t.id]?.status || '' }));
                const header = 'Date,Description,Reference,Amount,Status,Match\n';
                const body = rows.map(r => `${r.date},"${String(r.description||'').replace(/"/g,'""')}",${r.reference},${r.amount},${r.status},${r.match_status}`).join('\n');
                const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `bank-recon-${selectedBank}.csv`; a.click(); URL.revokeObjectURL(url);
              } finally { setExporting(false); }
            }} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
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
                {Math.abs(statementDiff) > parseFloat(tolerance) && (
                  <div className="text-xs text-destructive mt-1">Variance alert: difference exceeds tolerance</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedBank && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between w-full">
              <span>Unallocated Transactions ({transactions.length})</span>
              <div className="flex items-center gap-2">
                <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" /> Statuses reflect auto-matching suggestions; posting logic unchanged.</span>
              </div>
            </CardTitle>
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
                    <TableHead>Match</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
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
                      <TableCell>
                        {(() => {
                          const m = matches[tx.id];
                          const variant = m?.status === 'Matched' ? 'default' : m?.status === 'Possible Match' ? 'secondary' : m?.status?.includes('Multiple') ? 'secondary' : m?.status === 'Manual Entry Required' ? 'outline' : 'outline';
                          return <div className="flex items-center gap-2"><Badge variant={variant}>{m?.status || '—'}</Badge><span className="text-xs text-muted-foreground">{m ? `score ${m.score}` : ''}</span></div>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setSplitTx(tx); setSplitLegs([{ accountId: '', debit: 0, credit: 0, memo: '' }]); setSplitOpen(true); }}>
                            <SplitSquareHorizontal className="h-4 w-4 mr-1" />Split
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {selectedBank && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciled Items ({reconciled.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {reconciled.length === 0 ? (
              <div className="text-sm text-muted-foreground">None</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reconciled.slice(0, 10).map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className="font-mono text-sm">{tx.reference_number || '-'}</TableCell>
                      <TableCell className="text-right font-mono">R {tx.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={async () => {
                          try {
                            const amount = Number(tx.total_amount || 0);
                            const isInflow = String(tx.transaction_type).toLowerCase().includes('income') || String(tx.transaction_type).toLowerCase().includes('deposit') || String(tx.transaction_type).toLowerCase().includes('transfer_in');
                            await supabase.from('transaction_entries').delete().eq('transaction_id', tx.id);
                            await supabase.from('ledger_entries').delete().eq('transaction_id', tx.id);
                            await supabase.from('transactions').update({ status: 'pending', description: `${tx.description || ''} [Unreconciled]` }).eq('id', tx.id);
                            try { await supabase.rpc('update_bank_balance', { _bank_account_id: tx.bank_account_id, _amount: amount, _operation: isInflow ? 'subtract' : 'add' }); } catch {}
                            toast({ title: 'Unreconciled', description: 'Transaction moved back to pending and balances adjusted' });
                            loadTransactions();
                          } catch (e: any) {
                            toast({ title: 'Error', description: e.message, variant: 'destructive' });
                          }
                        }}>
                          <Undo2 className="h-4 w-4 mr-1" />Unreconcile
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="sm:max-w-[640px] p-4">
          <DialogHeader>
            <DialogTitle>Split Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Reference: <span className="font-mono">{splitTx?.reference_number || '-'}</span> • Amount: R {(splitTx?.total_amount || 0).toFixed(2)}</div>
            <div className="space-y-2">
              {splitLegs.map((leg, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                  <div>
                    <Label>Account ID</Label>
                    <Input value={leg.accountId} onChange={e => {
                      const arr = [...splitLegs]; arr[idx] = { ...leg, accountId: e.target.value }; setSplitLegs(arr);
                    }} placeholder="ledger account id" />
                  </div>
                  <div>
                    <Label>Debit</Label>
                    <Input type="number" inputMode="decimal" value={String(leg.debit)} onChange={e => {
                      const arr = [...splitLegs]; arr[idx] = { ...leg, debit: parseFloat(e.target.value || '0') }; setSplitLegs(arr);
                    }} />
                  </div>
                  <div>
                    <Label>Credit</Label>
                    <Input type="number" inputMode="decimal" value={String(leg.credit)} onChange={e => {
                      const arr = [...splitLegs]; arr[idx] = { ...leg, credit: parseFloat(e.target.value || '0') }; setSplitLegs(arr);
                    }} />
                  </div>
                  <div>
                    <Label>Memo</Label>
                    <Input value={leg.memo} onChange={e => {
                      const arr = [...splitLegs]; arr[idx] = { ...leg, memo: e.target.value }; setSplitLegs(arr);
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSplitLegs(l => [...l, { accountId: '', debit: 0, credit: 0, memo: '' }])}>Add Line</Button>
              <Button className="bg-gradient-primary" onClick={() => setSplitOpen(false)}>Done</Button>
            </div>
            <div className="text-xs text-muted-foreground">Split legs will be used for this transaction when you click Reconcile Selected. Ensure debits equal credits.</div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent className="sm:max-w-[520px] p-4">
          <DialogHeader>
            <DialogTitle>Lock / Unlock Periods</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Lock months to prevent reconciliation changes.</div>
            <div className="grid grid-cols-2 gap-2">
              {[...new Set(transactions.map(t => t.transaction_date.slice(0,7)))].map(m => (
                <div key={m} className="flex items-center justify-between rounded border p-2">
                  <div>{m}</div>
                  {lockedMonths.has(m) ? (
                    <Button variant="outline" size="sm" onClick={() => setLockedMonths(prev => { const n = new Set(prev); n.delete(m); return n; })}><Unlock className="h-4 w-4 mr-1" />Unlock</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setLockedMonths(prev => { const n = new Set(prev); n.add(m); return n; })}><Lock className="h-4 w-4 mr-1" />Lock</Button>
                  )}
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Period locks are enforced in this UI. For database-level freeze, we can add policies later.</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


      try {
        const { data: invTxs } = await supabase
          .from('investment_transactions' as any)
          .select('id, trade_date, total_amount, type, symbol');
        (invTxs || []).forEach((t: any) => {
          const amt = Number(t.total_amount || 0);
          const arr = indexByAmt.get(amt) || [];
          arr.push({ id: String(t.id), transaction_date: String(t.trade_date), description: String(t.type || '') + ' ' + String(t.symbol || ''), total_amount: amt, status: 'investment', reference_number: null });
          indexByAmt.set(amt, arr);
        });
      } catch {}
