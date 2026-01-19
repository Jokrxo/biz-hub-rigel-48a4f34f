import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Building2, TrendingUp, TrendingDown, Menu, Loader2, Check } from "lucide-react";
import { CSVImport } from "./CSVImport";
import { ConnectBank } from "./ConnectBank";
import { BankReconciliation } from "./BankReconciliation";
import { BankStatementView } from "./BankStatementView";
import { FileText } from "lucide-react";

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
  const navigate = useNavigate();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [selectedBankForStatement, setSelectedBankForStatement] = useState<BankAccount | null>(null);
  const [form, setForm] = useState({
    account_name: "",
    account_number: "",
    bank_name: "",
    opening_balance: "",
    opening_balance_date: new Date().toISOString().slice(0,10)
  });
  const [branchCode, setBranchCode] = useState<string>("");
  const [inflows, setInflows] = useState(0);
  const [outflows, setOutflows] = useState(0);

  useEffect(() => {
    loadBanks();
    loadMonthlyFlows();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('bank-management-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => { loadBanks(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => { loadMonthlyFlows(); loadBanks(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      {
        const { isValidBankAccountNumber } = await import("@/lib/validators");
        if (!isValidBankAccountNumber(form.account_number)) {
          toast({ title: "Invalid account number", description: "Bank account number must be 10–20 digits", variant: "destructive" });
          return;
        }
      }

      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const openingBalance = parseFloat(form.opening_balance || "0");
      const openingDate = String(form.opening_balance_date || new Date().toISOString().slice(0,10));

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
              account_code: '3900',
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
        const { data: tx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            company_id: profile.company_id,
            user_id: user?.id || '',
            transaction_date: openingDate,
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
          { transaction_id: tx.id, account_id: bankLedger.id, debit: openingBalance, credit: 0, description: 'Opening balance', status: 'approved' },
          { transaction_id: tx.id, account_id: (openingEquity as any).id, debit: 0, credit: openingBalance, description: 'Opening balance', status: 'approved' },
        ];
        const { error: teErr } = await supabase.from("transaction_entries").insert(entries);
        if (teErr) throw teErr;

        // Post to ledger entries for reporting and status consistency
        const ledgerEntries = entries.map((e) => ({
          company_id: profile.company_id,
          account_id: e.account_id,
          debit: e.debit,
          credit: e.credit,
          entry_date: openingDate,
          is_reversed: false,
          reference_id: tx.id,
          transaction_id: tx.id,
          description: e.description,
        }));
        const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerEntries as any);
        if (leErr) throw leErr;

        // Now mark transaction approved after entries & ledger are posted
        await supabase.from('transactions').update({ status: 'approved' }).eq('id', tx.id);

        // Update bank current balance
        await supabase.rpc('update_bank_balance', { _bank_account_id: insertedBank.id, _amount: openingBalance, _operation: 'add' });

        // Persist opening and current balances on the bank record
        await supabase
          .from('bank_accounts')
          .update({ opening_balance: openingBalance, current_balance: openingBalance })
          .eq('id', insertedBank.id);
      }

      setIsSubmitting(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setOpen(false);
        setIsSuccess(false);
        setForm({ account_name: "", account_number: "", bank_name: "", opening_balance: "", opening_balance_date: new Date().toISOString().slice(0,10) });
        loadBanks();
        navigate('/transactions');
      }, 2000);
      
    } catch (error: any) {
      setIsSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const totalBalance = banks.reduce((sum, bank) => sum + bank.current_balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Bank Management</h1>
          <p className="text-muted-foreground mt-1">Manage accounts, reconcile transactions, and track cash flow.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
             <DialogTrigger asChild>
               <Button variant="outline" className="h-10 gap-2">
                 <Menu className="h-4 w-4" />
                 <span>Quick Actions</span>
               </Button>
             </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                 <DialogTitle>Quick Actions</DialogTitle>
                 <DialogDescription>Manage your banking data efficiently.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-6">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data Import</Label>
                    <div className="w-full">
                      <CSVImport bankAccounts={banks} onImportComplete={loadBanks} />
                    </div>
                    <div className="w-full">
                      <ConnectBank />
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 gap-2 bg-primary hover:bg-primary/90 shadow-sm">
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              {isSubmitting ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium text-muted-foreground">Adding Bank Account...</p>
                </div>
              ) : isSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Check className="h-10 w-10" />
                  </div>
                  <h2 className="text-xl font-bold text-center">Success!</h2>
                  <p className="text-center text-muted-foreground">YOU SUCCESSFULLY LOADED BANK</p>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Add Bank Account</DialogTitle>
                    <p className="text-sm text-muted-foreground">Enter your bank account details to track transactions.</p>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="account_name">Account Name *</Label>
                      <Input
                        id="account_name"
                        value={form.account_name}
                        onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                        placeholder="e.g. Business Cheque Account"
                        className="h-9"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Bank *</Label>
                        <Select
                          value={form.bank_name}
                          onValueChange={(val) => {
                            const selected = bankOptions.find(b => b.value === val);
                            setForm({ ...form, bank_name: val });
                            setBranchCode(selected?.branchCode || "");
                            if (!val) setForm(prev => ({ ...prev, account_number: "" }));
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select bank" />
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
                        <div className="grid gap-2">
                          <Label>Branch Code</Label>
                          <Input value={branchCode} readOnly className="bg-muted h-9" />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="account_number">Account Number *</Label>
                      <Input
                        id="account_number"
                        value={form.account_number}
                        onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                        placeholder="e.g. 62123456789"
                        disabled={!form.bank_name}
                        className="font-mono h-9"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Opening Balance</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground text-xs">R</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.opening_balance}
                            onChange={(e) => setForm({ ...form, opening_balance: e.target.value })}
                            placeholder="0.00"
                            className="pl-7 h-9"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Opening Date</Label>
                        <Input
                          type="date"
                          value={form.opening_balance_date}
                          onChange={(e) => setForm({ ...form, opening_balance_date: e.target.value })}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit}>Add Account</Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="border-none shadow-md bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Building2 className="w-24 h-24 text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bank Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              R {totalBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{banks.length} Active Account{banks.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Inflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-full">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-700">R {inflows.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Income & Receipts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Outflows</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-full">
                <TrendingDown className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-700">R {outflows.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-muted-foreground">Expenses & Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <BankStatementView 
        bankAccount={selectedBankForStatement} 
        isOpen={!!selectedBankForStatement} 
        onClose={() => setSelectedBankForStatement(null)} 
      />

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="accounts">Bank Accounts</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card className="border-none shadow-md">
            <CardHeader className="border-b bg-muted/10 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Connected Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <p className="mt-4 text-sm text-muted-foreground">Loading accounts...</p>
                </div>
              ) : banks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">No Bank Accounts</h3>
                  <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                    Connect a bank account to start tracking your business finances and reconciling transactions.
                  </p>
                  <Button onClick={() => setOpen(true)}>Add First Account</Button>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/5">
                    <TableRow>
                      <TableHead className="w-[300px] pl-6">Account Details</TableHead>
                      <TableHead>Bank Name</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead className="text-right pr-6">Current Balance</TableHead>
                      <TableHead className="w-[140px] text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banks.map((bank) => (
                      <TableRow key={bank.id} className="group hover:bg-muted/40 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                              {bank.bank_name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-foreground">{bank.account_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{bank.account_number}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                            {bank.bank_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          R {bank.opening_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <span className={`font-mono font-bold ${bank.current_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            R {bank.current_balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => setSelectedBankForStatement(bank)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Statement
                          </Button>
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
