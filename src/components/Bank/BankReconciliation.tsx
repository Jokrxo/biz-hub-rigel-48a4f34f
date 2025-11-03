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
import { supabase } from "@/lib/supabase";
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
      const { error } = await supabase
        .from("transactions")
        .update({ status: "posted" })
        .in("id", Array.from(selectedTxs));

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `Reconciled ${selectedTxs.size} transaction(s)` 
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
            <CardTitle>Pending Transactions ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending transactions to reconcile
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
