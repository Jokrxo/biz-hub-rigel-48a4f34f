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
import { AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
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

const ACCOUNTING_ELEMENTS = [
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" }
];

export const TransactionFormEnhanced = ({ open, onOpenChange, onSuccess, editData }: TransactionFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [autoClassification, setAutoClassification] = useState<{ type: string; category: string } | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [chartMissing, setChartMissing] = useState(false);
  
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
    bankAccountId: "",
    element: "",
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
        bankAccountId: editData.bank_account_id || "",
        element: "",
        debitAccount: "",
        creditAccount: "",
        amount: editData.total_amount?.toString() || "",
        vatRate: "15"
      });
    }
  }, [editData]);

  useEffect(() => {
    if (form.description) {
      autoClassifyTransaction(form.description);
    }
  }, [form.description]);

  useEffect(() => {
    if (form.date && form.amount && form.description && form.bankAccountId) {
      checkDuplicate();
    }
  }, [form.date, form.amount, form.description, form.bankAccountId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

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
          title: "Chart of Account missing", 
          description: "Please set up your Chart of Accounts before creating transactions.",
          variant: "destructive" 
        });
      } else {
        setChartMissing(false);
      }
      
      setAccounts(accts || []);
      setFilteredAccounts(accts || []);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase.rpc('check_duplicate_transaction', {
        _company_id: profile.company_id,
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

  const handleElementChange = (element: string) => {
    setForm({ ...form, element, debitAccount: "", creditAccount: "" });
    
    if (!element) {
      setFilteredAccounts(accounts);
      return;
    }
    
    const filtered = accounts.filter(acc => {
      const type = acc.account_type.toLowerCase();
      return type.includes(element.toLowerCase());
    });
    
    setFilteredAccounts(filtered);
    
    if (filtered.length === 0) {
      toast({ 
        title: "No accounts found", 
        description: `No accounts found for element: ${element}. Please check your chart of accounts.`,
        variant: "destructive" 
      });
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validation
      if (chartMissing) {
        toast({ 
          title: "Cannot proceed", 
          description: "Chart of Account missing or incomplete. Please set up your chart of accounts first.",
          variant: "destructive" 
        });
        return;
      }

      if (isDuplicate) {
        toast({ 
          title: "Duplicate Transaction Detected", 
          description: "A similar transaction already exists for this bank account, date, and amount.",
          variant: "destructive" 
        });
        return;
      }

      if (!form.description || !form.debitAccount || !form.creditAccount || !form.amount) {
        toast({ title: "Missing fields", description: "Please fill all required fields", variant: "destructive" });
        return;
      }

      if (form.debitAccount === form.creditAccount) {
        toast({ 
          title: "Invalid entry", 
          description: "Debit and credit accounts must be different",
          variant: "destructive" 
        });
        return;
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

      if (!profile) throw new Error("Profile not found");

      // Create transaction header
      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: profile.company_id,
          user_id: user.id,
          transaction_date: form.date,
          description: form.description,
          reference_number: form.reference || null,
          total_amount: totalAmount,
          bank_account_id: form.bankAccountId || null,
          transaction_type: autoClassification?.type || null,
          category: autoClassification?.category || null,
          status: "pending"
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create transaction entries (double-entry)
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

      toast({ 
        title: "Success", 
        description: `Transaction created and classified as ${autoClassification?.type || 'General'} - ${autoClassification?.category || 'Uncategorized'}` 
      });
      onOpenChange(false);
      onSuccess();
      
      // Reset form
      setForm({
        date: new Date().toISOString().slice(0, 10),
        description: "",
        reference: "",
        bankAccountId: "",
        element: "",
        debitAccount: "",
        creditAccount: "",
        amount: "",
        vatRate: "15"
      });
      setAutoClassification(null);
      setIsDuplicate(false);
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
            {editData ? "Edit Transaction" : "New Transaction"}
            <Badge variant="outline" className="ml-2">Double Entry Accounting</Badge>
          </DialogTitle>
        </DialogHeader>
        
        {chartMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Chart of Account missing or incomplete. Please set up your chart of accounts before creating transactions.
            </AlertDescription>
          </Alert>
        )}

        {isDuplicate && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Duplicate Transaction Detected - A similar transaction exists for this bank account, date, and amount.
            </AlertDescription>
          </Alert>
        )}

        {autoClassification && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2">
              Auto-classified as: 
              <Badge variant="secondary">{autoClassification.type}</Badge>
              <Badge variant="outline">{autoClassification.category}</Badge>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Bank Account *</Label>
              <Select value={form.bankAccountId} onValueChange={(val) => setForm({ ...form, bankAccountId: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.bank_name} - {bank.account_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Reference Number</Label>
            <Input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="e.g. INV-001"
            />
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Transaction description (e.g., 'Fuel purchase', 'Salary payment', 'Equipment purchase')"
              rows={2}
            />
          </div>

          <div>
            <Label>Accounting Element *</Label>
            <Select value={form.element} onValueChange={handleElementChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select element" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNTING_ELEMENTS.map(el => (
                  <SelectItem key={el.value} value={el.value}>{el.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Debit Account *</Label>
              <Select value={form.debitAccount} onValueChange={(val) => setForm({ ...form, debitAccount: val })} disabled={!form.element}>
                <SelectTrigger>
                  <SelectValue placeholder="Select debit account" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Credit Account *</Label>
              <Select value={form.creditAccount} onValueChange={(val) => setForm({ ...form, creditAccount: val })} disabled={!form.element}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credit account" />
                </SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_code} - {acc.account_name}
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
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>Amount:</span>
                <span className="font-mono">R {parseFloat(form.amount || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span>VAT ({form.vatRate}%):</span>
                <span className="font-mono">R {(parseFloat(form.amount || "0") * parseFloat(form.vatRate) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="font-mono">R {(parseFloat(form.amount || "0") * (1 + parseFloat(form.vatRate) / 100)).toFixed(2)}</span>
              </div>
              
              {form.debitAccount && form.creditAccount && (
                <div className="mt-3 pt-3 border-t space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Double-entry validated</span>
                  </div>
                  <div className="text-xs text-muted-foreground ml-6">
                    Debit = Credit = R {(parseFloat(form.amount || "0") * (1 + parseFloat(form.vatRate) / 100)).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || isDuplicate || chartMissing}>
            {loading ? "Saving..." : "Save Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
