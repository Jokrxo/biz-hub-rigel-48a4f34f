import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Building2, AlertCircle } from "lucide-react";

// Loan calculation function
const calculateMonthlyRepayment = (principal: number, monthlyRate: number, termMonths: number): number => {
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
};

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
  { value: "equity", label: "Capital Contribution", icon: "💎", description: "Owner investment (Dr Bank / Cr Capital)" },
  { value: "loan_received", label: "Loan Received", icon: "🏦", description: "Receive loan from bank (Dr Bank / Cr Loan Payable)" },
  { value: "loan_repayment", label: "Loan Repayment", icon: "💵", description: "Repay loan principal (Dr Loan Payable / Cr Bank)" },
  { value: "loan_interest", label: "Loan Interest", icon: "📈", description: "Pay loan interest (Dr Interest Expense / Cr Bank)" }
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
  const [loans, setLoans] = useState<any[]>([]);
  
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    reference: "",
    bankAccount: "",
    transactionType: "",
    debitAccount: "",
    creditAccount: "",
    amount: "",
    vatRate: "0",
    loanId: "",
    interestRate: "",
    loanTerm: ""
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
        vatRate: editData.vat_rate ? String(editData.vat_rate) : "0",
        loanId: "",
        interestRate: "",
        loanTerm: ""
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

      // Load active loans for loan transactions
      const { data: loansData, error: loansError } = await supabase
        .from("loans")
        .select("id, reference, loan_type, outstanding_balance, status")
        .eq("company_id", profile.company_id)
        .eq("status", "active")
        .order("reference");

      if (loansError) throw loansError;

      setAccounts(accountsData || []);
      setDebitAccounts(accountsData || []);
      setCreditAccounts(accountsData || []);
      setBankAccounts(bankData || []);
      setLoans(loansData || []);

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
    setForm({ 
      ...form, 
      transactionType: txType, 
      debitAccount: "", 
      creditAccount: "",
      loanId: "",
      interestRate: "",
      loanTerm: ""
    });
    
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

      // Handle loan-specific account suggestions
      let debitSuggestions = [];
      let creditSuggestions = [];

      if (txType === 'loan_received') {
        // Loan received: Dr Bank, Cr Loan Payable
        const { data: bankAccounts } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("account_type", "asset")
          .like("account_name", "%bank%")
          .or("account_code.eq.1100"); // Default bank account

        const { data: loanPayable } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("account_type", "liability")
          .or("account_code.eq.2300,account_code.eq.2400"); // Short/long term loans

        debitSuggestions = bankAccounts || [];
        creditSuggestions = loanPayable || [];
      } else if (txType === 'loan_repayment') {
        // Loan repayment: Dr Loan Payable, Cr Bank
        const { data: loanPayable } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("account_type", "liability")
          .or("account_code.eq.2300,account_code.eq.2400"); // Short/long term loans

        const { data: bankAccounts } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("account_type", "asset")
          .like("account_name", "%bank%")
          .or("account_code.eq.1100"); // Default bank account

        debitSuggestions = loanPayable || [];
        creditSuggestions = bankAccounts || [];
      } else if (txType === 'loan_interest') {
        // Loan interest: Dr Interest Expense, Cr Bank
        const { data: interestExpense } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("account_type", "expense")
          .like("account_name", "%interest%");

        const { data: bankAccounts } = await supabase
          .from("chart_of_accounts")
          .select("id, account_code, account_name, account_type")
          .eq("company_id", profile.company_id)
          .eq("account_type", "asset")
          .like("account_name", "%bank%")
          .or("account_code.eq.1100"); // Default bank account

        debitSuggestions = interestExpense || [];
        creditSuggestions = bankAccounts || [];
      } else {
        // Use existing RPC for other transaction types
        const { data: debitData } = await supabase.rpc('get_account_suggestions', {
          _company_id: profile.company_id,
          _transaction_element: txType,
          _side: 'debit'
        });

        const { data: creditData } = await supabase.rpc('get_account_suggestions', {
          _company_id: profile.company_id,
          _transaction_element: txType,
          _side: 'credit'
        });

        debitSuggestions = debitData || [];
        creditSuggestions = creditData || [];
      }

      setDebitAccounts(debitSuggestions);
      setCreditAccounts(creditSuggestions);

      // Auto-select recommended accounts for loan transactions
      if (txType === 'loan_received') {
        // Auto-select first bank account for debit
        const firstBank = debitSuggestions.find(acc => acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank'));
        if (firstBank) {
          setForm(prev => ({ ...prev, debitAccount: firstBank.id }));
        }
        
        // Auto-select first loan payable account for credit
        const firstLoanPayable = creditSuggestions.find(acc => 
          acc.account_type === 'liability' && (acc.account_code === '2300' || acc.account_code === '2400')
        );
        if (firstLoanPayable) {
          setForm(prev => ({ ...prev, creditAccount: firstLoanPayable.id }));
        }
      } else if (txType === 'loan_repayment') {
        // Auto-select first loan payable account for debit
        const firstLoanPayable = debitSuggestions.find(acc => 
          acc.account_type === 'liability' && (acc.account_code === '2300' || acc.account_code === '2400')
        );
        if (firstLoanPayable) {
          setForm(prev => ({ ...prev, debitAccount: firstLoanPayable.id }));
        }
        
        // Auto-select first bank account for credit
        const firstBank = creditSuggestions.find(acc => acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank'));
        if (firstBank) {
          setForm(prev => ({ ...prev, creditAccount: firstBank.id }));
        }
      } else if (txType === 'loan_interest') {
        // Auto-select interest expense for debit
        const interestExpense = debitSuggestions.find(acc => 
          acc.account_type === 'expense' && acc.account_name.toLowerCase().includes('interest')
        );
        if (interestExpense) {
          setForm(prev => ({ ...prev, debitAccount: interestExpense.id }));
        }
        
        // Auto-select first bank account for credit
        const firstBank = creditSuggestions.find(acc => acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank'));
        if (firstBank) {
          setForm(prev => ({ ...prev, creditAccount: firstBank.id }));
        }
      }

      // Validate loan transactions have required accounts
      if (txType.startsWith('loan_') && (debitSuggestions.length === 0 || creditSuggestions.length === 0)) {
        toast({ 
          title: "Missing Loan Accounts", 
          description: `Please ensure you have the required accounts for loan transactions in Chart of Accounts.`,
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
      
      // Loan-specific validation
      if (form.transactionType.startsWith('loan_')) {
        if (!form.bankAccount || form.bankAccount === "__none__") {
          missingFields.push("Bank Account (required for loan transactions)");
        }
        
        if (form.transactionType === 'loan_repayment' && !form.loanId) {
          missingFields.push("Loan Selection (required for loan repayment)");
        }
        
        if (form.transactionType === 'loan_received' && !form.interestRate) {
          missingFields.push("Interest Rate (required for new loans)");
        }
        
        if (form.transactionType === 'loan_received' && !form.loanTerm) {
          missingFields.push("Loan Term (required for new loans)");
        }
      }
      
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
          vat_rate: parseFloat(form.vatRate) || null,
          vat_amount: vatAmount || null,
          base_amount: amount,
          vat_inclusive: (parseFloat(form.vatRate) || 0) > 0,
          status: "pending"
        })
        .select()
        .single();
      if (txError) {
        toast({ title: "Transaction failed", description: txError.message, variant: "destructive" });
        return;
      }

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
      // Ensure selected accounts exist in loaded Chart of Accounts
      const debitExistsInChart = accounts.some(a => a.id === form.debitAccount);
      const creditExistsInChart = accounts.some(a => a.id === form.creditAccount);
      if (!debitExistsInChart || !creditExistsInChart) {
        toast({
          title: "Invalid Account",
          description: "Selected accounts must exist in your Chart of Accounts.",
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

      // Ensure at least one side is a Bank (Asset) ledger when a bank account is involved
      if (bankAccountId) {
        const debitAcc = accounts.find(a => a.id === form.debitAccount);
        const creditAcc = accounts.find(a => a.id === form.creditAccount);
        const isDebitBank = !!(debitAcc && (debitAcc.account_type || '').toLowerCase().includes('asset') && (debitAcc.account_name || '').toLowerCase().includes('bank'));
        const isCreditBank = !!(creditAcc && (creditAcc.account_type || '').toLowerCase().includes('asset') && (creditAcc.account_name || '').toLowerCase().includes('bank'));
        if (!isDebitBank && !isCreditBank) {
          toast({ 
            title: "Select Bank Ledger Account", 
            description: "With a bank account selected, either the debit or credit must be a Bank (Asset) ledger account.", 
            variant: "destructive" 
          });
          return;
        }
      }

      const entries = [
        { account_id: form.debitAccount, debit: totalAmount, credit: 0, description: form.description.trim() },
        { account_id: form.creditAccount, debit: 0, credit: totalAmount, description: form.description.trim() }
      ];

      
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
        .insert(sanitizedEntries.map(e => ({
          transaction_id: transaction.id,
          account_id: e.account_id,
          debit: e.debit,
          credit: e.credit,
          description: form.description.trim(),
          status: "pending"
        })) as any);
      if (entriesError) {
        toast({ title: "Entries failed", description: entriesError.message, variant: "destructive" });
        return;
      }
      // Keep manual transactions at approved status; do not auto-set to posted

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

      // Handle loan-specific operations
      if (form.transactionType === 'loan_received') {
        // Create a new loan record
        const monthlyRepayment = calculateMonthlyRepayment(
          parseFloat(form.amount),
          parseFloat(form.interestRate) / 100 / 12, // Monthly rate
          parseInt(form.loanTerm)
        );

        const { error: loanError } = await supabase
          .from("loans")
          .insert({
            company_id: profile.company_id,
            reference: form.reference || `LOAN-${Date.now()}`,
            loan_type: parseInt(form.loanTerm) <= 12 ? 'short' : 'long',
            principal: parseFloat(form.amount),
            interest_rate: parseFloat(form.interestRate),
            start_date: form.date,
            term_months: parseInt(form.loanTerm),
            monthly_repayment: monthlyRepayment,
            status: 'active',
            outstanding_balance: parseFloat(form.amount)
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
      } else if (form.transactionType === 'loan_repayment' && form.loanId) {
        // Update loan outstanding balance
        const { data: loanData } = await supabase
          .from("loans")
          .select("outstanding_balance")
          .eq("id", form.loanId)
          .single();

        if (loanData) {
          const newBalance = Math.max(0, loanData.outstanding_balance - parseFloat(form.amount));
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
      } else if (form.transactionType === 'loan_interest' && form.loanId) {
        // Record loan interest payment
        const { error: interestError } = await supabase
          .from("loan_payments")
          .insert({
            loan_id: form.loanId,
            payment_date: form.date,
            amount: parseFloat(form.amount),
            principal_component: 0,
            interest_component: parseFloat(form.amount)
          });

        if (interestError) {
          console.error("Interest payment recording error:", interestError);
        }
      }

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
        vatRate: "0",
        loanId: "",
        interestRate: "",
        loanTerm: ""
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
            <Select value={form.bankAccount || "__none__"} onValueChange={(val) => {
              const bankAccountValue = val === "__none__" ? "" : val;
              setForm({ ...form, bankAccount: bankAccountValue });
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
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

          {/* Loan-specific fields */}
          {form.transactionType.startsWith('loan_') && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">Loan Transaction Details</div>
              
              {form.transactionType === 'loan_received' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Interest Rate (% per annum) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.interestRate}
                      onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                      placeholder="e.g., 8.5"
                    />
                  </div>
                  <div>
                    <Label>Loan Term (months) *</Label>
                    <Input
                      type="number"
                      value={form.loanTerm}
                      onChange={(e) => setForm({ ...form, loanTerm: e.target.value })}
                      placeholder="e.g., 12"
                    />
                  </div>
                </div>
              )}

              {(form.transactionType === 'loan_repayment' || form.transactionType === 'loan_interest') && (
                <div>
                  <Label>Select Loan *</Label>
                  <Select value={form.loanId} onValueChange={(val) => setForm({ ...form, loanId: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {loans.map(loan => (
                        <SelectItem key={loan.id} value={loan.id}>
                          {loan.reference} - {loan.loan_type === 'short' ? 'Short-term' : 'Long-term'} 
                          (Outstanding: R {loan.outstanding_balance?.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="text-xs text-blue-600">
                {form.transactionType === 'loan_received' && 
                  "This will create a new loan record and post the transaction to your accounts."}
                {form.transactionType === 'loan_repayment' && 
                  "This will reduce the loan outstanding balance and post the principal repayment."}
                {form.transactionType === 'loan_interest' && 
                  "This will post interest expense and update the loan interest records."}
              </div>
            </div>
          )}

          {form.transactionType === 'loan_received' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-blue-600">🏦</div>
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Loan Received Transaction</p>
                  <p className="text-blue-700">
                    When you receive a loan: <strong>Debit Bank Account</strong> (cash increases) and <strong>Credit Loan Account</strong> (liability increases).
                    Select your bank account below to receive the funds, and choose either 2300 (Short-term) or 2400 (Long-term) loan account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {form.transactionType === 'loan_repayment' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-green-600">💳</div>
                <div className="text-sm">
                  <p className="font-medium text-green-900 mb-1">Loan Repayment Transaction</p>
                  <p className="text-green-700">
                    When repaying loan principal: <strong>Debit Loan Account</strong> (liability decreases) and <strong>Credit Bank Account</strong> (cash decreases).
                    This reduces your outstanding loan balance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {form.transactionType === 'loan_interest' && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-orange-600">📈</div>
                <div className="text-sm">
                  <p className="font-medium text-orange-900 mb-1">Loan Interest Payment</p>
                  <p className="text-orange-700">
                    When paying loan interest: <strong>Debit Interest Expense</strong> (expense increases) and <strong>Credit Bank Account</strong> (cash decreases).
                    This records the cost of borrowing, separate from principal repayment.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border">
            <div>
              <Label className="flex items-center gap-2">
                Debit Account * (Dr)
                {form.transactionType === 'loan_received' && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                    💰 Cash Received
                  </Badge>
                )}
                {form.transactionType === 'loan_repayment' && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    💳 Reduce Loan
                  </Badge>
                )}
                {form.transactionType === 'loan_interest' && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                    📈 Interest Expense
                  </Badge>
                )}
              </Label>
              <Select value={form.debitAccount} onValueChange={(val) => setForm({ ...form, debitAccount: val })}>
                <SelectTrigger className={form.transactionType?.startsWith('loan_') && !form.debitAccount ? "border-orange-300" : ""}>
                  <SelectValue 
                    placeholder={form.transactionType === 'loan_received' ? "Select Bank Account (Cash Received)" : 
                                 form.transactionType === 'loan_repayment' ? "Select Loan Account (Reduce Loan)" :
                                 form.transactionType === 'loan_interest' ? "Select Interest Expense" :
                                 "Select debit account"} 
                  />
                </SelectTrigger>
                <SelectContent>
                  {debitAccounts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No accounts available for this transaction type
                    </div>
                  ) : (
                    debitAccounts.map(acc => (
                      <SelectItem key={(acc as any).id ?? (acc as any).account_id} value={(acc as any).id ?? (acc as any).account_id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-1 rounded">{acc.account_code}</span>
                          <span>{acc.account_name}</span>
                          <span className="text-xs text-gray-500">[{acc.account_type}]</span>
                          {form.transactionType === 'loan_received' && acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank') && (
                            <Badge variant="secondary" className="text-xs">💰 Recommended</Badge>
                          )}
                          {form.transactionType === 'loan_repayment' && (acc.account_code === '2300' || acc.account_code === '2400') && (
                            <Badge variant="secondary" className="text-xs">💳 Loan Account</Badge>
                          )}
                          {form.transactionType === 'loan_interest' && acc.account_type === 'expense' && acc.account_name.toLowerCase().includes('interest') && (
                            <Badge variant="secondary" className="text-xs">📈 Interest</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="flex items-center gap-2">
                Credit Account * (Cr)
                {form.transactionType === 'loan_received' && (
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                    🏦 Loan Liability
                  </Badge>
                )}
                {form.transactionType === 'loan_repayment' && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                    💸 Cash Paid
                  </Badge>
                )}
                {form.transactionType === 'loan_interest' && (
                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700">
                    💸 Cash Paid
                  </Badge>
                )}
              </Label>
              <Select value={form.creditAccount} onValueChange={(val) => setForm({ ...form, creditAccount: val })}>
                <SelectTrigger className={form.transactionType?.startsWith('loan_') && !form.creditAccount ? "border-orange-300" : ""}>
                  <SelectValue 
                    placeholder={form.transactionType === 'loan_received' ? "Select Loan Account (Create Liability)" : 
                                 form.transactionType === 'loan_repayment' ? "Select Bank Account (Cash Paid)" :
                                 form.transactionType === 'loan_interest' ? "Select Bank Account (Cash Paid)" :
                                 "Select credit account"} 
                  />
                </SelectTrigger>
                <SelectContent>
                  {creditAccounts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No accounts available for this transaction type
                    </div>
                  ) : (
                    creditAccounts.map(acc => (
                      <SelectItem key={(acc as any).id ?? (acc as any).account_id} value={(acc as any).id ?? (acc as any).account_id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-1 rounded">{acc.account_code}</span>
                          <span>{acc.account_name}</span>
                          <span className="text-xs text-gray-500">[{acc.account_type}]</span>
                          {form.transactionType === 'loan_received' && (acc.account_code === '2300' || acc.account_code === '2400') && (
                            <Badge variant="secondary" className="text-xs">🏦 Loan Payable</Badge>
                          )}
                          {form.transactionType === 'loan_repayment' && acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank') && (
                            <Badge variant="secondary" className="text-xs">💸 Bank Account</Badge>
                          )}
                          {form.transactionType === 'loan_interest' && acc.account_type === 'asset' && acc.account_name.toLowerCase().includes('bank') && (
                            <Badge variant="secondary" className="text-xs">💸 Bank Account</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
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
            {form.transactionType?.startsWith('loan_') ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.interestRate}
                    onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                    placeholder="e.g. 10"
                  />
                </div>
                {form.transactionType === 'loan_received' && (
                  <div>
                    <Label>Term (months)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={form.loanTerm}
                      onChange={(e) => setForm({ ...form, loanTerm: e.target.value })}
                      placeholder="e.g. 12"
                    />
                  </div>
                )}
              </div>
            ) : (
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
            )}
          </div>

          {form.amount && !form.transactionType?.startsWith('loan_') && (
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