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
import { AlertTriangle, CheckCircle2, Building2, AlertCircle } from "lucide-react";

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
  { value: "expense", label: "Expense Payment", icon: "💸", description: "Record expense (Dr Expense / Cr Bank or Payable)" },
  { value: "income", label: "Income Received", icon: "💰", description: "Record income (Dr Bank or Receivable / Cr Revenue)" },
  { value: "asset", label: "Asset Purchase", icon: "🏢", description: "Buy fixed asset (Dr Asset / Cr Bank or Payable)" },
  { value: "liability", label: "Liability Payment", icon: "💳", description: "Pay liability (Dr Liability / Cr Bank)" },
  { value: "equity", label: "Capital Contribution", icon: "💎", description: "Owner investment (Dr Bank / Cr Capital)" }
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
  const [companyId, setCompanyId] = useState<string>("");
  const [validationError, setValidationError] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  useEffect(() => {
    if (editData) {
      // Validate that bank_account_id exists in bankAccounts list when editing
      let validBankAccount = "";
      if (editData.bank_account_id && bankAccounts.length > 0) {
        const bankExists = bankAccounts.find(bank => bank.id === editData.bank_account_id);
        if (bankExists) {
          validBankAccount = editData.bank_account_id;
        }
      }
      
      setForm({
        date: editData.transaction_date || new Date().toISOString().slice(0, 10),
        description: editData.description || "",
        reference: editData.reference_number || "",
        bankAccount: validBankAccount,
        transactionType: "",
        debitAccount: "",
        creditAccount: "",
        amount: editData.total_amount?.toString() || "",
        vatRate: "15"
      });
    }
  }, [editData, bankAccounts]);

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

      // Convert empty string to null for bank_account_id
      const bankAccountId = form.bankAccount && form.bankAccount.trim() !== "" ? form.bankAccount : null;
      
      const { data, error } = await supabase.rpc("check_duplicate_transaction", {
        _company_id: profile.company_id,
        _bank_account_id: bankAccountId,
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

  const handleTransactionTypeChange = async (txType: string) => {
    setForm({ ...form, transactionType: txType, debitAccount: "", creditAccount: "" });
    
    if (!txType) {
      setDebitAccounts([]);
      setCreditAccounts([]);
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) return;

      // Get smart account suggestions from database
      const { data: debitSuggestions } = await supabase.rpc('get_account_suggestions', {
        _company_id: profile.company_id,
        _transaction_element: txType,
        _side: 'debit'
      });

      const { data: creditSuggestions } = await supabase.rpc('get_account_suggestions', {
        _company_id: profile.company_id,
        _transaction_element: txType,
        _side: 'credit'
      });

      setDebitAccounts(debitSuggestions || []);
      setCreditAccounts(creditSuggestions || []);

      if ((!debitSuggestions || debitSuggestions.length === 0) || 
          (!creditSuggestions || creditSuggestions.length === 0)) {
        toast({ 
          title: "Chart of Accounts Missing", 
          description: `Please add accounts for this transaction type in Chart of Accounts.`,
          variant: "destructive" 
        });
      }
    } catch (error: any) {
      console.error("Error loading account suggestions:", error);
      toast({ title: "Error", description: "Failed to load account suggestions", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setValidationError("");

      // Basic validation with specific missing fields
      const missingFields = [];
      if (!form.bankAccount) missingFields.push("Bank Account");
      if (!form.description) missingFields.push("Description");
      if (!form.transactionType) missingFields.push("Transaction Type");
      if (!form.debitAccount) missingFields.push("Debit Account");
      if (!form.creditAccount) missingFields.push("Credit Account");
      if (!form.amount) missingFields.push("Amount");
      
      if (missingFields.length > 0) {
        toast({ 
          title: "Missing Required Fields", 
          description: `Please fill: ${missingFields.join(", ")}`, 
          variant: "destructive" 
        });
        return;
      }

      // Validate bank account (required in this form)
      let bankAccountId: string | null = null;
      if (form.bankAccount && form.bankAccount.trim() !== "" && form.bankAccount !== "__none__") {
        // Check if bank account exists in the loaded bank accounts list
        const bankExists = bankAccounts.find(bank => bank.id === form.bankAccount);
        if (!bankExists) {
          toast({ 
            title: "Invalid Bank Account", 
            description: "The selected bank account no longer exists. Please select a valid bank account.", 
            variant: "destructive" 
          });
          return;
        }
        // Ensure it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(form.bankAccount)) {
          toast({ 
            title: "Invalid Bank Account ID", 
            description: "Bank account ID format is invalid.", 
            variant: "destructive" 
          });
          return;
        }
        bankAccountId = form.bankAccount;
      }
      
      // Double-check: ensure we're sending null, not empty string
      if (bankAccountId === "" || bankAccountId === "__none__") {
        bankAccountId = null;
      }

      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        toast({ title: "Invalid amount", description: "Amount must be greater than 0", variant: "destructive" });
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

      if (!profile?.company_id) throw new Error("Profile not found");

      // Enhanced validation using RPC
      const { data: validation } = await supabase.rpc('validate_transaction_before_post', {
        _company_id: profile.company_id,
        _debit_account_id: form.debitAccount,
        _credit_account_id: form.creditAccount,
        _debit_amount: totalAmount,
        _credit_amount: totalAmount
      });

      if (validation && validation.length > 0 && !validation[0].is_valid) {
        setValidationError(validation[0].error_message);
        toast({ title: "Validation Error", description: validation[0].error_message, variant: "destructive" });
        return;
      }

      // Check duplicates
      if (duplicateWarning) {
        const confirmed = confirm("⚠️ Duplicate Transaction Detected!\n\nA similar transaction already exists. Do you want to proceed anyway?");
        if (!confirmed) return;
      }

      // Create transaction header with bank and classification
      // Status set to 'approved' to trigger automatic posting to ledger
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: profile.company_id,
          user_id: user.id,
          bank_account_id: bankAccountId,
          transaction_date: form.date,
          description: form.description.trim(),
          reference_number: form.reference?.trim() || null,
          total_amount: totalAmount,
          transaction_type: form.transactionType,
          category: autoClassification?.category || null,
          status: "approved"
        })
        .select()
        .single();

      if (txError) {
        console.error("Transaction insert error:", txError);
        console.error("Attempted bank_account_id value:", bankAccountId);
        console.error("Bank account ID type:", typeof bankAccountId);
        
        // Provide more helpful error messages
        if (txError.message?.includes('bank_account_id_fkey') || txError.message?.includes('foreign key constraint')) {
          toast({ 
            title: "Bank Account Error", 
            description: `The bank account reference is invalid. Please select a valid bank account. Error: ${txError.message}`, 
            variant: "destructive" 
          });
        } else {
          throw txError;
        }
        return;
      }

      // Validate account IDs before creating entries
      if (!form.debitAccount || form.debitAccount.trim() === "") {
        toast({ 
          title: "Validation Error", 
          description: "Debit account is required. Please select a debit account.", 
          variant: "destructive" 
        });
        return;
      }
      
      if (!form.creditAccount || form.creditAccount.trim() === "") {
        toast({ 
          title: "Validation Error", 
          description: "Credit account is required. Please select a credit account.", 
          variant: "destructive" 
        });
        return;
      }
      
      // Validate UUID format for account IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(form.debitAccount)) {
        toast({ 
          title: "Invalid Debit Account", 
          description: "Debit account ID format is invalid.", 
          variant: "destructive" 
        });
        return;
      }
      
      if (!uuidRegex.test(form.creditAccount)) {
        toast({ 
          title: "Invalid Credit Account", 
          description: "Credit account ID format is invalid.", 
          variant: "destructive" 
        });
        return;
      }

      // Create double-entry transaction entries
      const entries = [
        {
          transaction_id: transaction.id,
          account_id: form.debitAccount,
          debit: totalAmount,
          credit: 0,
          description: form.description.trim(),
          status: "pending"
        },
        {
          transaction_id: transaction.id,
          account_id: form.creditAccount,
          debit: 0,
          credit: totalAmount,
          description: form.description.trim(),
          status: "pending"
        }
      ];

      // Validate all entries have account_id before inserting
      const invalidEntries = entries.filter(entry => !entry.account_id || entry.account_id.trim() === "");
      if (invalidEntries.length > 0) {
        console.error("Entries with missing account_id:", invalidEntries);
        toast({ 
          title: "Validation Error", 
          description: "One or more transaction entries have missing account IDs. Please ensure all accounts are selected.", 
          variant: "destructive" 
        });
        return;
      }

      const { error: entriesError } = await supabase
        .from("transaction_entries")
        .insert(entries);

      if (entriesError) {
        console.error("Transaction entries insert error:", entriesError);
        console.error("Entries being inserted:", entries);
        toast({ 
          title: "Error Creating Transaction Entries", 
          description: entriesError.message || "Failed to create transaction entries. Please check that all accounts are valid.", 
          variant: "destructive" 
        });
        // Try to delete the transaction if entries failed
        if (transaction?.id) {
          await supabase.from("transactions").delete().eq("id", transaction.id);
        }
        return;
      }

      // Update bank account balance
      if (bankAccountId) {
        const debitAccountData = accounts.find(a => a.id === form.debitAccount);
        const creditAccountData = accounts.find(a => a.id === form.creditAccount);
        
        // If bank account is debited (receiving money), increase balance
        if (debitAccountData && debitAccountData.account_type.toLowerCase().includes('asset') && debitAccountData.account_name.toLowerCase().includes('bank')) {
          await supabase.rpc('update_bank_balance', {
            _bank_account_id: bankAccountId,
            _amount: totalAmount,
            _operation: 'add'
          });
        }
        
        // If bank account is credited (paying money), decrease balance
        if (creditAccountData && creditAccountData.account_type.toLowerCase().includes('asset') && creditAccountData.account_name.toLowerCase().includes('bank')) {
          await supabase.rpc('update_bank_balance', {
            _bank_account_id: bankAccountId,
            _amount: totalAmount,
            _operation: 'subtract'
          });
        }
      }

      // Refresh AFS cache after successful posting
      await supabase.rpc('refresh_afs_cache', { _company_id: profile.company_id });
      
      toast({ 
        title: "Success", 
        description: "Transaction posted successfully to ledger and AFS updated" 
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
      setValidationError("");
    } catch (error: any) {
      console.error('Transaction posting error:', error);
      
      // Check if it's an AFS/accounting equation error
      if (error.message?.includes('AFS Posting') || error.message?.includes('not balanced')) {
        toast({ 
          title: "Accounting Posting Error", 
          description: error.message, 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Error", 
          description: error.message || "Failed to post transaction", 
          variant: "destructive" 
        });
      }
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

          {validationError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Validation Error</p>
                <p className="text-sm text-muted-foreground">{validationError}</p>
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
                  <SelectItem key={tt.value} value={tt.value}>
                    {tt.icon} {tt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.transactionType && (
              <p className="text-xs text-muted-foreground mt-1">
                {TRANSACTION_TYPES.find(t => t.value === form.transactionType)?.description}
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
                    <SelectItem key={(acc as any).id ?? (acc as any).account_id} value={(acc as any).id ?? (acc as any).account_id}>
                      {acc.account_code} - {acc.account_name} [{(acc as any).account_type ?? ""}]
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
                    <SelectItem key={(acc as any).id ?? (acc as any).account_id} value={(acc as any).id ?? (acc as any).account_id}>
                      {acc.account_code} - {acc.account_name} [{(acc as any).account_type ?? ""}]
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