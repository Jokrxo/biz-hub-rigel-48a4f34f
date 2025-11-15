import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Building2, TrendingUp, TrendingDown } from "lucide-react";
import { CSVImport } from "./CSVImport";
import { ConnectBank } from "./ConnectBank";
import { BankReconciliation } from "./BankReconciliation";

const bankOptions = [
  { value: "ABSA", label: "ABSA Bank", branchCode: "632005" },
  { value: "FNB", label: "First National Bank", branchCode: "250655" },
  { value: "Standard Bank", label: "Standard Bank", branchCode: "051001" },
  { value: "Nedbank", label: "Nedbank", branchCode: "198765" },
  { value: "Capitec", label: "Capitec Bank", branchCode: "470010" },
  { value: "Investec", label: "Investec Bank", branchCode: "580105" },
  { value: "Discovery Bank", label: "Discovery Bank", branchCode: "679000" },
  { value: "TymeBank", label: "TymeBank", branchCode: "678910" },
  { value: "African Bank", label: "African Bank", branchCode: "430000" },
  { value: "Bidvest Bank", label: "Bidvest Bank", branchCode: "462005" },
  { value: "Sasfin Bank", label: "Sasfin Bank", branchCode: "683000" },
  { value: "Mercantile Bank", label: "Mercantile Bank", branchCode: "450905" }
];

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  opening_balance: number;
  current_balance: number;
  created_at: string;
}

