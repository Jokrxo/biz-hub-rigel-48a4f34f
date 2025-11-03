import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { AlertCircle, CheckCircle2, Sparkles, TrendingUp, TrendingDown, Info } from "lucide-react";
import { z } from "zod";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editData?: any;
}

// Accounting element configurations with debit/credit rules
const ACCOUNTING_ELEMENTS = [
  { 
    value: "expense", 
    label: "Expense Payment", 
    icon: TrendingDown, 
    debitType: 'Expense', 
    creditTypes: ['Asset', 'Liability'],
    description: "Record business expenses (Dr Expense / Cr Bank or Payable)"
  },
  { 
    value: "income", 
    label: "Income Received", 
    icon: TrendingUp, 
    debitType: 'Asset', 
    creditTypes: ['Income'],
    description: "Record income received (Dr Bank or Receivable / Cr Income)"
  },
  { 
    value: "asset", 
    label: "Asset Purchase", 
    icon: TrendingDown, 
    debitType: 'Asset', 
    creditTypes: ['Asset', 'Liability'],
    description: "Record asset purchases (Dr Fixed Asset / Cr Bank or Payable)"
  },
  { 
    value: "liability", 
    label: "Liability Payment", 
    icon: TrendingDown, 
    debitType: 'Liability', 
    creditTypes: ['Asset'],
    description: "Record liability payments (Dr Liability / Cr Bank)"
  },
  { 
    value: "equity", 
    label: "Equity/Capital", 
    icon: TrendingUp, 
    debitType: 'Asset', 
    creditTypes: ['Equity'],
    description: "Record capital contributions (Dr Bank / Cr Capital)"
  }
];

const PAYMENT_METHODS = [
  { value: 'bank', label: 'Bank Payment/Receipt', accountKeyword: 'bank' },
  { value: 'cash', label: 'Cash Payment/Receipt', accountKeyword: 'cash' },
  { value: 'accrual', label: 'On Account (Accrual)', accountKeyword: 'payable,receivable' }
];

// Validation schema
const transactionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  description: z.string().trim().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  reference: z.string().trim().max(50, "Reference must be less than 50 characters").optional().or(z.literal("")),
  element: z.string().min(1, "Accounting element is required"),
  debitAccount: z.string().min(1, "Debit account is required"),
  creditAccount: z.string().min(1, "Credit account is required"),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be greater than 0"),
  vatRate: z.string()
});

