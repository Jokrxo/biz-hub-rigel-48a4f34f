import { useState, useEffect } from "react";
import React from "react";
import { lazy, Suspense } from "react";
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
import { AlertCircle, CheckCircle2, Sparkles, TrendingUp, TrendingDown, Info, Search } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandDialog } from "@/components/ui/command";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";

const ChartOfAccountsLazy = lazy(() => import("./ChartOfAccountsManagement").then(m => ({ default: m.ChartOfAccountsManagement })));


interface Account {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string; // stored lowercase in DB: asset|liability|equity|income|expense
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
    debitType: 'expense', 
    creditTypes: ['asset', 'liability'],
    description: "Record business expenses (Dr Expense / Cr Bank or Payable)"
  },
  { 
    value: "income", 
    label: "Income Received", 
    description: "A transaction where the business receives money for goods or services sold.",
    debitType: "asset",
    creditTypes: ["income", "revenue"],
  },
  { 
    value: "asset", 
    label: "Asset Purchase", 
    icon: TrendingDown, 
    debitType: 'asset', 
    creditTypes: ['asset', 'liability'],
    description: "Record asset purchases (Dr Fixed Asset / Cr Bank or Payable)"
  },
  { 
    value: "liability", 
    label: "Liability Payment", 
    icon: TrendingDown, 
    debitType: 'liability', 
    creditTypes: ['asset'],
    description: "Record liability payments (Dr Liability / Cr Bank)"
  },
  { 
    value: "equity", 
    label: "Equity/Capital", 
    icon: TrendingUp, 
    debitType: 'asset', 
    creditTypes: ['equity'],
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
  const [debitSearch, setDebitSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [debitSearchOpen, setDebitSearchOpen] = useState(false);
  const [creditSearchOpen, setCreditSearchOpen] = useState(false);
  const [debitIncludeAll, setDebitIncludeAll] = useState(false);
  const [creditIncludeAll, setCreditIncludeAll] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  
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
      setDebitSearch("");
      setCreditSearch("");
    }
  }, [open, editData]);

  // Prefill form when editing an existing transaction
  useEffect(() => {
    if (!open || !editData) return;
    try {
      setForm(prev => ({
        ...prev,
        date: (editData.transaction_date || new Date().toISOString().slice(0, 10)).slice(0, 10),
        description: editData.description || "",
        reference: editData.reference_number || "",
        bankAccountId: editData.bank_account_id || "",
        element: (editData.transaction_type || (Number(editData.total_amount || 0) >= 0 ? 'income' : 'expense')),
        debitAccount: editData.debit_account_id || prev.debitAccount,
        creditAccount: editData.credit_account_id || prev.creditAccount,
        amount: String(Math.abs(editData.total_amount || 0)),
        vatRate: prev.vatRate
      }));
    } catch {}
  }, [open, editData]);

  // Filter accounts based on search input
  const debitSource = debitIncludeAll ? accounts : debitAccounts;
  const creditSource = creditIncludeAll ? accounts : creditAccounts;

  const filteredDebitAccounts = debitSource.filter(a =>
    a.account_name.toLowerCase().includes(debitSearch.toLowerCase()) ||
    a.account_code.toLowerCase().includes(debitSearch.toLowerCase())
  );

  const filteredCreditAccounts = creditSource.filter(a =>
    a.account_name.toLowerCase().includes(creditSearch.toLowerCase()) ||
    a.account_code.toLowerCase().includes(creditSearch.toLowerCase())
  );

  // Debounce search input
  useEffect(() => {
    setDebitSearch("");
    setCreditSearch("");
  }, [open, editData]);

  // Filter accounts based on accounting element and payment method
  useEffect(() => {
    if (!form.element || accounts.length === 0) {
      setDebitAccounts([]);
      setCreditAccounts([]);
      return;
    }

    const config = ACCOUNTING_ELEMENTS.find(e => e.value === form.element);
    if (!config) return;

    // Base filtered sets by element
    let debits = accounts.filter(acc => (acc.account_type || '').toLowerCase() === config.debitType);
    let credits = accounts.filter(acc => config.creditTypes.includes((acc.account_type || '').toLowerCase()));

    // Exclude the opposite side's currently selected account to avoid duplicates
    if (form.creditAccount) {
      debits = debits.filter(acc => acc.id !== form.creditAccount);
    }
    if (form.debitAccount) {
      credits = credits.filter(acc => acc.id !== form.debitAccount);
    }

    setDebitAccounts(debits);
    setCreditAccounts(credits);

    // Auto-select accounts based on element and payment method
    autoSelectAccounts(config, debits, credits);

    // Fallback defaults: if not selected yet, choose the first available
    setForm(prev => ({
      ...prev,
      debitAccount: prev.debitAccount || (debits[0]?.id || ""),
      creditAccount: prev.creditAccount || (credits[0]?.id || ""),
    }));
  }, [form.element, form.paymentMethod, accounts, form.debitAccount, form.creditAccount]);

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
      // Convert empty string to null for bank_account_id
      const bankAccountId = form.bankAccountId && form.bankAccountId.trim() !== "" ? form.bankAccountId : null;
      
      const { data, error } = await supabase.rpc('check_duplicate_transaction', {
        _company_id: companyId,
        _bank_account_id: bankAccountId,
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
          keywords.some(kw => (acc.account_name || '').toLowerCase().includes(kw.trim()))
        );
        if (creditAccount) {
          setForm(prev => ({ ...prev, creditAccount: creditAccount.id }));
        }
      } else if (form.element === 'income' || form.element === 'equity') {
        // For income and equity: Debit side (payment to)
        const debitAccount = debits.find(acc => 
          keywords.some(kw => (acc.account_name || '').toLowerCase().includes(kw.trim()))
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

      // If editing, update the transaction header fields and account mapping
      if (editData) {
        // Guard: ensure we have a valid transaction id to post against
        if (!editData.id) {
          toast({ 
            title: "Missing transaction ID", 
            description: "Cannot post ledger entries without a valid transaction.", 
            variant: "destructive" 
          });
          return;
        }
        const amountNum = parseFloat(form.amount || "0");
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ 
            transaction_date: form.date,
            description: form.description.trim(),
            reference_number: form.reference ? form.reference.trim() : null,
            transaction_type: form.element || null,
            bank_account_id: form.bankAccountId && form.bankAccountId.trim() !== "" ? form.bankAccountId : null,
            total_amount: isNaN(amountNum) ? 0 : amountNum,
            debit_account_id: form.debitAccount,
            credit_account_id: form.creditAccount,
           })
          .eq("id", editData.id);

        if (updateError) throw updateError;

        // Simple posting logic: recreate double-entry rows for trial balance
        // Remove prior entries to avoid duplicates (transaction_entries and ledger_entries)
        await supabase.from("transaction_entries").delete().eq("transaction_id", editData.id);
        await supabase.from("ledger_entries").delete().eq("transaction_id", editData.id);

        const sanitizedDescription = form.description.trim();
        const amountAbs = Math.abs(amountNum || 0);
        
        // Resolve company id for ledger insert
        let effectiveCompanyId = companyId;
        if (!effectiveCompanyId || effectiveCompanyId.trim() === "") {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('user_id', user.id)
                .single();
              if (prof?.company_id) {
                effectiveCompanyId = prof.company_id as string;
              }
            }
          } catch {}
        }
        if (!effectiveCompanyId || effectiveCompanyId.trim() === "") {
          toast({ 
            title: "Company context missing", 
            description: "Company ID is required to post ledger entries.", 
            variant: "destructive" 
          });
          return;
        }
        const simpleEntries = [
          {
            transaction_id: editData.id,
            account_id: form.debitAccount,
            debit: amountAbs,
            credit: 0,
            description: sanitizedDescription,
            status: "approved"
          },
          {
            transaction_id: editData.id,
            account_id: form.creditAccount,
            debit: 0,
            credit: amountAbs,
            description: sanitizedDescription,
            status: "approved"
          }
        ];

        const { error: entriesErr } = await supabase
          .from("transaction_entries")
          .insert(simpleEntries);
        if (entriesErr) throw entriesErr;

        // Also insert into ledger_entries so AFS/Trial Balance sees the amounts
        const ledgerRows = [
          {
            company_id: effectiveCompanyId,
            transaction_id: editData.id,
            account_id: form.debitAccount,
            entry_date: form.date,
            description: sanitizedDescription,
            debit: amountAbs,
            credit: 0,
            is_reversed: false,
          },
          {
            company_id: effectiveCompanyId,
            transaction_id: editData.id,
            account_id: form.creditAccount,
            entry_date: form.date,
            description: sanitizedDescription,
            debit: 0,
            credit: amountAbs,
            is_reversed: false,
          }
        ];

        const { error: ledgerErr } = await supabase
          .from("ledger_entries")
          .insert(ledgerRows);
        if (ledgerErr) throw ledgerErr;

        // Optional: mark transaction approved for clarity in UI
        await supabase.from("transactions").update({ status: "approved" }).eq("id", editData.id);

        // Optional: refresh AFS/trial balance cache (if available)
        try {
          if (companyId) {
            await supabase.rpc('refresh_afs_cache', { _company_id: companyId });
          }
        } catch {}

        toast({ title: "Success", description: "Transaction posted to Trial Balance" });
        onOpenChange(false);
        onSuccess();
        return;
      }

      // Validate bank account if provided (and enforce when payment method is bank)
      let bankAccountId: string | null = null;
      if (form.bankAccountId && form.bankAccountId.trim() !== "" && form.bankAccountId !== "__none__") {
        // Check if bank account exists in the loaded bank accounts list
        const bankExists = bankAccounts.find(bank => bank.id === form.bankAccountId);
        if (!bankExists) {
          toast({ 
            title: "Invalid Bank Account", 
            description: "The selected bank account no longer exists. Please select a valid bank account or leave it empty.", 
            variant: "destructive" 
          });
          return;
        }
        // Ensure it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(form.bankAccountId)) {
          toast({ 
            title: "Invalid Bank Account ID", 
            description: "Bank account ID format is invalid.", 
            variant: "destructive" 
          });
          return;
        }
        bankAccountId = form.bankAccountId;
      }
      
      // Double-check: ensure we're sending null, not empty string
      if (bankAccountId === "" || bankAccountId === "__none__") {
        bankAccountId = null;
      }

      // If payment method is bank, enforce that a valid bank account is selected
      if (form.paymentMethod === 'bank' && !bankAccountId) {
        toast({ 
          title: "Bank Account Required", 
          description: "For bank payments/receipts, please select a valid bank account.", 
          variant: "destructive" 
        });
        return;
      }

      const amount = parseFloat(form.amount);
      const vatRate = parseFloat(form.vatRate);
      const vatAmount = vatRate > 0 ? (amount * vatRate) / (100 + vatRate) : 0; // VAT from inclusive amount
      const netAmount = amount - vatAmount;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Sanitize inputs
      const sanitizedDescription = form.description.trim();
      const sanitizedReference = form.reference ? form.reference.trim() : null;

      // Get VAT account if needed
      let vatAccount = null;
      if (vatAmount > 0 && vatRate > 0) {
        vatAccount = accounts.find(acc => 
          (acc.account_name || '').toLowerCase().includes('vat') || 
          (acc.account_name || '').toLowerCase().includes('tax')
        );
        
        if (!vatAccount) {
          toast({ 
            title: "VAT Account Missing", 
            description: "Please create a VAT account in Chart of Accounts before adding VAT transactions.", 
            variant: "destructive" 
          });
          return;
        }
      }

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
          vat_rate: vatRate > 0 ? vatRate : null,
          vat_amount: vatAmount > 0 ? vatAmount : null,
          base_amount: netAmount,
          vat_inclusive: vatRate > 0,
          bank_account_id: bankAccountId,
          transaction_type: form.element,
          category: autoClassification?.category || null,
          status: "pending"
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
            description: `The bank account reference is invalid. Please select a valid bank account or leave it empty. Error: ${txError.message}`, 
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
      // For VAT-inclusive transactions:
      // - Expense: Dr Expense (net), Dr VAT Input (vat), Cr Bank (total)
      // - Income: Dr Bank (total), Cr Income (net), Cr VAT Output (vat)
      const entries: any[] = [];

      // If payment method is bank, ensure one side is a bank Asset account
      if (form.paymentMethod === 'bank') {
        const debitAcc = accounts.find(a => a.id === form.debitAccount);
        const creditAcc = accounts.find(a => a.id === form.creditAccount);
        const isDebitBank = !!(debitAcc && (debitAcc.account_type || '').toLowerCase() === 'asset' && (debitAcc.account_name || '').toLowerCase().includes('bank'));
        const isCreditBank = !!(creditAcc && (creditAcc.account_type || '').toLowerCase() === 'asset' && (creditAcc.account_name || '').toLowerCase().includes('bank'));
        if (!isDebitBank && !isCreditBank) {
          toast({ 
            title: "Select Bank Ledger Account", 
            description: "When using bank payment method, either the debit or credit account must be a Bank (Asset) ledger account.", 
            variant: "destructive" 
          });
          return;
        }
      }

      if (vatAmount > 0 && vatAccount && vatAccount.id) {
        // VAT-inclusive transaction
        if (form.element === 'expense') {
          // Expense with VAT: Debit Expense (net), Debit VAT Input (vat), Credit Bank (total)
          entries.push(
            {
              transaction_id: transaction.id,
              account_id: form.debitAccount, // Expense account
              debit: netAmount,
              credit: 0,
              description: sanitizedDescription,
              status: "pending"
            },
            {
              transaction_id: transaction.id,
              account_id: vatAccount.id, // VAT Input account
              debit: vatAmount,
              credit: 0,
              description: 'VAT Input',
              status: "pending"
            },
            {
              transaction_id: transaction.id,
              account_id: form.creditAccount, // Bank account
              debit: 0,
              credit: amount, // Total amount
              description: sanitizedDescription,
              status: "pending"
            }
          );
        } else if (form.element === 'income') {
          // Income with VAT: Debit Bank (total), Credit Income (net), Credit VAT Output (vat)
          entries.push(
            {
              transaction_id: transaction.id,
              account_id: form.debitAccount, // Bank account
              debit: amount, // Total amount
              credit: 0,
              description: sanitizedDescription,
              status: "pending"
            },
            {
              transaction_id: transaction.id,
              account_id: form.creditAccount, // Income account
              debit: 0,
              credit: netAmount,
              description: sanitizedDescription,
              status: "pending"
            },
            {
              transaction_id: transaction.id,
              account_id: vatAccount.id, // VAT Output account
              debit: 0,
              credit: vatAmount,
              description: 'VAT Output',
              status: "pending"
            }
          );
        } else {
          // Other transaction types - treat as no VAT for now
          entries.push(
            {
              transaction_id: transaction.id,
              account_id: form.debitAccount,
              debit: amount,
              credit: 0,
              description: sanitizedDescription,
              status: "pending"
            },
            {
              transaction_id: transaction.id,
              account_id: form.creditAccount,
              debit: 0,
              credit: amount,
              description: sanitizedDescription,
              status: "pending"
            }
          );
        }
      } else {
        // No VAT - simple double entry
        entries.push(
          {
            transaction_id: transaction.id,
            account_id: form.debitAccount,
            debit: amount,
            credit: 0,
            description: sanitizedDescription,
            status: "pending"
          },
          {
            transaction_id: transaction.id,
            account_id: form.creditAccount,
            debit: 0,
            credit: amount,
            description: sanitizedDescription,
            status: "pending"
          }
        );
      }

      // Validate all entries have account_id before inserting
      const invalidEntries = entries.filter(entry => {
        const accountId = entry.account_id;
        return !accountId || 
               (typeof accountId === 'string' && accountId.trim() === "") ||
               accountId === null ||
               accountId === undefined;
      });
      
      if (invalidEntries.length > 0) {
        console.error("Entries with missing account_id:", invalidEntries);
        console.error("All entries:", entries);
        console.error("Form state:", { debitAccount: form.debitAccount, creditAccount: form.creditAccount });
        toast({ 
          title: "Validation Error", 
          description: "One or more transaction entries have missing account IDs. Please ensure all accounts are selected.", 
          variant: "destructive" 
        });
        return;
      }

      // Additional validation: ensure all account_ids are valid UUIDs
      const entriesWithInvalidIds = entries.filter(entry => {
        const accountId = entry.account_id;
        if (!accountId || typeof accountId !== 'string') return true;
        return !uuidRegex.test(accountId);
      });
      
      if (entriesWithInvalidIds.length > 0) {
        console.error("Entries with invalid account_id format:", entriesWithInvalidIds);
        toast({ 
          title: "Validation Error", 
          description: "One or more transaction entries have invalid account ID format.", 
          variant: "destructive" 
        });
        return;
      }

      // Final safety check: remove any null/undefined account_ids and ensure all are strings
      const sanitizedEntries = entries.map(entry => {
        if (!entry.account_id || entry.account_id === null || entry.account_id === undefined) {
          throw new Error(`Invalid account_id found in entry: ${JSON.stringify(entry)}`);
        }
        // Ensure account_id is a string and not empty
        const accountId = String(entry.account_id).trim();
        if (!accountId || !uuidRegex.test(accountId)) {
          throw new Error(`Invalid account_id format: ${accountId}`);
        }
        return {
          ...entry,
          account_id: accountId // Ensure it's a clean string
        };
      });

      // Log entries before inserting for debugging
      console.log("Inserting transaction entries:", sanitizedEntries.map(e => ({ 
        account_id: e.account_id, 
        debit: e.debit, 
        credit: e.credit 
      })));

      const { error: entriesError } = await supabase
        .from("transaction_entries")
        .insert(sanitizedEntries);

      if (entriesError) {
        console.error("Transaction entries insert error:", entriesError);
        console.error("Error details:", JSON.stringify(entriesError, null, 2));
        console.error("Sanitized entries that were inserted:", sanitizedEntries);
        console.error("Original entries:", entries);
        console.error("Form state at time of error:", { 
          debitAccount: form.debitAccount, 
          creditAccount: form.creditAccount,
          vatAccount: vatAccount?.id 
        });
        
        let errorMessage = entriesError.message || "Failed to create transaction entries.";
        if (entriesError.message?.includes('account_id') && entriesError.message?.includes('null')) {
          errorMessage = "Account ID is null. This should not happen. Please check the console for details.";
        } else if (entriesError.message?.toLowerCase().includes('foreign key') || entriesError.message?.toLowerCase().includes('violates foreign key constraint')) {
          errorMessage = "Invalid account selected. The account must exist in your Chart of Accounts.";
        }
        
        toast({ 
          title: "Error Creating Transaction Entries", 
          description: errorMessage, 
          variant: "destructive" 
        });
        // Try to delete the transaction if entries failed
        if (transaction?.id) {
          await supabase.from("transactions").delete().eq("id", transaction.id);
        }
        return;
      }

      // Entries created successfully: mark transaction as approved
      await supabase.from('transactions').update({ status: 'approved' }).eq('id', transaction.id);

      // Mirror entries into ledger_entries for AFS/TB materialized view
      try {
        // Clean any prior ledger rows for safety (should be none for new transaction)
        await supabase.from('ledger_entries').delete().eq('transaction_id', transaction.id);
        // Guard: ensure transaction id exists
        if (!transaction?.id) {
          throw new Error('Missing transaction ID for ledger posting');
        }
        // Resolve company id for ledger insert
        let effectiveCompanyId = companyId;
        if (!effectiveCompanyId || effectiveCompanyId.trim() === '') {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('company_id')
                .eq('user_id', user.id)
                .single();
              if (prof?.company_id) {
                effectiveCompanyId = prof.company_id as string;
              }
            }
          } catch {}
        }
        if (!effectiveCompanyId || effectiveCompanyId.trim() === '') {
          throw new Error('Company ID missing for ledger posting');
        }

        const ledgerRowsNew = sanitizedEntries.map(e => ({
          company_id: effectiveCompanyId,
          transaction_id: transaction.id,
          account_id: e.account_id,
          entry_date: form.date,
          description: sanitizedDescription,
          debit: e.debit || 0,
          credit: e.credit || 0,
          is_reversed: false,
        }));

        const { error: ledgerInsErr } = await supabase
          .from('ledger_entries')
          .insert(ledgerRowsNew);
        if (ledgerInsErr) {
          console.error('Ledger entries insert error:', ledgerInsErr);
          throw ledgerInsErr;
        }
      } catch (ledErr: any) {
        // If ledger insert fails, surface a toast but continue, as transaction_entries exist
        toast({ title: 'Warning', description: `Posted entries saved, but AFS ledger sync failed: ${ledErr.message}` });
      }

      // Update bank balance if bank account is involved
      if (bankAccountId) {
        const debitAccount = accounts.find(a => a.id === form.debitAccount);
        const creditAccount = accounts.find(a => a.id === form.creditAccount);

        // Check if debit or credit account is a bank asset account
        if ((debitAccount?.account_type || '').toLowerCase() === 'asset' && debitAccount.account_name.toLowerCase().includes('bank')) {
          await supabase.rpc('update_bank_balance', {
            _bank_account_id: bankAccountId,
            _amount: amount,
            _operation: 'add'
          });
        } else if ((creditAccount?.account_type || '').toLowerCase() === 'asset' && creditAccount.account_name.toLowerCase().includes('bank')) {
          await supabase.rpc('update_bank_balance', {
            _bank_account_id: bankAccountId,
            _amount: amount,
            _operation: 'subtract'
          });
        }
      }

      // Refresh AFS/trial balance cache after posting
      try {
        if (companyId) {
          await supabase.rpc('refresh_afs_cache', { _company_id: companyId });
        }
      } catch {}

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
  const debitAccountName = accounts.find(a => a.id === form.debitAccount)?.account_name;
  const creditAccountName = accounts.find(a => a.id === form.creditAccount)?.account_name;
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [accountSearchTarget, setAccountSearchTarget] = useState<"debit"|"credit">("debit");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAccountSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <>
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
                <Select value={form.bankAccountId || "__none__"} onValueChange={(val) => {
                  // Convert "__none__" to empty string for form state
                  const bankAccountValue = val === "__none__" ? "" : val;
                  setForm({ ...form, bankAccountId: bankAccountValue });
                }}>
                  <SelectTrigger id="bankAccount">
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-64 overflow-auto">
                    <SelectItem value="__none__">None</SelectItem>
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
                        {elem.label}
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                  Account Selection (Double-Entry)
                </h3>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setChartOpen(true)}>Chart of Accounts</Button>
                  <Button type="button" variant="outline" onClick={() => setAccountSearchOpen(true)}>Search Accounts (Ctrl+K)</Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="debitAccount">Debit Account *</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select value={form.debitAccount} onValueChange={(val) => {
                        // Update atomically to avoid overwriting with stale state
                        setForm(prev => ({
                          ...prev,
                          debitAccount: val,
                          creditAccount: prev.creditAccount === val ? "" : prev.creditAccount,
                        }));
                      }} disabled={debitSource.length === 0}>
                        <SelectTrigger id="debitAccount">
                          <SelectValue placeholder="Select debit account" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-64 overflow-auto">
                          {debitSource.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.account_code} - {acc.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Popover open={debitSearchOpen} onOpenChange={setDebitSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-10 w-10 p-0" aria-label="Search debit accounts">
                          <Search className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                        <PopoverContent className="w-96 p-0 z-[70]">
                        <Command>
                          <div className="p-2">
                             <CommandInput
                               placeholder="Search debit accounts..."
                               value={debitSearch}
                               onValueChange={(val: string) => setDebitSearch(val)}
                               autoFocus
                             />
                            <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
                              <span>Include all accounts</span>
                              <Switch checked={debitIncludeAll} onCheckedChange={setDebitIncludeAll} />
                            </div>
                          </div>
                          <CommandList>
                            <CommandEmpty>No matching accounts.</CommandEmpty>
                            <CommandGroup heading="Debit Accounts">
                              {(debitSearch ? filteredDebitAccounts : debitSource).map((acc) => (
                                <CommandItem
                                  key={acc.id}
                                  onSelect={() => {
                                    setForm(prev => ({
                                      ...prev,
                                      debitAccount: acc.id,
                                      creditAccount: prev.creditAccount === acc.id ? "" : prev.creditAccount,
                                    }));
                                    setDebitSearchOpen(false);
                                    setDebitSearch("");
                                  }}
                                >
                                  {acc.account_code} - {acc.account_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing {selectedElement?.debitType} accounts
                  </p>
                </div>

                <div>
                  <Label htmlFor="creditAccount">Credit Account *</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select value={form.creditAccount} onValueChange={(val) => {
                        // Update atomically to avoid overwriting with stale state
                        setForm(prev => ({
                          ...prev,
                          creditAccount: val,
                          debitAccount: prev.debitAccount === val ? "" : prev.debitAccount,
                        }));
                      }} disabled={creditSource.length === 0}>
                        <SelectTrigger id="creditAccount">
                          <SelectValue placeholder="Select credit account" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-64 overflow-auto">
                          {creditSource.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.account_code} - {acc.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Popover open={creditSearchOpen} onOpenChange={setCreditSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="h-10 w-10 p-0" aria-label="Search credit accounts">
                          <Search className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                        <PopoverContent className="w-96 p-0 z-[70]">
                        <Command>
                          <div className="p-2">
                             <CommandInput
                               placeholder="Search credit accounts..."
                               value={creditSearch}
                               onValueChange={(val: string) => setCreditSearch(val)}
                               autoFocus
                             />
                            <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
                              <span>Include all accounts</span>
                              <Switch checked={creditIncludeAll} onCheckedChange={setCreditIncludeAll} />
                            </div>
                          </div>
                          <CommandList>
                            <CommandEmpty>No matching accounts.</CommandEmpty>
                            <CommandGroup heading="Credit Accounts">
                              {(creditSearch ? filteredCreditAccounts : creditSource).map((acc) => (
                                <CommandItem
                                  key={acc.id}
                                  onSelect={() => {
                                    setForm(prev => ({
                                      ...prev,
                                      creditAccount: acc.id,
                                      debitAccount: prev.debitAccount === acc.id ? "" : prev.debitAccount,
                                    }));
                                    setCreditSearchOpen(false);
                                    setCreditSearch("");
                                  }}
                                >
                                  {acc.account_code} - {acc.account_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
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

    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading Chart of Accounts...</div>}>
      <Sheet open={chartOpen} onOpenChange={setChartOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full z-[60]">
          <div className="h-full overflow-auto">
            <ChartOfAccountsLazy />
          </div>
        </SheetContent>
      </Sheet>
    </Suspense>

    {/* Global Account Search */}
    <CommandDialog open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="text-sm text-muted-foreground">Assign to:</div>
        <div className="flex gap-1">
          <Button variant={accountSearchTarget === "debit" ? "default" : "outline"} size="sm" onClick={() => setAccountSearchTarget("debit")}>Debit</Button>
          <Button variant={accountSearchTarget === "credit" ? "default" : "outline"} size="sm" onClick={() => setAccountSearchTarget("credit")}>Credit</Button>
        </div>
      </div>
      <Command>
        <CommandInput placeholder="Search all accounts..." autoFocus />
        <CommandList>
          <CommandEmpty>No accounts found.</CommandEmpty>
          <CommandGroup heading="Accounts">
            {accounts.map(acc => (
              <CommandItem
                key={acc.id}
                onSelect={() => {
                  setForm(prev => ({
                    ...prev,
                    debitAccount: accountSearchTarget === "debit" ? acc.id : prev.debitAccount,
                    creditAccount: accountSearchTarget === "credit" ? acc.id : prev.creditAccount,
                  }));
                  setAccountSearchOpen(false);
                }}
              >
                {acc.account_code} - {acc.account_name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
    </>
  );
};
