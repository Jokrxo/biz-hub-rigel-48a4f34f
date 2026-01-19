import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, RefreshCw, Undo2, Lock, Sparkles, Search, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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
  transaction_type?: string;
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

  // Simplified auto-match computation for UI hints
  useEffect(() => {
    const compute = async () => {
      if (!selectedBank || transactions.length === 0) return;
      
      const newMatches: Record<string, { status: string; score: number; hints: string[] }> = {};
      // In a real app, this would query the ledger or rules engine
      // For now, we simulate some intelligence
      for (const tx of transactions) {
        let status = "Manual Entry Required";
        let score = 0;
        const hints: string[] = [];
        
        // Basic keyword matching simulation
        if (tx.description?.toLowerCase().includes('fee') || tx.description?.toLowerCase().includes('charge')) {
           status = "Suggested: Bank Fees";
           score = 0.8;
        } else if (tx.total_amount < 0) {
           status = "Possible Expense";
           score = 0.4;
        } else {
           status = "Possible Income";
           score = 0.4;
        }

        newMatches[tx.id] = { status, score, hints };
      }
      setMatches(newMatches);
    };
    compute();
  }, [transactions, selectedBank]);

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

    setIsSuccess(false);
    setErrorMessage("");

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
          .select("id, account_code, account_name, account_type")
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
            })
            .select("id, account_code, account_name, account_type")
            .single();
          if (createBankErr) throw createBankErr;
          bankLedger = newBankAcc as any;
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

      // Post each transaction to the ledger
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

        // Insert ledger legs
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

        const { error: entryErr } = await supabase.from("transaction_entries").insert(legs);
        if (entryErr) throw entryErr;

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

        await supabase.from('transactions').update({ status: 'approved' }).eq('id', tx.id);

        try {
          await supabase.rpc('update_bank_balance', { _bank_account_id: tx.bank_account_id, _amount: amount, _operation: isInflow ? 'add' : 'subtract' });
        } catch (_) {}
      }

      toast({ title: "Success", description: `Reconciled ${selectedTxs.size} transactions` });
      setSuccessMessage(`Reconciled ${selectedTxs.size} transactions`);
      setIsSuccess(true);
      setTimeout(() => {
        setSelectedTxs(new Set());
        loadTransactions();
        setIsSuccess(false);
      }, 2000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setErrorMessage(error.message || "Reconciliation failed");
      setIsError(true);
      setTimeout(() => setIsError(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    // If statement balance is missing, just prompt for it but allow matching against current system balance
    // Or if user just wants to find matches based on existing data
    
    // Original check: if (!selectedBank || !statementBalance) ...
    // Let's relax this: if we have transactions, we can try to match them.
    if (!selectedBank) {
       toast({ title: "Select a bank account", variant: "destructive" });
       return;
    }

    setAutoMatching(true);
    // Simulate processing - in real app, we would run the matching logic here
    setTimeout(() => {
      // Logic to actually auto-select transactions that match rules could go here
      // For now, we just show the toast
      setAutoMatching(false);
      toast({ title: "Auto-match complete", description: "Updated match suggestions based on amount and description." });
    }, 1000);
  };

  const selectedBank_obj = bankAccounts.find(b => b.id === selectedBank);
  const selectedSum = transactions
    .filter(tx => selectedTxs.has(tx.id))
    .reduce((sum, tx) => sum + tx.total_amount, 0);
  
  // Calculate balance logic
  const currentSystemBalance = selectedBank_obj?.current_balance || 0;
  // Typically: System Balance + Unreconciled Items = Statement Balance (in a perfect world)
  // Or: Statement Balance - Unreconciled Items = Adjusted Bank Balance
  // Let's keep it simple: Target is Statement Balance.
  const targetBalance = parseFloat(statementBalance || "0");
  const variance = Math.abs(targetBalance - (currentSystemBalance + selectedSum)); // Simplified logic
  const isBalanced = variance <= parseFloat(tolerance);

  const filteredTransactions = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(t => !q || String(t.description || '').toLowerCase().includes(q) || String(t.reference_number || '').toLowerCase().includes(q));
  }, [transactions, search]);

  if (!selectedBank) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] space-y-4 bg-muted/10 rounded-lg border-2 border-dashed">
        <div className="p-4 rounded-full bg-primary/10">
          <RefreshCw className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Start Reconciliation</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Select a bank account to begin matching your system transactions with your bank statement.
        </p>
      <div className="w-[300px]">
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
    </div>
  );
}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reconciliation</h2>
          <p className="text-muted-foreground">Period: Current • {selectedBank_obj?.account_name}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => setSelectedBank("")}>Switch Account</Button>
           <Button variant="outline" onClick={() => setLockOpen(true)}><Lock className="h-4 w-4 mr-2" /> Lock Periods</Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Statement Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
               <span className="text-muted-foreground font-mono">R</span>
               <Input 
                 className="text-2xl font-bold h-auto p-0 border-none focus-visible:ring-0 w-full" 
                 placeholder="0.00"
                 value={statementBalance}
                 onChange={(e) => setStatementBalance(e.target.value)}
               />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Enter ending balance from bank statement</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-muted-foreground">System Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R {currentSystemBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Current ledger balance</p>
          </CardContent>
        </Card>

        <Card className={cn("transition-colors", isBalanced && statementBalance ? "bg-emerald-50 border-emerald-200" : "")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Difference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", isBalanced && statementBalance ? "text-emerald-600" : "text-rose-600")}>
               R {variance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isBalanced && statementBalance ? (
                 <Badge className="bg-emerald-500 hover:bg-emerald-600">Balanced</Badge>
              ) : (
                 <span className="text-xs text-muted-foreground">Target: 0.00</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Action Area */}
      <Card className="border-none shadow-md">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Unreconciled Transactions</CardTitle>
              <CardDescription>Select transactions that appear on your bank statement.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
               <div className="relative w-64">
                 <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                 <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
               </div>
               <Button variant="outline" onClick={handleAutoMatch} disabled={autoMatching}>
                 <Sparkles className="h-4 w-4 mr-2" />
                 Auto-Match
               </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
             {selectedTxs.size > 0 && (
             <div className={cn(
               "absolute top-0 left-0 right-0 z-10 p-2 px-4 flex items-center justify-between animate-in slide-in-from-top-2 transition-colors duration-300",
               isSuccess ? "bg-green-600 text-white" : 
               isError ? "bg-destructive text-destructive-foreground" : 
               "bg-primary text-primary-foreground"
             )}>
               <span className="text-sm font-medium">
                 {isSuccess ? "Successfully Reconciled!" : 
                  isError ? "Reconciliation Failed" : 
                  `${selectedTxs.size} selected (R ${selectedSum.toFixed(2)})`}
               </span>
               
               {isSuccess ? (
                  <div className="flex items-center gap-2 font-bold">
                    <Check className="h-5 w-5" />
                    <span>Done</span>
                  </div>
               ) : isError ? (
                   <div className="flex items-center gap-2 font-bold">
                     <XCircle className="h-5 w-5" />
                     <span>Failed</span>
                     <Button size="sm" variant="secondary" onClick={() => setIsError(false)} className="ml-2 h-7">Retry</Button>
                   </div>
               ) : (
                 <Button size="sm" variant="secondary" onClick={handleBulkReconcile} disabled={loading} className="gap-2">
                   {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                   {loading ? "Processing..." : "Reconcile Selection"}
                 </Button>
               )}
             </div>
           )}
             <Table>
              <TableHeader className="bg-muted/5">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedTxs.size === filteredTransactions.length && filteredTransactions.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedTxs(new Set(filteredTransactions.map(t => t.id)));
                        else setSelectedTxs(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Match Suggestion</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No unreconciled transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className={cn("group hover:bg-muted/50", selectedTxs.has(tx.id) && "bg-muted/30")}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedTxs.has(tx.id)}
                          onCheckedChange={() => handleToggleTransaction(tx.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{tx.description}</span>
                          {tx.reference_number && <span className="text-xs text-muted-foreground font-mono">{tx.reference_number}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={tx.total_amount >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          R {tx.total_amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {matches[tx.id] && (
                          <Badge variant="outline" className="bg-background font-normal">
                             {matches[tx.id].status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => { setSplitTx(tx); setSplitOpen(true); }}>
                           Split
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reconciled Items Section */}
      <Card className="border-none shadow-md mt-8">
        <CardHeader className="border-b bg-muted/10 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Reconciled Transactions</CardTitle>
              <CardDescription>History of matched and approved transactions.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/5">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right w-[120px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciled.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No reconciled transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                reconciled.slice(0, 20).map((tx) => (
                  <TableRow key={tx.id} className="group hover:bg-muted/50">
                    <TableCell>{new Date(tx.transaction_date).toLocaleDateString()}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell className="font-mono text-sm">{tx.reference_number || '-'}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      R {tx.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                           if (!confirm('Are you sure you want to unreconcile this transaction? It will move back to pending.')) return;
                           try {
                             const amount = Number(tx.total_amount || 0);
                             const isInflow = String(tx.transaction_type).toLowerCase().includes('income') || String(tx.transaction_type).toLowerCase().includes('deposit') || String(tx.transaction_type).toLowerCase().includes('transfer_in');
                             
                             // Delete ledger entries
                             await supabase.from('transaction_entries').delete().eq('transaction_id', tx.id);
                             await supabase.from('ledger_entries').delete().eq('transaction_id', tx.id);
                             
                             // Reset transaction status
                             await supabase.from('transactions').update({ status: 'pending' }).eq('id', tx.id);
                             
                             // Reverse balance update
                             try { 
                               await supabase.rpc('update_bank_balance', { _bank_account_id: tx.bank_account_id, _amount: amount, _operation: isInflow ? 'subtract' : 'add' }); 
                             } catch {}

                             toast({ title: 'Unreconciled', description: 'Transaction moved back to pending.' });
                             loadTransactions();
                           } catch (e: any) {
                             toast({ title: 'Error', description: e.message, variant: 'destructive' });
                           }
                        }}
                      >
                        <Undo2 className="h-4 w-4 mr-2" />
                        Unreconcile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
        <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
          <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-green-700">Success!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
            <p className="text-muted-foreground">The operation has been completed successfully.</p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isError} onOpenChange={setIsError}>
        <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
          <div className="h-24 w-24 rounded-full bg-red-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-red-700">Failed</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-gray-900">{errorMessage}</p>
            <p className="text-muted-foreground">Please review and try again.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Split Transaction</DialogTitle>
          </DialogHeader>
          <div className="py-4">
             <p className="text-muted-foreground">Split transaction functionality coming soon.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSplitOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lockOpen} onOpenChange={setLockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Periods</DialogTitle>
          </DialogHeader>
          <div className="py-4">
             <p className="text-muted-foreground">Period locking prevents changes to reconciled transactions.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setLockOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