export const TransactionFormEnhanced = ({ open, onOpenChange, onSuccess, editData }: TransactionFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [debitAccounts, setDebitAccounts] = useState<Account[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<Account[]>([]);
  const [autoClassification, setAutoClassification] = useState<{ type: string; category: string } | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [chartMissing, setChartMissing] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
    bankAccountId: "",
    element: "",
    paymentMethod: "bank",
    debitAccount: "",
    creditAccount: "",
    amount: "",
    vatRate: "15"
  });

  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Reset form when dialog closes
      setForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        reference: "",
        bankAccountId: "",
        element: "",
        paymentMethod: "bank",
        debitAccount: "",
        creditAccount: "",
        amount: "",
        vatRate: "15"
      });
      setAutoClassification(null);
      setIsDuplicate(false);
    }
  }, [open]);

  useEffect(() => {
    if (editData && open) {
      setForm({
        date: editData.transaction_date || new Date().toISOString().slice(0, 10),
        description: editData.description || "",
        reference: editData.reference_number || "",
        bankAccountId: editData.bank_account_id || "",
        element: "",
        paymentMethod: "bank",
        debitAccount: "",
        creditAccount: "",
        amount: editData.total_amount?.toString() || "",
        vatRate: "15"
      });
    }
  }, [editData, open]);

  useEffect(() => {
    if (form.description.length > 3) {
      const timer = setTimeout(() => autoClassifyTransaction(form.description), 500);
      return () => clearTimeout(timer);
    }
  }, [form.description]);

  useEffect(() => {
    if (form.date && form.amount && form.description && companyId) {
      const timer = setTimeout(() => checkDuplicate(), 500);
      return () => clearTimeout(timer);
    }
  }, [form.date, form.amount, form.description, form.bankAccountId, companyId]);

  // Filter accounts based on accounting element and payment method
  useEffect(() => {
    if (!form.element || accounts.length === 0) {
      setDebitAccounts([]);
      setCreditAccounts([]);
      return;
    }

    const config = ACCOUNTING_ELEMENTS.find(e => e.value === form.element);
    if (!config) return;

    // Filter debit accounts
    const debits = accounts.filter(acc => acc.account_type === config.debitType);
    setDebitAccounts(debits);

    // Filter credit accounts
    const credits = accounts.filter(acc => config.creditTypes.includes(acc.account_type));
    setCreditAccounts(credits);

    // Auto-select accounts based on element and payment method
    autoSelectAccounts(config, debits, credits);
  }, [form.element, form.paymentMethod, accounts]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);

      // Load bank accounts
      const { data: banks } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("account_name");
      setBankAccounts(banks || []);

      // Load chart of accounts
      const { data: accts, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("account_code");

      if (error) throw error;
      
      if (!accts || accts.length === 0) {
        setChartMissing(true);
        toast({ 
          title: "Chart of Accounts missing", 
          description: "Please set up your Chart of Accounts before creating transactions.",
          variant: "destructive" 
        });
      } else {
        setChartMissing(false);
      }
      
      setAccounts(accts || []);
    } catch (error: any) {
      toast({ title: "Error loading data", description: error.message, variant: "destructive" });
    }
  };

  const autoClassifyTransaction = async (description: string) => {
    try {
      const { data, error } = await supabase.rpc('auto_classify_transaction', {
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
      console.error("Auto-classification error:", error);
    }
  };

  const checkDuplicate = async () => {
    try {
      const { data, error } = await supabase.rpc('check_duplicate_transaction', {
        _company_id: companyId,
        _bank_account_id: form.bankAccountId || null,
        _transaction_date: form.date,
        _total_amount: parseFloat(form.amount || "0"),
        _description: form.description
      });
      if (error) throw error;
      setIsDuplicate(data === true);
    } catch (error: any) {
      console.error("Duplicate check error:", error);
    }
  };

  const autoSelectAccounts = (config: typeof ACCOUNTING_ELEMENTS[0], debits: Account[], credits: Account[]) => {
    if (!config || debits.length === 0 || credits.length === 0) return;

    const paymentMethod = PAYMENT_METHODS.find(m => m.value === form.paymentMethod);
    if (!paymentMethod) return;

    const keywords = paymentMethod.accountKeyword.split(',');

    // Auto-select based on element type and payment method
    try {
      if (form.element === 'expense' || form.element === 'asset' || form.element === 'liability') {
        // For expenses, assets, and liabilities: Credit side (payment from)
        const creditAccount = credits.find(acc => 
          keywords.some(kw => acc.account_name.toLowerCase().includes(kw.trim()))
        );
        if (creditAccount) {
          setForm(prev => ({ ...prev, creditAccount: creditAccount.id }));
        }
      } else if (form.element === 'income' || form.element === 'equity') {
        // For income and equity: Debit side (payment to)
        const debitAccount = debits.find(acc => 
          keywords.some(kw => acc.account_name.toLowerCase().includes(kw.trim()))
        );
        if (debitAccount) {
          setForm(prev => ({ ...prev, debitAccount: debitAccount.id }));
        }
      }
    } catch (error) {
      console.error("Auto-select accounts error:", error);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validation
      const validationResult = transactionSchema.safeParse(form);
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast({ title: "Validation Error", description: firstError.message, variant: "destructive" });
        return;
      }

      if (chartMissing) {
        toast({ title: "Cannot proceed", description: "Chart of Accounts missing or incomplete.", variant: "destructive" });
        return;
      }

      if (form.debitAccount === form.creditAccount) {
        toast({ title: "Invalid entry", description: "Debit and credit accounts must be different", variant: "destructive" });
        return;
      }

      const amount = parseFloat(form.amount);
      const vatRate = parseFloat(form.vatRate);
      const vatAmount = (amount * vatRate) / (100 + vatRate); // VAT from inclusive amount
      const netAmount = amount - vatAmount;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Sanitize inputs
      const sanitizedDescription = form.description.trim();
      const sanitizedReference = form.reference ? form.reference.trim() : null;

      // Create transaction header
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: companyId,
          user_id: user.id,
          transaction_date: form.date,
          description: sanitizedDescription,
          reference_number: sanitizedReference,
          total_amount: amount,
          bank_account_id: form.bankAccountId || null,
          transaction_type: form.element,
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
          debit: netAmount,
          credit: 0,
          description: sanitizedDescription,
          status: "pending"
        },
        {
          transaction_id: transaction.id,
          account_id: form.creditAccount,
          debit: 0,
          credit: netAmount,
          description: sanitizedDescription,
          status: "pending"
        }
      ];

      // Add VAT entry if applicable
      if (vatAmount > 0 && vatRate > 0) {
        const vatAccount = accounts.find(acc => 
          acc.account_name.toLowerCase().includes('vat') || 
          acc.account_name.toLowerCase().includes('tax')
        );
        
        if (vatAccount) {
          entries.push({
            transaction_id: transaction.id,
            account_id: vatAccount.id,
            debit: form.element === 'expense' ? vatAmount : 0,
            credit: form.element === 'income' ? vatAmount : 0,
            description: 'VAT',
            status: "pending"
          });
        }
      }

      const { error: entriesError } = await supabase
        .from("transaction_entries")
        .insert(entries);

      if (entriesError) throw entriesError;

      // Update bank balance if bank account is involved
      if (form.bankAccountId) {
        const debitAccount = accounts.find(a => a.id === form.debitAccount);
        const creditAccount = accounts.find(a => a.id === form.creditAccount);

        // Check if debit or credit account is a bank asset account
        if (debitAccount?.account_type === 'Asset' && debitAccount.account_name.toLowerCase().includes('bank')) {
          await supabase.rpc('update_bank_balance', {
            _bank_account_id: form.bankAccountId,
            _amount: amount,
            _operation: 'add'
          });
        } else if (creditAccount?.account_type === 'Asset' && creditAccount.account_name.toLowerCase().includes('bank')) {
          await supabase.rpc('update_bank_balance', {
            _bank_account_id: form.bankAccountId,
            _amount: amount,
            _operation: 'subtract'
          });
        }
      }

      toast({ 
        title: "Success", 
        description: "Transaction posted successfully with double-entry accounting" 
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectedElement = ACCOUNTING_ELEMENTS.find(e => e.value === form.element);
  const debitAccountName = debitAccounts.find(a => a.id === form.debitAccount)?.account_name;
  const creditAccountName = creditAccounts.find(a => a.id === form.creditAccount)?.account_name;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            Smart Double-Entry Transaction
            <Badge variant="outline">Automated Accounting Logic</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Intelligent debit/credit posting with payment method detection
          </p>
        </DialogHeader>
        
        {/* Alerts */}
        {chartMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Chart of Accounts missing. Please set up your accounts first.
            </AlertDescription>
          </Alert>
        )}

        {isDuplicate && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Possible duplicate transaction detected!
            </AlertDescription>
          </Alert>
        )}

        {autoClassification && (
          <Alert className="bg-primary/10 border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center gap-2">
              Auto-classified as: 
              <Badge variant="secondary">{autoClassification.type}</Badge>
              <Badge variant="outline">{autoClassification.category}</Badge>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-6">
          {/* Step 1: Basic Info */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">1</span>
              Transaction Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Transaction Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="bankAccount">Bank Account (Optional)</Label>
                <Select value={form.bankAccountId} onValueChange={(val) => setForm({ ...form, bankAccountId: val })}>
                  <SelectTrigger id="bankAccount">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {bankAccounts.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.bank_name} - {bank.account_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                placeholder="e.g., INV-001, REF-123"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                maxLength={50}
              />
            </div>

            <div>
              <Label htmlFor="description">Description * (max 500 chars)</Label>
              <Textarea
                id="description"
                placeholder="Enter transaction description (e.g., 'Fuel purchase', 'Client payment received')"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                maxLength={500}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                {form.description.length}/500 characters
              </p>
            </div>
          </div>

          {/* Step 2: Accounting Element & Payment Method */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">2</span>
              Accounting Classification
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="element">Accounting Element *</Label>
                <Select value={form.element} onValueChange={(val) => setForm({ ...form, element: val, debitAccount: "", creditAccount: "" })}>
                  <SelectTrigger id="element">
                    <SelectValue placeholder="Select element" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNTING_ELEMENTS.map((elem) => (
                      <SelectItem key={elem.value} value={elem.value}>
                        <div className="flex items-center gap-2">
                          <elem.icon className="h-4 w-4" />
                          {elem.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select value={form.paymentMethod} onValueChange={(val) => setForm({ ...form, paymentMethod: val })}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedElement && (
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>{selectedElement.label}:</strong> {selectedElement.description}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Step 3: Account Selection */}
          {form.element && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                Account Selection (Double-Entry)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="debitAccount">Debit Account *</Label>
                  <Select value={form.debitAccount} onValueChange={(val) => setForm({ ...form, debitAccount: val })} disabled={debitAccounts.length === 0}>
                    <SelectTrigger id="debitAccount">
                      <SelectValue placeholder="Select debit account" />
                    </SelectTrigger>
                    <SelectContent>
                      {debitAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_code} - {acc.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing {selectedElement?.debitType} accounts
                  </p>
                </div>

                <div>
                  <Label htmlFor="creditAccount">Credit Account *</Label>
                  <Select value={form.creditAccount} onValueChange={(val) => setForm({ ...form, creditAccount: val })} disabled={creditAccounts.length === 0}>
                    <SelectTrigger id="creditAccount">
                      <SelectValue placeholder="Select credit account" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.account_code} - {acc.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing {selectedElement?.creditTypes?.join('/')} accounts
                  </p>
                </div>
              </div>

              {debitAccountName && creditAccountName && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-900 dark:text-green-100">
                    <strong>Journal Entry:</strong> Dr {debitAccountName} / Cr {creditAccountName}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 4: Amount & VAT */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">4</span>
              Amount & Tax
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Total Amount (incl. VAT) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="vatRate">VAT Rate (%)</Label>
                <Select value={form.vatRate} onValueChange={(val) => setForm({ ...form, vatRate: val })}>
                  <SelectTrigger id="vatRate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (No VAT)</SelectItem>
                    <SelectItem value="15">15% (Standard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary */}
            {form.amount && parseFloat(form.amount) > 0 && (
              <div className="p-4 bg-background rounded-lg border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount (incl. VAT):</span>
                  <span className="font-mono">R {parseFloat(form.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({form.vatRate}%):</span>
                  <span className="font-mono">
                    R {((parseFloat(form.amount) * parseFloat(form.vatRate)) / (100 + parseFloat(form.vatRate))).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-semibold border-t pt-2">
                  <span>Net Amount:</span>
                  <span className="font-mono">
                    R {(parseFloat(form.amount) - (parseFloat(form.amount) * parseFloat(form.vatRate)) / (100 + parseFloat(form.vatRate))).toFixed(2)}
                  </span>
                </div>

                {form.debitAccount && form.creditAccount && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">Double-entry validated: Debit = Credit</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || chartMissing || !form.element || !form.debitAccount || !form.creditAccount}
            className="bg-gradient-primary hover:opacity-90"
          >
            {loading ? "Posting Transaction..." : "Post Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