export const BankManagement = () => {
  const { toast } = useToast();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    opening_balance: ""
  });
  const [branchCode, setBranchCode] = useState<string>("");
  const [inflows, setInflows] = useState(0);
  const [outflows, setOutflows] = useState(0);

  useEffect(() => {
    loadBanks();
    loadMonthlyFlows();
  }, []);

  const loadMonthlyFlows = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .select('total_amount')
        .eq('company_id', profile.company_id)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);

      if (error) throw error;

      let currentInflows = 0;
      let currentOutflows = 0;

      data.forEach(tx => {
        if (tx.total_amount > 0) {
          currentInflows += tx.total_amount;
        } else {
          currentOutflows += Math.abs(tx.total_amount);
        }
      });

      setInflows(currentInflows);
      setOutflows(currentOutflows);

    } catch (error: any) {
      toast({ title: "Error loading monthly flows", description: error.message, variant: "destructive" });
    }
  };

  const loadBanks = async () => {
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

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBanks(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (!form.account_name || !form.account_number || !form.bank_name) {
        toast({ title: "Missing fields", description: "Please fill all required fields", variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const openingBalance = parseFloat(form.opening_balance || "0");

      // Insert bank with zero balances to avoid DB triggers posting with missing account ids
      const { data: insertedBank, error: bankErr } = await supabase
        .from("bank_accounts")
        .insert({
          company_id: profile.company_id,
          account_name: form.account_name,
          account_number: form.account_number,
          bank_name: form.bank_name,
          opening_balance: 0,
          current_balance: 0
        })
        .select("id, company_id, account_name")
        .single();

      if (bankErr) throw bankErr;

      // If opening balance provided, create an opening balance transaction with valid ledger accounts
      if (openingBalance > 0 && insertedBank?.id) {
        // Try to find a Bank asset ledger account
        const { data: accountsList } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("is_active", true)
          .order("account_code");

        const findAccountBy = (type: string, nameIncludes: string) =>
          (accountsList || []).find(a => a.account_type.toLowerCase() === type.toLowerCase() && (a.account_name || '').toLowerCase().includes(nameIncludes));

        let bankLedger = findAccountBy('Asset', 'bank') || findAccountBy('Asset', 'cash');
        let openingEquity = (accountsList || []).find(a => a.account_type.toLowerCase() === 'equity' && (a.account_name || '').toLowerCase().includes('opening'));

        // If missing, create minimal accounts
        const nextCode = (prefix: string) => {
          const codes = (accountsList || [])
            .map(a => parseInt(a.account_code, 10))
            .filter(n => !isNaN(n));
          const base = parseInt(prefix, 10);
          let code = base;
          while (codes.includes(code)) code += 1;
          return String(code);
        };

        if (!bankLedger) {
          const { data: newBankAcc, error: createBankAccErr } = await supabase
            .from("chart_of_accounts")
            .insert({
              company_id: profile.company_id,
              account_code: nextCode('1100'),
              account_name: `Bank - ${form.account_name}`,
              account_type: 'asset',
              is_active: true,
            })
            .select("id, account_code, account_name, account_type")
            .single();
          if (createBankAccErr) throw createBankAccErr;
          bankLedger = newBankAcc as any;
        }

        if (!openingEquity) {
          const { data: newEquity, error: createEquityErr } = await supabase
            .from("chart_of_accounts")
            .insert({
              company_id: profile.company_id,
              account_code: nextCode('3000'),
              account_name: 'Opening Balance Equity',
              account_type: 'equity',
              is_active: true,
            })
            .select("id, account_code, account_name, account_type")
            .single();
          if (createEquityErr) throw createEquityErr;
          openingEquity = newEquity as any;
        }

        // Create transaction and entries
        const { data: { user } } = await supabase.auth.getUser();
        const today = new Date().toISOString().slice(0, 10);
        const { data: tx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            company_id: profile.company_id,
            user_id: user?.id || '',
            transaction_date: today,
            description: `Opening balance for ${form.account_name}`,
            reference_number: null,
            total_amount: openingBalance,
            bank_account_id: insertedBank.id,
            transaction_type: 'equity',
            status: 'pending'
          })
          .select("id")
          .single();
        if (txErr) throw txErr;

        const entries = [
          { transaction_id: tx.id, account_id: bankLedger.id, debit: openingBalance, credit: 0, description: 'Opening balance', status: 'pending' },
          { transaction_id: tx.id, account_id: (openingEquity as any).id, debit: 0, credit: openingBalance, description: 'Opening balance', status: 'pending' },
        ];
        const { error: teErr } = await supabase.from("transaction_entries").insert(entries);
        if (teErr) throw teErr;

        // Now mark transaction approved
        await supabase.from('transactions').update({ status: 'approved' }).eq('id', tx.id);

        // Update bank current balance
        await supabase.rpc('update_bank_balance', { _bank_account_id: insertedBank.id, _amount: openingBalance, _operation: 'add' });
      }

      toast({ title: "Success", description: "Bank account added successfully" });
      setOpen(false);
      setForm({ account_name: "", account_number: "", bank_name: "", opening_balance: "" });
      loadBanks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const totalBalance = banks.reduce((sum, bank) => sum + bank.current_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bank Management</h1>
          <p className="text-muted-foreground mt-1">Manage bank accounts, import statements, and reconcile transactions</p>
        </div>
        <div className="flex gap-3">
          <CSVImport bankAccounts={banks} onImportComplete={loadBanks} />
          <ConnectBank />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Add Bank Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
              </DialogHeader>
            <div className="grid gap-4">
              <div>
                <Label>Account Name *</Label>
                <Input
                  value={form.account_name}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  placeholder="e.g. Business Cheque Account"
                />
              </div>
              <div>
                <Label>Bank *</Label>
                <Select
                  value={form.bank_name}
                  onValueChange={(val) => {
                    const selected = bankOptions.find(b => b.value === val);
                    setForm({ ...form, bank_name: val });
                    setBranchCode(selected?.branchCode || "");
                    // Clear account number when changing bank selection
                    if (!val) setForm(prev => ({ ...prev, account_number: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankOptions.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.bank_name && (
                <div>
                  <Label>Branch Code</Label>
                  <Input value={branchCode} readOnly placeholder="Auto-filled branch code" />
                </div>
              )}
              <div>
                <Label>Account Number *</Label>
                <Input
                  value={form.account_number}
                  onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  placeholder="e.g. 62123456789"
                  disabled={!form.bank_name}
                />
              </div>
              <div>
                <Label>Opening Balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>Add Account</Button>
            </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bank Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R {totalBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{banks.length} account(s)</p>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div className="text-2xl font-bold">R {inflows.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Inflows</p>
          </CardContent>
        </Card>

        <Card className="card-professional">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <div className="text-2xl font-bold">R {outflows.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Outflows</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Bank Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : banks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bank accounts yet. Add your first bank account to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Account Number</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead className="text-right">Current Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banks.map((bank) => (
                      <TableRow key={bank.id}>
                        <TableCell className="font-medium">{bank.account_name}</TableCell>
                        <TableCell>{bank.bank_name}</TableCell>
                        <TableCell className="font-mono">{bank.account_number}</TableCell>
                        <TableCell className="text-right font-mono">
                          R {bank.opening_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-primary">
                          R {bank.current_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {/* Actions can be added here */}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <BankReconciliation bankAccounts={banks} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
