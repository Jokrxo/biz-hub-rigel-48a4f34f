import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, CheckCircle2, Building2 } from "lucide-react";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: any;
}

const TRANSACTION_TYPES = [
  { value: "income", label: "Income Received", debitTypes: ["asset"], creditTypes: ["revenue"] },
  { value: "expense", label: "Expense Paid", debitTypes: ["expense"], creditTypes: ["asset"] },
  { value: "asset_purchase", label: "Asset Purchase", debitTypes: ["asset"], creditTypes: ["asset", "liability"] },
  { value: "liability_payment", label: "Liability Payment", debitTypes: ["liability"], creditTypes: ["asset"] },
  { value: "transfer", label: "Transfer", debitTypes: ["asset"], creditTypes: ["asset"] },
  { value: "other", label: "Other", debitTypes: ["asset", "liability", "equity", "revenue", "expense"], creditTypes: ["asset", "liability", "equity", "revenue", "expense"] }
];

export const TransactionForm = ({ open, onOpenChange, onSuccess, editData }: TransactionFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [debitAccounts, setDebitAccounts] = useState<Account[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<Account[]>([]);
  const [autoClassification, setAutoClassification] = useState<{ type: string; category: string } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
    bankAccount: "",
    transactionType: "",
    debitAccount: "",
    creditAccount: "",
    amount: "",
    vatRate: "15"
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (editData) {
      setForm({
        date: editData.transaction_date || new Date().toISOString().slice(0, 10),
        description: editData.description || "",
        reference: editData.reference_number || "",
        bankAccount: editData.bank_account_id || "",
        transactionType: "",
        debitAccount: "",
        creditAccount: "",
        amount: editData.total_amount?.toString() || "",
        vatRate: "15"
      });
    }
  }, [editData]);

  // Auto-classify when description changes
  useEffect(() => {
    if (form.description && form.description.length > 3) {
      classifyTransaction(form.description);
    } else {
      setAutoClassification(null);
    }
  }, [form.description]);

  // Check for duplicates when form changes
  useEffect(() => {
    if (form.description && form.amount && form.date && form.bankAccount) {
      checkDuplicate();
    } else {
      setDuplicateWarning(false);
    }
  }, [form.description, form.amount, form.date, form.bankAccount]);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      // Load chart of accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("account_code");

      if (accountsError) throw accountsError;

      // Load bank accounts
      const { data: bankData, error: bankError } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("bank_name");

      if (bankError) throw bankError;

      setAccounts(accountsData || []);
      setDebitAccounts(accountsData || []);
      setCreditAccounts(accountsData || []);
      setBankAccounts(bankData || []);

      if (!bankData || bankData.length === 0) {
        toast({
          title: "No Bank Accounts",
          description: "Please set up bank accounts first in the Bank module.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({ title: "Error loading data", description: error.message, variant: "destructive" });
    }
  };

  const classifyTransaction = async (description: string) => {
    try {
      const { data, error } = await supabase.rpc("auto_classify_transaction", {
        _description: description
      });

      if (error) throw error;
      if (data && data.length > 0) {
        setAutoClassification({
          type: data[0].transaction_type,
          category: data[0].category
        });
      }
    } catch (error: any) {
      console.error("Classification error:", error);
    }
  };

  const checkDuplicate = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase.rpc("check_duplicate_transaction", {
        _company_id: profile.company_id,
        _bank_account_id: form.bankAccount,
        _transaction_date: form.date,
        _total_amount: parseFloat(form.amount || "0"),
        _description: form.description
      });

      if (error) throw error;
      setDuplicateWarning(data === true);
    } catch (error: any) {
      console.error("Duplicate check error:", error);
    }
  };

  const handleTransactionTypeChange = (txType: string) => {
    setForm({ ...form, transactionType: txType, debitAccount: "", creditAccount: "" });
    
    if (!txType) {
      setDebitAccounts(accounts);
      setCreditAccounts(accounts);
      return;
    }
    
    const selectedType = TRANSACTION_TYPES.find(t => t.value === txType);
    if (!selectedType) return;
    
    const debitFiltered = accounts.filter(acc => {
      const type = acc.account_type.toLowerCase();
      return selectedType.debitTypes.some(dt => type.includes(dt));
    });
    
    const creditFiltered = accounts.filter(acc => {
      const type = acc.account_type.toLowerCase();
      return selectedType.creditTypes.some(ct => type.includes(ct));
    });
    
    setDebitAccounts(debitFiltered);
    setCreditAccounts(creditFiltered);
    
    if (debitFiltered.length === 0 || creditFiltered.length === 0) {
      toast({ 
        title: "Chart of Accounts Missing", 
        description: `Please add accounts for this transaction type in Chart of Accounts.`,
        variant: "destructive" 
      });
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validation
      if (!form.description || !form.bankAccount || !form.debitAccount || !form.creditAccount || !form.amount) {
        toast({ title: "Missing fields", description: "Please fill all required fields", variant: "destructive" });
        return;
      }

      if (duplicateWarning) {
        const confirmed = confirm("⚠️ Duplicate Transaction Detected!\n\nA similar transaction already exists. Do you want to proceed anyway?");
        if (!confirmed) return;
      }

      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        toast({ title: "Invalid amount", description: "Amount must be greater than 0", variant: "destructive" });
        return;
      }

      if (form.debitAccount === form.creditAccount) {
        toast({ title: "Invalid accounts", description: "Debit and credit accounts must be different", variant: "destructive" });
        return;
      }

      const vatAmount = amount * (parseFloat(form.vatRate) / 100);
      const totalAmount = amount + vatAmount;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Create transaction header with bank and classification
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: profile.company_id,
          user_id: user.id,
          bank_account_id: form.bankAccount,
          transaction_date: form.date,
          description: form.description,
          reference_number: form.reference || null,
          total_amount: totalAmount,
          transaction_type: autoClassification?.type || null,
          category: autoClassification?.category || null,
          status: "pending"
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create double-entry transaction entries
      const entries = [
        {
          transaction_id: transaction.id,
          account_id: form.debitAccount,
          debit: totalAmount,
          credit: 0,
          description: form.description,
          status: "pending"
        },
        {
          transaction_id: transaction.id,
          account_id: form.creditAccount,
          debit: 0,
          credit: totalAmount,
          description: form.description,
          status: "pending"
        }
      ];

      const { error: entriesError } = await supabase
        .from("transaction_entries")
        .insert(entries);

      if (entriesError) throw entriesError;

      // Update bank account balance
      const debitAccountData = accounts.find(a => a.id === form.debitAccount);
      const creditAccountData = accounts.find(a => a.id === form.creditAccount);
      
      // If bank account is debited (receiving money), increase balance
      if (debitAccountData && debitAccountData.account_type.toLowerCase().includes('asset') && debitAccountData.account_name.toLowerCase().includes('bank')) {
        await supabase.rpc('update_bank_balance', {
          _bank_account_id: form.bankAccount,
          _amount: totalAmount,
          _operation: 'add'
        });
      }
      
      // If bank account is credited (paying money), decrease balance
      if (creditAccountData && creditAccountData.account_type.toLowerCase().includes('asset') && creditAccountData.account_name.toLowerCase().includes('bank')) {
        await supabase.rpc('update_bank_balance', {
          _bank_account_id: form.bankAccount,
          _amount: totalAmount,
          _operation: 'subtract'
        });
      }

      toast({ 
        title: "✓ Transaction Posted", 
        description: `Transaction created and posted to ledger${autoClassification ? ` (${autoClassification.category})` : ''}` 
      });
      
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        reference: "",
        bankAccount: "",
        transactionType: "",
        debitAccount: "",
        creditAccount: "",
        amount: "",
        vatRate: "15"
      });
      setAutoClassification(null);
      setDuplicateWarning(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {editData ? "Edit Transaction" : "New Transaction - Double Entry"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4">
          {/* Bank Account Selection */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4" />
              Bank Account * (Company Isolation)
            </Label>
            <Select value={form.bankAccount} onValueChange={(val) => setForm({ ...form, bankAccount: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map(bank => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.bank_name} - {bank.account_name} ({bank.account_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Transaction Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Reference Number</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="e.g. INV-001"
              />
            </div>
          </div>

          <div>
            <Label>Description * (Auto-Classification)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. 'Fuel purchase', 'Equipment', 'Salary payment'"
              rows={2}
            />
            {autoClassification && (
              <div className="mt-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Auto-classified as: 
                  <Badge className="ml-2" variant="secondary">
                    {autoClassification.type} - {autoClassification.category}
                  </Badge>
                </span>
              </div>
            )}
          </div>

          {duplicateWarning && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">⚠️ Duplicate Transaction Detected</p>
                <p className="text-sm text-muted-foreground">A similar transaction already exists for this bank account, date, and amount.</p>
              </div>
            </div>
          )}

          <div>
            <Label>Transaction Type *</Label>
            <Select value={form.transactionType} onValueChange={handleTransactionTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select transaction type" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map(tt => (
                  <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.transactionType && (
              <p className="text-xs text-muted-foreground mt-1">
                {form.transactionType === 'income' && '💰 Dr: Bank Account | Cr: Income Account'}
                {form.transactionType === 'expense' && '💸 Dr: Expense Account | Cr: Bank Account'}
                {form.transactionType === 'asset_purchase' && '🏢 Dr: Asset | Cr: Bank/Payable'}
                {form.transactionType === 'liability_payment' && '💳 Dr: Liability | Cr: Bank'}
                {form.transactionType === 'transfer' && '🔄 Dr: Receiving Account | Cr: Sending Account'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
            <div>
              <Label>Debit Account * (Dr)</Label>
              <Select value={form.debitAccount} onValueChange={(val) => setForm({ ...form, debitAccount: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select debit account" />
                </SelectTrigger>
                <SelectContent>
                  {debitAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name} [{acc.account_type}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Credit Account * (Cr)</Label>
              <Select value={form.creditAccount} onValueChange={(val) => setForm({ ...form, creditAccount: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credit account" />
                </SelectTrigger>
                <SelectContent>
                  {creditAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name} [{acc.account_type}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount (excl. VAT) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>VAT Rate (%)</Label>
              <Select value={form.vatRate} onValueChange={(val) => setForm({ ...form, vatRate: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (No VAT)</SelectItem>
                  <SelectItem value="15">15% (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.amount && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex justify-between text-sm">
                <span>Amount:</span>
                <span className="font-mono">R {parseFloat(form.amount || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span>VAT ({form.vatRate}%):</span>
                <span className="font-mono">R {(parseFloat(form.amount || "0") * parseFloat(form.vatRate) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold mt-2 pt-2 border-t border-primary/10">
                <span>Total (Posted Amount):</span>
                <span className="font-mono text-primary">R {(parseFloat(form.amount || "0") * (1 + parseFloat(form.vatRate) / 100)).toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
            <p className="font-semibold mb-1">✓ Double-Entry & Bank Balance:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Debit and Credit must be selected from valid account types</li>
              <li>Both entries will post the same amount</li>
              <li>Bank balance will be updated automatically (Dr = Add, Cr = Subtract)</li>
              <li>Transaction will update Trial Balance automatically</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.bankAccount}>
            {loading ? "Posting..." : "Post Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};