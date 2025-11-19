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
import { toast as notify } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Sparkles, TrendingUp, TrendingDown, Info, Search } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandDialog } from "@/components/ui/command";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";

// Loan calculation function
const calculateMonthlyRepayment = (principal: number, monthlyRate: number, termMonths: number): number => {
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
};

// Calculate loan payment amount based on installment
const calculateLoanPaymentAmount = (loan: any, installmentNumber: number): number => {
  if (!loan || !loan.monthly_repayment) return 0;
  
  // For now, return the monthly repayment amount
  // In a more sophisticated system, this could calculate principal/interest split
  return loan.monthly_repayment;
};

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
  prefill?: any;
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
    value: "receipt", 
    label: "Receivable Collection", 
    debitType: 'asset', 
    creditTypes: ['asset'],
    description: "Collect receivable (Dr Bank / Cr Accounts Receivable)"
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
  },
  { 
    value: "loan_received", 
    label: "Loan Received", 
    icon: TrendingUp, 
    debitType: 'asset', 
    creditTypes: ['liability'],
    description: "Receive loan from bank (Dr Bank / Cr Loan Payable)"
  },
  { 
    value: "loan_repayment", 
    label: "Loan Repayment", 
    icon: TrendingDown, 
    debitType: 'liability', 
    creditTypes: ['asset'],
    description: "Repay loan principal (Dr Loan Payable / Cr Bank)"
  },
  { 
    value: "loan_interest", 
    label: "Loan Interest", 
    icon: TrendingDown, 
    debitType: 'expense', 
    creditTypes: ['asset'],
    description: "Pay loan interest (Dr Interest Expense / Cr Bank)"
  }
  ,{
    value: "depreciation",
    label: "Depreciation",
    icon: TrendingDown,
    debitType: 'expense',
    creditTypes: ['asset'],
    description: "Post monthly depreciation (Dr Depreciation Expense / Cr Accumulated Depreciation)"
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

export const TransactionFormEnhanced = ({ open, onOpenChange, onSuccess, editData, prefill }: TransactionFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loans, setLoans] = useState<Array<{ id: string; reference: string; outstanding_balance: number; status: string; loan_type: string; interest_rate: number }>>([]);
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
  const [lockAccounts, setLockAccounts] = useState(false);
  const [lockType, setLockType] = useState<string | null>(null);
  const [fixedAssets, setFixedAssets] = useState<Array<{ id: string; description: string; cost: number; purchase_date: string; useful_life_years: number; accumulated_depreciation?: number }>>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [assetUsefulLifeYears, setAssetUsefulLifeYears] = useState<string>("5");
  
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
    vatRate: "0",
    loanId: "",
    interestRate: "",
    loanTerm: "",
    loanTermType: "short",
    installmentNumber: ""
  });

  useEffect(() => {
    if (open && prefill) {
      setForm(prev => ({ ...prev, ...prefill }));
    }
  }, [open, prefill]);
  const [depreciationMethod, setDepreciationMethod] = useState<string>("straight_line");

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
        vatRate: "0",
        loanId: "",
        interestRate: "",
        loanTerm: "",
        loanTermType: "short",
        installmentNumber: ""
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
        paymentMethod: editData.payment_method || prev.paymentMethod,
        debitAccount: editData.debit_account_id || prev.debitAccount,
        creditAccount: editData.credit_account_id || prev.creditAccount,
        amount: String(Math.abs(editData.total_amount || 0)),
        vatRate: editData.vat_rate ? String(editData.vat_rate) : "0",
        loanTermType: prev.loanTermType
      }));
      setLockAccounts(Boolean(editData.lockType));
      setLockType(String(editData.lockType || ''));
    } catch {}
  }, [open, editData]);

  useEffect(() => {
    if (form.element === 'loan_interest') {
      if (!form.loanId) return;
      const loan = loans.find(l => l.id === form.loanId);
      if (!loan) return;
      const rate = Number(loan.interest_rate || 0);
      const bal = Number(loan.outstanding_balance || 0);
      const monthlyInterest = bal * (rate / 12);
      if (monthlyInterest > 0) {
        setForm(prev => ({ ...prev, amount: String(monthlyInterest.toFixed(2)) }));
      }
    } else if (form.element === 'depreciation') {
      if (!selectedAssetId) return;
      const asset = fixedAssets.find(a => a.id === selectedAssetId);
      if (!asset) return;
      const annual = Number(asset.cost || 0) / Number(asset.useful_life_years || 1);
      const monthly = annual / 12;
      if (monthly > 0) {
        setForm(prev => ({ ...prev, amount: String(monthly.toFixed(2)), description: `Depreciation - ${asset.description}` }));
      }
    }
  }, [form.element, form.loanId, loans, selectedAssetId, fixedAssets]);

  // Ensure locked flows always have required accounts set once accounts are loaded
  useEffect(() => {
    if (!open || !lockAccounts || accounts.length === 0) return;
    const lower = accounts.map(a => ({
      ...a,
      account_type: (a.account_type || '').toLowerCase(),
      account_name: (a.account_name || '').toLowerCase(),
      account_code: (a.account_code || '').toString(),
    }));
    const pick = (type: string, codes: string[], names: string[]) => {
      const byCode = lower.find(a => codes.includes(a.account_code) && a.account_type === type.toLowerCase());
      if (byCode) return byCode.id;
      const byName = lower.find(a => a.account_type === type.toLowerCase() && names.some(n => a.account_name.includes(n)));
      if (byName) return byName.id;
      const byType = lower.find(a => a.account_type === type.toLowerCase());
      return byType?.id || '';
    };
    if (lockType === 'sent') {
      const arId = form.debitAccount || pick('asset', ['1200'], ['receiv','debtors','accounts receiv']);
      const revId = form.creditAccount || pick('income', ['4000'], ['sales revenue','revenue','sales','income']);
      setForm(prev => ({ ...prev, debitAccount: arId, creditAccount: revId }));
    } else if (lockType === 'paid') {
      const bankId = form.debitAccount || pick('asset', ['1100'], ['bank','cash']);
      const arId = form.creditAccount || pick('asset', ['1200'], ['receiv','debtors','accounts receiv']);
      setForm(prev => ({ ...prev, debitAccount: bankId, creditAccount: arId }));
    }
  }, [open, lockAccounts, lockType, accounts]);

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
    if (!lockAccounts) {
      autoSelectAccounts(config, debits, credits);
    }

    // Fallback defaults: if not selected yet, choose the first available
    if (!lockAccounts) {
      setForm(prev => ({
        ...prev,
        debitAccount: prev.debitAccount || (debits[0]?.id || ""),
        creditAccount: prev.creditAccount || (credits[0]?.id || ""),
      }));
    }
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

      const { data: assetsData } = await supabase
        .from("fixed_assets")
        .select("id, description, cost, purchase_date, useful_life_years, accumulated_depreciation")
        .eq("company_id", profile.company_id)
        .order("purchase_date", { ascending: false });
      setFixedAssets(assetsData || []);

      // Load active loans for loan transactions
      const { data: loansData } = await supabase
        .from("loans")
        .select("id, reference, outstanding_balance, status, loan_type, interest_rate")
        .eq("company_id", profile.company_id)
        .eq("status", "active")
        .order("reference");
      setLoans(loansData || []);

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

      if (lockAccounts && accts && accts.length > 0) {
        const lower = accts.map(a => ({
          ...a,
          account_type: (a.account_type || '').toLowerCase(),
          account_name: (a.account_name || '').toLowerCase(),
          account_code: (a.account_code || '').toString(),
        }));
        const pick = (type: string, codes: string[], names: string[]) => {
          const byCode = lower.find(a => codes.includes(a.account_code) && a.account_type === type.toLowerCase());
          if (byCode) return byCode.id;
          const byName = lower.find(a => a.account_type === type.toLowerCase() && names.some(n => a.account_name.includes(n)));
          if (byName) return byName.id;
          const byType = lower.find(a => a.account_type === type.toLowerCase());
          return byType?.id || '';
        };
        if (lockType === 'sent') {
          const arId = form.debitAccount || pick('asset', ['1200'], ['receiv','debtors','accounts receiv']);
          const revId = form.creditAccount || pick('income', ['4000'], ['revenue','sales','income']);
          setForm(prev => ({ ...prev, debitAccount: arId, creditAccount: revId }));
        } else if (lockType === 'paid') {
          const bankId = form.debitAccount || pick('asset', ['1100'], ['bank','cash']);
          const arId = form.creditAccount || pick('asset', ['1200'], ['receiv','debtors','accounts receiv']);
          setForm(prev => ({ ...prev, debitAccount: bankId, creditAccount: arId }));
        }
      }
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
      if (form.element === 'loan_received') {
        const bankAccount = debits.find(acc => 
          acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank')
        );
        const preferredCode = form.loanTermType === 'long' ? '2400' : '2300';
        let loanPayable = credits.find(acc => acc.account_type === 'liability' && acc.account_code === preferredCode);
        if (!loanPayable) {
          loanPayable = credits.find(acc => acc.account_type === 'liability' && (acc.account_code === '2300' || acc.account_code === '2400'));
        }
        if (bankAccount) {
          setForm(prev => ({ ...prev, debitAccount: bankAccount.id }));
        }
        if (loanPayable) {
          setForm(prev => ({ ...prev, creditAccount: loanPayable.id }));
        }
      } else if (form.element === 'loan_repayment') {
        // Loan repayment: Auto-select loan payable for debit, bank for credit
        const loanPayable = debits.find(acc => 
          acc.account_type === 'liability' && (acc.account_code === '2300' || acc.account_code === '2400')
        );
        const bankAccount = credits.find(acc => 
          acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank')
        );
        if (loanPayable) {
          setForm(prev => ({ ...prev, debitAccount: loanPayable.id }));
        }
        if (bankAccount) {
          setForm(prev => ({ ...prev, creditAccount: bankAccount.id }));
        }
      } else if (form.element === 'loan_interest') {
        // Loan interest: Auto-select interest expense for debit, bank for credit
        const interestExpense = debits.find(acc => 
          acc.account_type === 'expense' && acc.account_name.toLowerCase().includes('interest')
        );
        const bankAccount = credits.find(acc => 
          acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank')
        );
        if (interestExpense) {
          setForm(prev => ({ ...prev, debitAccount: interestExpense.id }));
        }
        if (bankAccount) {
          setForm(prev => ({ ...prev, creditAccount: bankAccount.id }));
        }
      } else if (form.element === 'expense' || form.element === 'asset' || form.element === 'liability') {
        // For expenses, assets, and liabilities: Credit side (payment from)
        const creditAccount = credits.find(acc => 
          keywords.some(kw => (acc.account_name || '').toLowerCase().includes(kw.trim()))
        );
        if (creditAccount) {
          setForm(prev => ({ ...prev, creditAccount: creditAccount.id }));
        }
      } else if (form.element === 'income' || form.element === 'equity') {
        const debitAccount = debits.find(acc => 
          keywords.some(kw => (acc.account_name || '').toLowerCase().includes(kw.trim()))
        );
        if (debitAccount) {
          setForm(prev => ({ ...prev, debitAccount: debitAccount.id }));
        }
      } else if (form.element === 'depreciation') {
        const depExp = debits.find(acc => acc.account_type === 'expense' && acc.account_name.toLowerCase().includes('depreciation')) || debits.find(acc => acc.account_type === 'expense' && acc.account_name.toLowerCase().includes('asset'));
        const accDep = credits.find(acc => acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('accumulated')) || credits.find(acc => acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('depreciation'));
        if (depExp) {
          setForm(prev => ({ ...prev, debitAccount: depExp.id }));
        }
        if (accDep) {
          setForm(prev => ({ ...prev, creditAccount: accDep.id }));
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
      if (editData && editData.id) {
        // Guard: ensure we have a valid transaction id to post against
        if (!editData.id) {
          toast({ 
            title: "Missing transaction ID", 
            description: "Cannot post ledger entries without a valid transaction.", 
            variant: "destructive" 
          });
          return;
        }
        
        // Calculate VAT amounts for edit path (similar to create path)
        const amountNum = parseFloat(form.amount || "0");
        const isLoan = !!(form.element && form.element.startsWith('loan_'));
        const vatRate = isLoan ? 0 : parseFloat(form.vatRate);
        const vatAmount = vatRate > 0 ? (amountNum * vatRate) / (100 + vatRate) : 0; // VAT from inclusive amount
        const netAmount = amountNum - vatAmount;
        
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
            vat_rate: vatRate > 0 ? vatRate : null,
            vat_amount: vatAmount > 0 ? vatAmount : null,
            base_amount: netAmount,
            vat_inclusive: vatRate > 0,
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
        // Create VAT-aware entries for edit path (similar to create path)
        let entries: any[] = [];
        
        if (vatAmount > 0 && vatAccount && vatAccount.id) {
          // VAT-inclusive transaction
          if (form.element === 'expense') {
            // Expense with VAT: Debit Expense (net), Debit VAT Input (vat), Credit Bank (total)
            entries.push(
              {
                transaction_id: editData.id,
                account_id: form.debitAccount, // Expense account
                debit: netAmount,
                credit: 0,
                description: sanitizedDescription,
                status: "approved"
              },
              {
                transaction_id: editData.id,
                account_id: vatAccount.id, // VAT Input account
                debit: vatAmount,
                credit: 0,
                description: 'VAT Input',
                status: "approved"
              },
              {
                transaction_id: editData.id,
                account_id: form.creditAccount, // Bank account
                debit: 0,
                credit: amountAbs, // Total amount
                description: sanitizedDescription,
                status: "approved"
              }
            );
          } else if (form.element === 'income') {
            // Income with VAT: Debit Bank (total), Credit Income (net), Credit VAT Output (vat)
            entries.push(
              {
                transaction_id: editData.id,
                account_id: form.debitAccount, // Bank account
                debit: amountAbs, // Total amount
                credit: 0,
                description: sanitizedDescription,
                status: "approved"
              },
              {
                transaction_id: editData.id,
                account_id: form.creditAccount, // Income account
                debit: 0,
                credit: netAmount,
                description: sanitizedDescription,
                status: "approved"
              },
              {
                transaction_id: editData.id,
                account_id: vatAccount.id, // VAT Output account
                debit: 0,
                credit: vatAmount,
                description: 'VAT Output',
                status: "approved"
              }
            );
          } else {
            // Other transaction types - treat as no VAT for now
            entries.push(
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
            );
          }
        } else {
          // No VAT - simple double entry
          entries.push(
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
          );
        }

        const { error: entriesErr } = await supabase
          .from("transaction_entries")
          .insert(entries);
        if (entriesErr) throw entriesErr;

        // Also insert into ledger_entries so AFS/Trial Balance sees the amounts (VAT-aware)
        let ledgerRows: any[] = [];
        
        if (vatAmount > 0 && vatAccount && vatAccount.id) {
          // VAT-inclusive ledger entries
          if (form.element === 'expense') {
            // Expense with VAT: Debit Expense (net), Debit VAT Input (vat), Credit Bank (total)
            ledgerRows.push(
              {
                company_id: effectiveCompanyId,
                transaction_id: editData.id,
                account_id: form.debitAccount, // Expense account
                entry_date: form.date,
                description: sanitizedDescription,
                debit: netAmount,
                credit: 0,
                is_reversed: false,
              },
              {
                company_id: effectiveCompanyId,
                transaction_id: editData.id,
                account_id: vatAccount.id, // VAT Input account
                entry_date: form.date,
                description: 'VAT Input',
                debit: vatAmount,
                credit: 0,
                is_reversed: false,
              },
              {
                company_id: effectiveCompanyId,
                transaction_id: editData.id,
                account_id: form.creditAccount, // Bank account
                entry_date: form.date,
                description: sanitizedDescription,
                debit: 0,
                credit: amountAbs, // Total amount
                is_reversed: false,
              }
            );
          } else if (form.element === 'income') {
            // Income with VAT: Debit Bank (total), Credit Income (net), Credit VAT Output (vat)
            ledgerRows.push(
              {
                company_id: effectiveCompanyId,
                transaction_id: editData.id,
                account_id: form.debitAccount, // Bank account
                entry_date: form.date,
                description: sanitizedDescription,
                debit: amountAbs, // Total amount
                credit: 0,
                is_reversed: false,
              },
              {
                company_id: effectiveCompanyId,
                transaction_id: editData.id,
                account_id: form.creditAccount, // Income account
                entry_date: form.date,
                description: sanitizedDescription,
                debit: 0,
                credit: netAmount,
                is_reversed: false,
              },
              {
                company_id: effectiveCompanyId,
                transaction_id: editData.id,
                account_id: vatAccount.id, // VAT Output account
                entry_date: form.date,
                description: 'VAT Output',
                debit: 0,
                credit: vatAmount,
                is_reversed: false,
              }
            );
          } else {
            // Other transaction types - treat as no VAT for now
            ledgerRows.push(
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
            );
          }
        } else {
          // No VAT - simple double entry
          ledgerRows.push(
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
          );
        }

        const { error: ledgerErr } = await supabase
          .from("ledger_entries")
          .insert(ledgerRows as any);
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
      if (form.paymentMethod === 'bank' && form.element !== 'depreciation' && !bankAccountId) {
        toast({ 
          title: "Bank Account Required", 
          description: "For bank payments/receipts, please select a valid bank account.", 
          variant: "destructive" 
        });
        return;
      }

      // Validate asset purchase: require debit account to be a Fixed Asset ledger
      if (form.element === 'asset') {
        const debitAcc = accounts.find(a => a.id === form.debitAccount);
        const isAssetType = (debitAcc?.account_type || '').toLowerCase() === 'asset';
        const name = (debitAcc?.account_name || '').toLowerCase();
        const code = String((debitAcc as any)?.account_code || '');
        const looksFixedAsset = name.includes('fixed asset') || code.startsWith('15');
        if (!isAssetType || !looksFixedAsset) {
          toast({ title: "Select Fixed Asset Ledger", description: "For Asset Purchase, the debit account must be a Fixed Asset ledger (e.g., 1500).", variant: "destructive" });
          return;
        }
      }

      const amount = parseFloat(form.amount);
      const isLoan = !!(form.element && form.element.startsWith('loan_'));
      const vatRate = (isLoan || form.element === 'depreciation') ? 0 : parseFloat(form.vatRate);
      const vatAmount = vatRate > 0 ? (amount * vatRate) / (100 + vatRate) : 0; // VAT from inclusive amount
      const netAmount = amount - vatAmount;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Sanitize inputs
      const sanitizedDescription = form.description.trim();
      const descriptionWithMethod = form.element === 'asset' ? `${sanitizedDescription} [method:${depreciationMethod}]` : sanitizedDescription;
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

      const { data: transaction, error: txError } = await supabase
        .from("transactions")
        .insert({
          company_id: companyId,
          user_id: user.id,
          transaction_date: form.date,
          description: descriptionWithMethod,
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

      // If payment method is bank, ensure one side is a bank Asset account (skip for depreciation)
      if (form.paymentMethod === 'bank' && form.element !== 'depreciation') {
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

      // Locked invoice flows: override element-specific VAT handling
      if (lockType === 'sent') {
        // Accrual issuance: Dr AR (total), Cr Revenue (net), Cr VAT Output (vat)
        if (vatAmount > 0 && vatAccount && vatAccount.id) {
          entries.push(
            { transaction_id: transaction.id, account_id: form.debitAccount, debit: amount, credit: 0, description: sanitizedDescription, status: 'pending' },
            { transaction_id: transaction.id, account_id: form.creditAccount, debit: 0, credit: netAmount, description: sanitizedDescription, status: 'pending' },
            { transaction_id: transaction.id, account_id: vatAccount.id, debit: 0, credit: vatAmount, description: 'VAT Output', status: 'pending' }
          );
        } else {
          entries.push(
            { transaction_id: transaction.id, account_id: form.debitAccount, debit: amount, credit: 0, description: sanitizedDescription, status: 'pending' },
            { transaction_id: transaction.id, account_id: form.creditAccount, debit: 0, credit: amount, description: sanitizedDescription, status: 'pending' }
          );
        }
      } else if (lockType === 'paid') {
        // Payment collection: Dr Bank (amount), Cr AR (amount) — no VAT
        entries.push(
          { transaction_id: transaction.id, account_id: form.debitAccount, debit: amount, credit: 0, description: sanitizedDescription, status: 'pending' },
          { transaction_id: transaction.id, account_id: form.creditAccount, debit: 0, credit: amount, description: sanitizedDescription, status: 'pending' }
        );
      } else if (vatAmount > 0 && vatAccount && vatAccount.id) {
        // General VAT-inclusive transaction (non-locked)
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

      console.log("Inserting transaction entries:", sanitizedEntries.map(e => ({ 
        account_id: e.account_id, 
        debit: e.debit, 
        credit: e.credit 
      })));

      const { error: entriesError } = await supabase
        .from("transaction_entries")
        .insert(sanitizedEntries.map(e => ({
          transaction_id: transaction.id,
          account_id: e.account_id,
          debit: e.debit,
          credit: e.credit,
          description: sanitizedDescription,
          status: "pending"
        })) as any);

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
          errorMessage = "Account ID is null.";
        } else if (entriesError.message?.toLowerCase().includes('foreign key') || entriesError.message?.toLowerCase().includes('violates foreign key constraint')) {
          errorMessage = "Invalid account selected.";
        }
        
        toast({ 
          title: "Error Creating Transaction Entries", 
          description: errorMessage, 
          variant: "destructive" 
        });
        if (transaction?.id) {
          await supabase.from("transactions").delete().eq("id", transaction.id);
        }
        return;
      }
      try {
        await supabase.from('ledger_entries').delete().eq('transaction_id', transaction.id);
        if (!transaction?.id) {
          throw new Error('Missing transaction ID for ledger posting');
        }
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
          .insert(ledgerRowsNew as any);
        if (ledgerInsErr) {
          console.error('Ledger entries insert error:', ledgerInsErr);
          throw ledgerInsErr;
        }
      } catch (ledErr: any) {
        notify.error("Ledger sync warning", { description: `Entries saved, but AFS sync failed: ${ledErr.message}`, duration: 6000 });
      }

      // Keep manual transactions at approved status; do not auto-set to posted
      

      // Handle loan-specific operations
      if (form.element === 'loan_received') {
        // Create a new loan record
        const interestRatePercent = form.interestRate && form.interestRate.trim() !== '' ? parseFloat(form.interestRate) : 0;
        const interestRateDecimal = interestRatePercent / 100;
        const termMonths = form.loanTerm && form.loanTerm.trim() !== '' ? parseInt(form.loanTerm) : 12;
        const monthlyRepayment = calculateMonthlyRepayment(amount, interestRateDecimal / 12, termMonths);

        const { error: loanError } = await supabase
          .from("loans")
          .insert({
            company_id: companyId,
            reference: form.reference || `LOAN-${Date.now()}`,
            loan_type: form.loanTermType,
            principal: amount,
            interest_rate: interestRateDecimal,
            start_date: form.date,
            term_months: termMonths,
            monthly_repayment: monthlyRepayment,
            status: 'active',
            outstanding_balance: amount
          });

        if (loanError) {
          console.error("Loan creation error:", loanError);
          toast({ 
            title: "Loan Creation Failed", 
            description: "Transaction was posted but loan record could not be created: " + loanError.message, 
            variant: "destructive" 
          });
        } else {
          toast({ 
            title: "Loan Created Successfully", 
            description: "New loan record created with monthly repayment of R " + monthlyRepayment.toFixed(2) 
          });
        }
      } else if (form.element === 'loan_repayment' && form.loanId) {
        // Update loan outstanding balance
        const { data: loanData } = await supabase
          .from("loans")
          .select("outstanding_balance")
          .eq("id", form.loanId)
          .single();

        if (loanData) {
          const newBalance = Math.max(0, loanData.outstanding_balance - amount);
          const { error: updateError } = await supabase
            .from("loans")
            .update({ 
              outstanding_balance: newBalance,
              status: newBalance === 0 ? 'completed' : 'active'
            })
            .eq("id", form.loanId);

          if (updateError) {
            console.error("Loan update error:", updateError);
          }
        }
      } else if (form.element === 'loan_interest' && form.loanId) {
        // Record loan interest payment
        const { error: interestError } = await supabase
          .from("loan_payments")
          .insert({
            loan_id: form.loanId,
            payment_date: form.date,
            amount: amount,
            principal_component: 0,
            interest_component: amount
          });

        if (interestError) {
          console.error("Interest payment recording error:", interestError);
        }
      }

      if (form.element === 'asset') {
        const costNum = parseFloat(form.amount || '0');
        if (costNum > 0) {
          await supabase.from('fixed_assets').insert({
            company_id: companyId,
            description: descriptionWithMethod,
            cost: costNum,
            purchase_date: form.date,
            useful_life_years: parseInt(assetUsefulLifeYears || '5'),
            accumulated_depreciation: 0,
            status: 'active'
          } as any);
        }
      } else if (form.element === 'depreciation' && selectedAssetId) {
        const asset = fixedAssets.find(a => a.id === selectedAssetId);
        const amt = parseFloat(form.amount || '0');
        if (asset && amt > 0) {
          await supabase
            .from('fixed_assets')
            .update({ accumulated_depreciation: Math.min((asset.accumulated_depreciation || 0) + amt, asset.cost) })
            .eq('id', asset.id);
        }
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

      notify.success("Transaction posted", { description: `Dr ${debitAccountName || 'Debit'} / Cr ${creditAccountName || 'Credit'} • ${form.date}`, duration: 6000 });

      // Auto-insert Fixed Asset when transaction represents asset acquisition
      try {
        const debitAcc = accounts.find(a => a.id === form.debitAccount);
        const isAssetType = (debitAcc?.account_type || '').toLowerCase() === 'asset';
        const name = (debitAcc?.account_name || '').toLowerCase();
        const code = String((debitAcc as any)?.account_code || '');
        const isFixedAssetDebit = isAssetType && (name.includes('fixed asset') || code.startsWith('15'));
        const isAssetTx = form.element === 'asset' || isFixedAssetDebit;
        if (isAssetTx) {
          // Resolve company id
          let effectiveCompanyId = companyId;
          if (!effectiveCompanyId || effectiveCompanyId.trim() === '') {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: prof } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).single();
              effectiveCompanyId = (prof as any)?.company_id || effectiveCompanyId;
            }
          }
          // Fixed asset record creation is handled earlier using descriptionWithMethod.
          // Avoid duplicate inserts here.
        }
      } catch {}
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      notify.error("Posting failed", { description: error.message, duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const selectedElement = ACCOUNTING_ELEMENTS.find(e => e.value === form.element);
  const debitAccountName = accounts.find(a => a.id === form.debitAccount)?.account_name;
  const creditAccountName = accounts.find(a => a.id === form.creditAccount)?.account_name;
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [accountSearchTarget, setAccountSearchTarget] = useState<"debit"|"credit">("debit");
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalIncludeAll, setGlobalIncludeAll] = useState(false);
  // Lock debit account for loans (user can only choose credit account - bank/accrual)
  const disableDebitSelection = form.element?.startsWith('loan_') || (lockAccounts && Boolean(form.debitAccount));
  const disableCreditSelection = form.element?.startsWith('loan_') ? false : (lockAccounts && Boolean(form.creditAccount));
  const disableAccountSelection = lockAccounts && Boolean(form.debitAccount) && Boolean(form.creditAccount);

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

  // Auto-calculate loan payment amount when loan is selected
  useEffect(() => {
    if (form.element === 'loan_repayment' && form.loanId) {
      const selectedLoan = loans.find(loan => loan.id === form.loanId);
      if (selectedLoan && selectedLoan.monthly_repayment) {
        const paymentAmount = calculateLoanPaymentAmount(selectedLoan, parseInt(form.installmentNumber) || 1);
        setForm(prev => ({ ...prev, amount: paymentAmount.toFixed(2) }));
      }
    }
  }, [form.element, form.loanId, form.installmentNumber, loans]);

  if (!open) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-visible">
          <div className="max-h-[90vh] overflow-y-auto">
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
              
              {form.element !== 'depreciation' && (
                <div>
                  <Label htmlFor="bankAccount">Bank Account (Optional)</Label>
                  <Select value={form.bankAccountId || "__none__"} onValueChange={(val) => {
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
              )}
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Textarea
                    id="description"
                    placeholder="Enter transaction description (e.g., 'Equipment purchase')"
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
                {form.element === 'asset' && (
                  <div>
                    <Label className="text-xs">Select Fixed Asset</Label>
                    <Select value={selectedAssetId} onValueChange={(val) => {
                      setSelectedAssetId(val);
                      const asset = fixedAssets.find(a => a.id === val);
                      if (asset?.description) setForm(prev => ({ ...prev, description: asset.description }));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {fixedAssets.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {form.element === 'asset' && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <Label>Depreciation Method</Label>
                    <Select value={depreciationMethod} onValueChange={setDepreciationMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight_line">Straight Line</SelectItem>
                        <SelectItem value="diminishing">Diminishing Balance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
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
                <Select value={form.element} onValueChange={(val) => setForm({ ...form, element: val, debitAccount: "", creditAccount: "", paymentMethod: val === 'depreciation' ? 'accrual' : form.paymentMethod, bankAccountId: val === 'depreciation' ? '' : form.bankAccountId })} disabled={lockAccounts}>
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
              {form.element === 'asset' && (
                <div>
                  <Label htmlFor="assetUsefulLife">Useful Life (years)</Label>
                  <Input id="assetUsefulLife" type="number" min={1} value={assetUsefulLifeYears} onChange={(e) => setAssetUsefulLifeYears(e.target.value)} />
                </div>
              )}
              {form.element === 'depreciation' && (
                <div>
                  <Label>Select Asset *</Label>
                  <Select value={selectedAssetId} onValueChange={(val) => setSelectedAssetId(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {fixedAssets.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select value={form.paymentMethod} onValueChange={(val) => setForm({ ...form, paymentMethod: val })} disabled={lockAccounts || form.element === 'depreciation'}>
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

            {(form.element === 'loan_repayment' || form.element === 'loan_interest') && (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <Label>Select Loan *</Label>
                  <Select value={form.loanId} onValueChange={(val) => setForm({ ...form, loanId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {loans.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          No active loans found. Please create loans first.
                        </div>
                      ) : (
                        loans.map(loan => (
                          <SelectItem key={loan.id} value={loan.id}>
                            {loan.reference} - {loan.loan_type === 'long' ? 'Long-term' : 'Short-term'} - Outstanding: R {loan.outstanding_balance?.toFixed(2)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {form.element === 'loan_repayment' && (
                  <div>
                    <Label htmlFor="installmentNumber">Installment Number</Label>
                    <Input
                      id="installmentNumber"
                      type="number"
                      step="1"
                      min="1"
                      placeholder="e.g. 1"
                      value={form.installmentNumber}
                      onChange={(e) => setForm({ ...form, installmentNumber: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

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
                  <Button type="button" variant="outline" onClick={() => setChartOpen(true)} disabled={disableAccountSelection}>Chart of Accounts</Button>
                  <Button type="button" variant="outline" onClick={() => { setAccountSearchTarget("debit"); setAccountSearchOpen(true); }} disabled={disableAccountSelection}>Search Accounts (Ctrl+K)</Button>
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
                      }} disabled={disableDebitSelection || debitSource.length === 0}>
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
                        <Button type="button" variant="outline" className="h-10 w-10 p-0" aria-label="Search debit accounts" disabled={disableAccountSelection}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                        <PopoverContent className="w-96 p-0 z-[80]">
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
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-2"
                    onClick={() => { setAccountSearchTarget("debit"); setAccountSearchOpen(true); }}
                    disabled={disableAccountSelection}
                  >
                    Search
                  </Button>
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
                      }} disabled={disableCreditSelection || creditSource.length === 0}>
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
                        <Button type="button" variant="outline" className="h-10 w-10 p-0" aria-label="Search credit accounts" disabled={disableAccountSelection}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                        <PopoverContent className="w-96 p-0 z-[80]">
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
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="px-2"
                        onClick={() => { setAccountSearchTarget("credit"); setAccountSearchOpen(true); }}
                        disabled={disableAccountSelection}
                      >
                        Search
                      </Button>
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

          {/* Step 4: Amount & VAT / Interest (for loans) */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm">4</span>
              Amount & Tax
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Total Amount {form.element?.startsWith('loan_') || form.element === 'depreciation' ? '' : '(incl. VAT)'} *</Label>
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
              {form.element?.startsWith('loan_') ? (
                <div className="grid grid-cols-2 gap-4">
                  {form.element === 'loan_received' && (
                    <>
                      <div>
                        <Label htmlFor="interestRate">Interest Rate (%)</Label>
                        <Input
                          id="interestRate"
                          type="number"
                          step="0.01"
                          placeholder="e.g. 10"
                          value={form.interestRate}
                          onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="loanTerm">Term (months)</Label>
                        <Input
                          id="loanTerm"
                          type="number"
                          step="1"
                          placeholder="e.g. 12"
                          value={form.loanTerm}
                          onChange={(e) => setForm({ ...form, loanTerm: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="loanTermType">Loan Term Type</Label>
                        <Select value={form.loanTermType} onValueChange={(val) => setForm({ ...form, loanTermType: val })}>
                          <SelectTrigger id="loanTermType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="short">Short-term</SelectItem>
                            <SelectItem value="long">Long-term</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                form.element !== 'depreciation' && (
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
                )
              )}
            </div>

            {/* Summary */}
            {form.amount && parseFloat(form.amount) > 0 && (
              <div className="p-4 bg-background rounded-lg border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount {form.element?.startsWith('loan_') || form.element === 'depreciation' ? '' : '(incl. VAT)'}:</span>
                  <span className="font-mono">R {parseFloat(form.amount).toFixed(2)}</span>
                </div>
                {!form.element?.startsWith('loan_') && form.element !== 'depreciation' && (
                  <>
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
                  </>
                )}

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
          </div>
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
    <CommandDialog open={accountSearchOpen} onOpenChange={(o) => {
      setAccountSearchOpen(o);
      if (!o) { setGlobalSearch(""); }
    }}>
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="text-sm text-muted-foreground">Assign to:</div>
        <div className="flex gap-1">
          <Button variant={accountSearchTarget === "debit" ? "default" : "outline"} size="sm" onClick={() => setAccountSearchTarget("debit")}>Debit</Button>
          <Button variant={accountSearchTarget === "credit" ? "default" : "outline"} size="sm" onClick={() => setAccountSearchTarget("credit")}>Credit</Button>
        </div>
      </div>
      <Command>
        <div className="p-2">
          <CommandInput
            placeholder="Search accounts by code or name..."
            value={globalSearch}
            onValueChange={(val: string) => setGlobalSearch(val)}
            autoFocus
          />
          <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
            <span>Include all accounts</span>
            <Switch checked={globalIncludeAll} onCheckedChange={setGlobalIncludeAll} />
          </div>
        </div>
        <CommandList>
          <CommandEmpty>No accounts found.</CommandEmpty>
          <CommandGroup heading={accountSearchTarget === "debit" ? "Debit Accounts" : "Credit Accounts"}>
            {(() => {
              const source = accountSearchTarget === "debit"
                ? (globalIncludeAll ? accounts : debitSource)
                : (globalIncludeAll ? accounts : creditSource);
              const filtered = source.filter(a =>
                (a.account_name || '').toLowerCase().includes(globalSearch.toLowerCase()) ||
                (a.account_code || '').toLowerCase().includes(globalSearch.toLowerCase())
              );
              const list = globalSearch ? filtered : source;
              return list.map(acc => (
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
              ));
            })()}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
    </>
  );
};
