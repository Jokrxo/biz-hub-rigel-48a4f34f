import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Download, Edit, Trash2, Receipt, ArrowUpDown, Calendar, CheckCircle, XCircle, MoreHorizontal, Loader2, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, Copy, FileText, Paperclip, Eye, SlidersHorizontal, ShoppingCart, FileSpreadsheet } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
// Lazy-load the enhanced transaction form to avoid route-level stalls if it errors
const TransactionFormLazy = lazy(() =>
  import("./TransactionFormEnhanced").then((m) => ({ default: m.TransactionFormEnhanced }))
);
import { exportTransactionsToExcel, exportTransactionsToPDF } from "@/lib/export-utils";

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string | null;
  total_amount: number;
  status: string;
  bank_account_id: string | null;
  transaction_type: string | null;
  category: string | null;
  entries?: any[];
  bank_accounts?: { account_name: string; bank_name: string } | null;
}

export const TransactionManagement = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [posting, setPosting] = useState(false);
  const [newFlowOpen, setNewFlowOpen] = useState(false);
  const [quickType, setQuickType] = useState<'income' | 'expense' | 'receipt' | 'asset' | 'product_purchase' | 'liability' | 'equity' | 'loan_received' | 'loan_repayment' | 'loan_interest' | 'depreciation' | 'asset_disposal' | null>(null);
  const [quickDate, setQuickDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickDesc, setQuickDesc] = useState<string>('');
  const [quickPayment, setQuickPayment] = useState<'cash' | 'accrual'>('cash');
  const [quickBankId, setQuickBankId] = useState<string>('');
  const [quickExpenseAccountId, setQuickExpenseAccountId] = useState<string>('');
  const [quickIncomeAccountId, setQuickIncomeAccountId] = useState<string>('');
  const [quickReceivableAccountId, setQuickReceivableAccountId] = useState<string>('');
  const [quickPayableAccountId, setQuickPayableAccountId] = useState<string>('');
  const [quickEquityAccountId, setQuickEquityAccountId] = useState<string>('');
  const [quickAssetAccountId, setQuickAssetAccountId] = useState<string>('');
  const [quickUsefulLifeYears, setQuickUsefulLifeYears] = useState<string>('5');
  const [quickDepMethod, setQuickDepMethod] = useState<'straight_line' | 'diminishing'>('straight_line');
  const [quickUsefulLifeStartDate, setQuickUsefulLifeStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  const fixedAssetCodes = ['1500','1510','1600','1700','1800'];
  const [quickVatOn, setQuickVatOn] = useState<'yes' | 'no'>('no');
  const [quickVatRate, setQuickVatRate] = useState<string>('15');
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Transaction[]>([]);
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [prefillData, setPrefillData] = useState<any>(null);
  const [headless, setHeadless] = useState(false);
  const [sourceTab, setSourceTab] = useState<"all" | "invoice" | "csv" | "bank" | "manual" | "purchase">("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const [allocationOpen, setAllocationOpen] = useState(false);
  const [allocDate, setAllocDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [allocType, setAllocType] = useState<'income'|'expense'>('income');
  const [allocPayment, setAllocPayment] = useState<'cash'|'accrual'>('cash');
  const [allocBankId, setAllocBankId] = useState<string>('');
  const [allocVatOn, setAllocVatOn] = useState<'yes'|'no'>('no');
  const [allocVatRate, setAllocVatRate] = useState<string>('0');
  const [allocAccountId, setAllocAccountId] = useState<string>('');
  const [allocSettlement, setAllocSettlement] = useState<'receivable'|'payable'|'other'>('receivable');
  const [allocSettlementAccountId, setAllocSettlementAccountId] = useState<string>('');
  const [allocDesc, setAllocDesc] = useState<string>('');
  const [allocationTx, setAllocationTx] = useState<any>(null);

  const [coaIncome, setCoaIncome] = useState<any[]>([]);
  const [coaExpense, setCoaExpense] = useState<any[]>([]);
  const [coaReceivable, setCoaReceivable] = useState<any[]>([]);
  const [coaPayable, setCoaPayable] = useState<any[]>([]);
  const [coaOther, setCoaOther] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [allocAccountSearch, setAllocAccountSearch] = useState<string>("");
  const [allocSettlementSearch, setAllocSettlementSearch] = useState<string>("");

  // Enhanced Features State
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [viewDetailsData, setViewDetailsData] = useState<any>(null);
  
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [attachmentsData, setAttachmentsData] = useState<any>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Edit Warning State
  const [editWarningOpen, setEditWarningOpen] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<any>(null);

  const load = React.useCallback(async () => {
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

      const start = page * pageSize;
      const end = start + pageSize - 1;

      let baseCountQuery = supabase
        .from("transactions")
        .select(`
          *,
          bank_account:bank_accounts(bank_name, account_number),
          entries:transaction_entries(
            id,
            account_id,
            debit,
            credit,
            description,
            status,
            chart_of_accounts(account_code, account_name)
          )
        `, { count: 'exact' })
        .eq("company_id", profile.company_id);

      let basePageQuery = supabase
        .from("transactions")
        .select(`
          *,
          bank_account:bank_accounts(bank_name, account_number),
          entries:transaction_entries(
            id,
            account_id,
            debit,
            credit,
            description,
            status,
            chart_of_accounts(account_code, account_name)
          )
        `)
        .eq("company_id", profile.company_id);

      if (searchTerm && searchTerm.trim().length > 0) {
        const term = `%${searchTerm.trim()}%`;
        baseCountQuery = baseCountQuery.or(`description.ilike.${term},reference_number.ilike.${term}`);
        basePageQuery = basePageQuery.or(`description.ilike.${term},reference_number.ilike.${term}`);
      }
      if (filterStatus !== "all") {
        baseCountQuery = baseCountQuery.eq("status", filterStatus);
        basePageQuery = basePageQuery.eq("status", filterStatus);
      }
      if (filterType !== "all") {
        if (filterType.toLowerCase() === "income") {
          baseCountQuery = baseCountQuery.gt("total_amount", 0);
          basePageQuery = basePageQuery.gt("total_amount", 0);
        } else if (filterType.toLowerCase() === "expense") {
          baseCountQuery = baseCountQuery.lt("total_amount", 0);
          basePageQuery = basePageQuery.lt("total_amount", 0);
        }
      }
      if (dateFrom) {
        baseCountQuery = baseCountQuery.gte("transaction_date", dateFrom);
        basePageQuery = basePageQuery.gte("transaction_date", dateFrom);
      }
      if (dateTo) {
        baseCountQuery = baseCountQuery.lte("transaction_date", dateTo);
        basePageQuery = basePageQuery.lte("transaction_date", dateTo);
      }
      if (sourceTab !== "all") {
        const s = sourceTab.toLowerCase();
        if (s === "invoice") {
          baseCountQuery = baseCountQuery.or(`transaction_type.eq.sales,description.ilike.%invoice%,reference_number.ilike.INV-%`);
          basePageQuery = basePageQuery.or(`transaction_type.eq.sales,description.ilike.%invoice%,reference_number.ilike.INV-%`);
        } else if (s === "purchase") {
          baseCountQuery = baseCountQuery.or(`transaction_type.eq.purchase,description.ilike.%purchase%,reference_number.ilike.PO%`);
          basePageQuery = basePageQuery.or(`transaction_type.eq.purchase,description.ilike.%purchase%,reference_number.ilike.PO%`);
        } else if (s === "csv") {
          baseCountQuery = baseCountQuery.or(`category.eq.Bank Import,description.ilike.%csv%,reference_number.ilike.%CSV%`);
          basePageQuery = basePageQuery.or(`category.eq.Bank Import,description.ilike.%csv%,reference_number.ilike.%CSV%`);
        } else if (s === "bank") {
          baseCountQuery = baseCountQuery.not("bank_account_id", "is", "null");
          basePageQuery = basePageQuery.not("bank_account_id", "is", "null");
        }
      }

      const { data, error, count } = await baseCountQuery.order("transaction_date", { ascending: false });
      const { data: pagedData, error: rangeError } = await basePageQuery
        .order("transaction_date", { ascending: false })
        .range(start, end);

      if (error) throw error;
      if (rangeError) throw rangeError;
      setItems(pagedData || []);
      setTotalCount(typeof count === 'number' ? count : ((pagedData && Array.isArray(pagedData) ? pagedData.length : 0)));
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, filterType, filterStatus, sourceTab, dateFrom, dateTo, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [searchTerm, filterType, filterStatus, sourceTab, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const flow = params.get("flow") || "";
      if (flow.toLowerCase() === "depreciation") {
        const assetId = params.get("asset_id") || "";
        const date = params.get("date") || new Date().toISOString().slice(0,10);
        const amount = params.get("amount") || "";
        const debitAccountId = params.get("debit_account_id") || "";
        const creditAccountId = params.get("credit_account_id") || "";
        const description = params.get("description") || "Depreciation";

        const prefill = {
          element: "depreciation",
          description,
          date,
          amount,
          debitAccount: debitAccountId,
          creditAccount: creditAccountId,
          vatRate: "0",
          paymentMethod: "accrual",
          assetId,
          depreciationMethod: params.get("depreciation_method") || "straight_line",
          usefulLifeYears: params.get("useful_life_years") || "5"
        };
        setPrefillData(prefill);
        setEditData(null);
        setHeadless(false);
        setOpen(true);
        return;
      }
      if (flow.toLowerCase() === "asset_disposal") {
        const assetId = params.get("asset_id") || "";
        const date = params.get("date") || new Date().toISOString().slice(0,10);
        const amount = params.get("amount") || "";
        const bankLedgerId = params.get("bank_ledger_id") || "";
        const assetAccountId = params.get("asset_account_id") || "";
        const description = params.get("description") || "Asset Disposal";

        (async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase
              .from("profiles")
              .select("company_id")
              .eq("user_id", user.id)
              .single();
            const companyId = (profile as any)?.company_id;
            if (!companyId) return;
            const { data: existing } = await supabase
              .from("chart_of_accounts")
              .select("id, account_code")
              .eq("company_id", companyId)
              .in("account_code", ["9500","9600"]);
            const hasGainNew = (existing || []).some((a: any) => String(a.account_code) === "9500");
            const hasLossNew = (existing || []).some((a: any) => String(a.account_code) === "9600");
            if (!hasGainNew) {
              await supabase
                .from("chart_of_accounts")
                .insert({ company_id: companyId, account_code: "9500", account_name: "Gain on Sale of Assets", account_type: "revenue", normal_balance: "credit", is_active: true });
            }
            if (!hasLossNew) {
              await supabase
                .from("chart_of_accounts")
                .insert({ company_id: companyId, account_code: "9600", account_name: "Loss on Sale of Assets", account_type: "expense", normal_balance: "debit", is_active: true });
            }
          } catch {}
        })();

        const prefill = {
          element: "asset_disposal",
          description,
          date,
          amount,
          bankAccountId: params.get("bank_id") || "",
          debitAccount: bankLedgerId || "",
          creditAccount: assetAccountId || "",
          vatRate: "0",
          paymentMethod: "bank",
          assetId
        };
        setPrefillData(prefill);
        setEditData(null);
        setHeadless(false);
        setOpen(true);
        return;
      }
      if (flow.toLowerCase() === "asset_purchase") {
        const date = params.get("date") || new Date().toISOString().slice(0,10);
        const amount = params.get("amount") || "";
        const debitAccountId = params.get("debit_account_id") || "";
        const bankLedgerId = params.get("bank_ledger_id") || "";
        const loanLedgerId = params.get("loan_ledger_id") || "";
        const bankId = params.get("bank_id") || "";
        const description = params.get("description") || "Asset Purchase";
        const usefulLifeYears = params.get("useful_life_years") || "5";
        const depreciationMethod = params.get("depreciation_method") || "straight_line";
        const interestRate = params.get("interest_rate") || "";
        const loanTerm = params.get("loan_term") || "";
        const loanTermType = params.get("loan_term_type") || "short";
        const vatRate = params.get("vat_rate") || "0";

        const creditAccount = bankLedgerId || loanLedgerId || "";
        const paymentMethod = bankLedgerId ? "bank" : "accrual";
        const prefill = {
          element: "asset",
          description,
          date,
          amount,
          bankAccountId: bankId,
          debitAccount: debitAccountId,
          creditAccount,
          vatRate,
          paymentMethod,
          depreciationMethod,
          usefulLifeYears,
          interestRate,
          loanTerm,
          loanTermType,
          assetFinancedByLoan: Boolean(loanLedgerId)
        };
        setPrefillData(prefill);
        setEditData(null);
        setHeadless(false);
        setOpen(true);
        return;
      }
    } catch {}
  }, [location.search]);

  useEffect(() => {
    (async () => {
      try {
        if (!allocationOpen && !newFlowOpen) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        const companyId = (profile as any)?.company_id;
        if (!companyId) return;
        const { data: accounts } = await supabase
          .from('chart_of_accounts')
          .select('id, account_code, account_name, account_type')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('account_code');
        const list = accounts || [];
        setCoaIncome(list.filter((a: any) => {
          const t = String(a.account_type || '').toLowerCase();
          return t === 'income' || t === 'revenue';
        }));
        setCoaExpense(list.filter((a: any) => String(a.account_type || '').toLowerCase() === 'expense'));
        setCoaReceivable(list.filter((a: any) => {
          const t = String(a.account_type || '').toLowerCase();
          const n = String(a.account_name || '').toLowerCase();
          return t === 'asset' && (n.includes('receivable') || n.includes('debtors'));
        }));
        setCoaPayable(list.filter((a: any) => {
          const t = String(a.account_type || '').toLowerCase();
          const n = String(a.account_name || '').toLowerCase();
          return t === 'liability' && (n.includes('payable') || n.includes('creditors'));
        }));
        setCoaOther(list.filter((a: any) => {
          const t = String(a.account_type || '').toLowerCase();
          return ['asset','liability','equity'].includes(t);
        }));
        const { data: bankList } = await supabase
          .from('bank_accounts')
          .select('id, bank_name, account_number')
          .eq('company_id', companyId)
          .order('bank_name');
        setBanks(bankList || []);
      } catch {}
    })();
  }, [allocationOpen, newFlowOpen]);

  useEffect(() => {
    if (allocVatOn === 'no') setAllocVatRate('0');
  }, [allocVatOn]);

  useEffect(() => {
    if (allocVatOn === 'yes') {
      const r = Number(allocVatRate || '0');
      if (!r || r <= 0) setAllocVatRate('15');
    }
  }, [allocVatOn, allocVatRate]);

  useEffect(() => {
    if (allocPayment === 'accrual') {
      setAllocSettlement(allocType === 'income' ? 'receivable' : 'payable');
    }
  }, [allocPayment, allocType]);

  const derived = useMemo(() => {
    const tx = items.map(t => ({
      id: t.id,
      date: t.transaction_date,
      description: t.description,
      type: (t as any).transaction_type || (t.total_amount >= 0 ? "Income" : "Expense"),
      category: (t as any).category || "—",
      bank: (t as any).bank_account ? `${(t as any).bank_account.bank_name} (${(t as any).bank_account.account_number})` : "—",
      amount: (() => {
        const total = Number(t.total_amount || 0);
        const base = Number((t as any).base_amount || 0);
        const inclusive = Boolean((t as any).vat_inclusive);
        // Prefer posted VAT from entries
        const vatFromEntries = (t.entries || []).reduce((sum: number, e: any) => {
          const name = String(e.chart_of_accounts?.account_name || '').toLowerCase();
          if (!name.includes('vat')) return sum;
          return sum + Math.abs(Number(e.debit || 0) - Number(e.credit || 0));
        }, 0);
        const vaStored = (t as any).vat_amount;
        const ratePct = Number((t as any).vat_rate) || 0;
        const r = ratePct / 100;
        // Force recompute for VAT-inclusive rows when rate is available
        if (inclusive && r > 0) {
          const net = total / (1 + r);
          return Math.abs(net);
        }
        const vat = vatFromEntries > 0
          ? vatFromEntries
          : (typeof vaStored === 'number' && !Number.isNaN(vaStored))
            ? Math.abs(vaStored)
            : (base > 0 && r > 0) ? Math.abs(base * r) : 0;
        const net = base > 0 ? base : Math.max(0, total - vat);
        return Math.abs(net);
      })(),
      vatAmount: (() => {
        const total = Number(t.total_amount || 0);
        const inclusive = Boolean((t as any).vat_inclusive);
        const vatFromEntries = (t.entries || []).reduce((sum: number, e: any) => {
          const name = String(e.chart_of_accounts?.account_name || '').toLowerCase();
          if (!name.includes('vat')) return sum;
          return sum + Math.abs(Number(e.debit || 0) - Number(e.credit || 0));
        }, 0);
        if (vatFromEntries > 0) return vatFromEntries;
        const va = (t as any).vat_amount;
        if (typeof va === 'number' && !Number.isNaN(va) && va !== 0) return Math.abs(va);
        const ratePct = Number((t as any).vat_rate) || 0;
        const r = ratePct / 100;
        const base = Number((t as any).base_amount) || 0;
        if (inclusive && r > 0) {
          const net = total / (1 + r);
          return Math.abs(total - net);
        }
        if (r > 0 && base > 0) return Math.abs(base * r);
        return 0;
      })(),
      reference: t.reference_number || "—",
      statusKey: t.status, // raw DB status
      statusLabel: t.status === 'approved' ? 'Approved' : t.status === 'pending' ? 'Pending' : t.status === 'unposted' ? 'Unposted' : t.status === 'rejected' ? 'Rejected' : t.status.charAt(0).toUpperCase() + t.status.slice(1),
      source: (() => {
        const ref = String(t.reference_number || "").toUpperCase();
        const desc = String(t.description || "").toLowerCase();
        const hasBank = Boolean(t.bank_account_id);
          if (ref.startsWith("INV-") || desc.includes("invoice")) return "invoice" as const;
          if ((t as any).transaction_type === 'purchase' || desc.includes('purchase') || ref.startsWith('PO') || desc.includes('po ')) return "purchase" as const;
          if ((t as any).category === 'Bank Import' || desc.includes('csv') || ref.includes('CSV')) return "csv" as const;
          if (hasBank || desc.includes("bank statement")) return "bank" as const;
          return "manual" as const;
      })()
    }));

    const filtered = tx.filter(transaction => {
      const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.reference.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || transaction.type.toLowerCase() === filterType.toLowerCase();
      const matchesStatus = filterStatus === "all" || (transaction as any).statusKey.toLowerCase() === filterStatus.toLowerCase();
      const matchesSource = sourceTab === "all" || transaction.source === sourceTab;
      return matchesSearch && matchesType && matchesStatus && matchesSource;
    });

    const totalIncome = filtered.filter(t => t.type === "Income").reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = filtered.filter(t => t.type === "Expense").reduce((sum, t) => sum + t.amount, 0);
    return { filtered, totalIncome, totalExpenses };
  }, [items, searchTerm, filterType, filterStatus, sourceTab]);

  const approveOrOpenForm = async (id: string) => {
    try {
      const { data: entries } = await supabase
        .from("transaction_entries")
        .select("id")
        .eq("transaction_id", id)
        .limit(1);
      if (entries && entries.length > 0) {
        await setTransactionStatus(id, 'approved');
        await load();
        return;
      }
      const full = items.find(i => i.id === id) || null;
      setEditData(full);
      setOpen(true);
    } catch {
      const full = items.find(i => i.id === id) || null;
      setEditData(full);
      setOpen(true);
    }
  };

  const setTransactionStatus = async (id: string, status: 'approved' | 'pending' | 'rejected' | 'unposted') => {
    setPosting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      // Handle approval workflow: ensure double-entry exists, post to ledger, then mark approved
      if (status === 'approved') {
        const { data: transaction, error: txFetchError } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", id)
          .single();
        if (txFetchError) throw txFetchError;
        if (!transaction) throw new Error("Transaction not found");

        // Load existing entries
        const { data: entries, error: entriesError } = await supabase
          .from("transaction_entries")
          .select("account_id, debit, credit, description")
          .eq("transaction_id", id);
        if (entriesError) throw entriesError;
        let computedEntries = entries || [];

        // If no entries exist, try to auto-create from header debit/credit accounts.
        // If missing, fall back to transaction_type_mappings, then heuristic chart_of_accounts.
        if (!entries || entries.length === 0) {
          let debitAccountId = (transaction as any).debit_account_id as string | null | undefined;
          let creditAccountId = (transaction as any).credit_account_id as string | null | undefined;
          const amount = Math.abs(transaction.total_amount || 0);

          // Company context required for fallbacks
          let companyId: string | null = null;
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("company_id")
              .eq("user_id", user.id)
              .single();
            companyId = (prof as any)?.company_id || null;
          } catch {}

          // Fallback 1: transaction_type_mappings
          if ((!debitAccountId || !creditAccountId) && companyId && (transaction as any).transaction_type) {
            const { data: mapping } = await (supabase as any)
              .from("transaction_type_mappings")
              .select("debit_account_id, credit_account_id")
              .eq("company_id", companyId)
              .eq("transaction_type", (transaction as any).transaction_type)
              .maybeSingle();
            debitAccountId = debitAccountId || (mapping as any)?.debit_account_id || null;
            creditAccountId = creditAccountId || (mapping as any)?.credit_account_id || null;
          }

          // Fallback 2: heuristic based on chart_of_accounts
          if ((!debitAccountId || !creditAccountId) && companyId) {
            const { data: accounts } = await supabase
              .from("chart_of_accounts")
              .select("id, account_name, account_type")
              .eq("company_id", companyId)
              .eq("is_active", true);

            const bank = (accounts || []).find(a => a.account_type === 'asset' && a.account_name.toLowerCase().includes('bank'))
              || (accounts || []).find(a => a.account_type === 'asset' && a.account_name.toLowerCase().includes('cash'));
            const income = (accounts || []).find(a => a.account_type === 'income');
            const expense = (accounts || []).find(a => a.account_type === 'expense');

            const isIncome = Number(transaction.total_amount || 0) >= 0;
            if (!debitAccountId) {
              debitAccountId = isIncome ? (bank as any)?.id || null : (expense as any)?.id || null;
            }
            if (!creditAccountId) {
              creditAccountId = isIncome ? (income as any)?.id || null : (bank as any)?.id || null;
            }
          }

          if (!debitAccountId || !creditAccountId) {
            throw new Error("Missing debit/credit accounts. Set mapping in Chart of Accounts or edit transaction to assign accounts.");
          }

          // Check if transaction has VAT and get VAT account
          let vatAccount = null;
          let vatAmount = 0;
          let netAmount = amount;
          
          if ((transaction as any).vat_rate > 0 && (transaction as any).vat_amount > 0) {
            vatAmount = (transaction as any).vat_amount;
            netAmount = amount - vatAmount;
            
            // Find VAT account
            const { data: vatAccounts } = await supabase
              .from("chart_of_accounts")
              .select("id, account_name, account_code")
              .eq("company_id", companyId)
              .or('account_name.ilike.%vat%,account_name.ilike.%tax%')
              .limit(1);
            
            if (vatAccounts && vatAccounts.length > 0) {
              vatAccount = vatAccounts[0];
            }
          }

          let newEntries = [];
          
          if (vatAccount && vatAmount > 0) {
            // VAT-aware entries
            const isIncome = Number(transaction.total_amount || 0) >= 0;
            
            if (isIncome) {
              // Income with VAT: Debit Bank (total), Credit Income (net), Credit VAT Output (vat)
              newEntries = [
                {
                  transaction_id: id,
                  account_id: debitAccountId, // Bank account
                  debit: amount,
                  credit: 0,
                  description: transaction.description,
                  status: 'approved'
                },
                {
                  transaction_id: id,
                  account_id: creditAccountId, // Income account
                  debit: 0,
                  credit: netAmount,
                  description: transaction.description,
                  status: 'approved'
                },
                {
                  transaction_id: id,
                  account_id: vatAccount.id, // VAT Output account
                  debit: 0,
                  credit: vatAmount,
                  description: 'VAT Output',
                  status: 'approved'
                }
              ];
            } else {
              // Expense with VAT: Debit Expense (net), Debit VAT Input (vat), Credit Bank (total)
              newEntries = [
                {
                  transaction_id: id,
                  account_id: debitAccountId, // Expense account
                  debit: netAmount,
                  credit: 0,
                  description: transaction.description,
                  status: 'approved'
                },
                {
                  transaction_id: id,
                  account_id: vatAccount.id, // VAT Input account
                  debit: vatAmount,
                  credit: 0,
                  description: 'VAT Input',
                  status: 'approved'
                },
                {
                  transaction_id: id,
                  account_id: creditAccountId, // Bank account
                  debit: 0,
                  credit: amount,
                  description: transaction.description,
                  status: 'approved'
                }
              ];
            }
          } else {
            // No VAT - simple double entry
            newEntries = [
              {
                transaction_id: id,
                account_id: debitAccountId,
                debit: amount,
                credit: 0,
                description: transaction.description,
                status: 'approved'
              },
              {
                transaction_id: id,
                account_id: creditAccountId,
                debit: 0,
                credit: amount,
                description: transaction.description,
                status: 'approved'
              }
            ];
          }
          const { error: insertEntriesError } = await supabase
            .from("transaction_entries")
            .insert(newEntries);
          if (insertEntriesError) throw insertEntriesError;
          computedEntries = newEntries.map(e => ({
            account_id: e.account_id,
            debit: e.debit,
            credit: e.credit,
            description: e.description,
          }));
        }

        // Validate double-entry balance
        const totalDebits = (computedEntries || []).reduce((sum: number, e: any) => sum + (Number(e.debit) || 0), 0);
        const totalCredits = (computedEntries || []).reduce((sum: number, e: any) => sum + (Number(e.credit) || 0), 0);
        if (Number(totalDebits.toFixed(2)) !== Number(totalCredits.toFixed(2))) {
          throw new Error("Unbalanced transaction entries; approval blocked. Please fix entries.");
        }

        // Company context
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        if (profileError) throw profileError;
        if (!profile?.company_id) throw new Error("Company context not found for user.");

        // Idempotency: remove previous ledger entries for this transaction
        await supabase.from("ledger_entries").delete().eq("reference_id", id);
        await supabase.from("ledger_entries").delete().eq("transaction_id", id);

        // Insert into ledger_entries
        const ledgerEntries = (computedEntries || []).map((e: any) => ({
          company_id: profile.company_id,
          account_id: e.account_id,
          entry_date: transaction.transaction_date,
          description: e.description || transaction.description,
          debit: e.debit,
          credit: e.credit,
          reference_id: id,
          transaction_id: id
        }));
        if (ledgerEntries.length === 0) {
          throw new Error("No ledger entries generated; approval aborted.");
        }
        const { error: ledgerError } = await supabase.from("ledger_entries").insert(ledgerEntries as any);
        if (ledgerError) throw ledgerError;

        if ((transaction as any).bank_account_id) {
          const bankAccountId = (transaction as any).bank_account_id as string;
          const accountIds = (computedEntries || []).map((e: any) => e.account_id);
          let { data: acctInfos } = await supabase
            .from("chart_of_accounts")
            .select("id, account_type, account_name")
            .in("id", accountIds as any);
          acctInfos = acctInfos || [];
          const isDebitBank = (computedEntries || []).some((e: any) => {
            const a = acctInfos.find((x: any) => x.id === e.account_id);
            return a && String(a.account_type || '').toLowerCase() === 'asset' && String(a.account_name || '').toLowerCase().includes('bank') && Number(e.debit || 0) > 0;
          });
          const isCreditBank = (computedEntries || []).some((e: any) => {
            const a = acctInfos.find((x: any) => x.id === e.account_id);
            return a && String(a.account_type || '').toLowerCase() === 'asset' && String(a.account_name || '').toLowerCase().includes('bank') && Number(e.credit || 0) > 0;
          });
          const bankDebitAmount = (computedEntries || []).reduce((sum: number, e: any) => {
            const a = acctInfos.find((x: any) => x.id === e.account_id);
            const isBank = a && String(a.account_type || '').toLowerCase() === 'asset' && String(a.account_name || '').toLowerCase().includes('bank');
            return sum + (isBank ? Number(e.debit || 0) : 0);
          }, 0);
          const bankCreditAmount = (computedEntries || []).reduce((sum: number, e: any) => {
            const a = acctInfos.find((x: any) => x.id === e.account_id);
            const isBank = a && String(a.account_type || '').toLowerCase() === 'asset' && String(a.account_name || '').toLowerCase().includes('bank');
            return sum + (isBank ? Number(e.credit || 0) : 0);
          }, 0);
          if (isDebitBank && bankDebitAmount > 0) {
            try { await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: bankDebitAmount, _operation: 'add' }); } catch {}
          } else if (isCreditBank && bankCreditAmount > 0) {
            try { await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: bankCreditAmount, _operation: 'subtract' }); } catch {}
          }
        }

        // Mark transaction and entries as approved only after successful ledger post
        const { error: updateTxError } = await supabase
          .from("transactions")
          .update({ status: 'approved' })
          .eq("id", id);
        if (updateTxError) throw updateTxError;

        const { error: updateEntriesError } = await supabase
          .from("transaction_entries")
          .update({ status: 'approved' })
          .eq("transaction_id", id);
        if (updateEntriesError) throw updateEntriesError;

        // Optional: refresh AFS cache if available
        try {
          await supabase.rpc('refresh_afs_cache', { _company_id: profile.company_id });
        } catch {}

      } else {
        // Pending or rejected: update status and clean up ledger postings
        const { error: updateTxError } = await supabase
          .from("transactions")
          .update({ status })
          .eq("id", id);
        if (updateTxError) throw updateTxError;

        const { error: updateEntriesError } = await supabase
          .from("transaction_entries")
          .update({ status })
          .eq("transaction_id", id);
        if (updateEntriesError) throw updateEntriesError;

        await supabase.from("ledger_entries").delete().eq("reference_id", id);
      }

      toast({ title: "Success", description: `Transaction ${status}` });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  const initiateDelete = (id: string) => {
    setDeleteId(id);
    setDeleteConfirmText("");
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    
    try {
      // Remove entries and ledger postings first
      await supabase.from("transaction_entries").delete().eq("transaction_id", id);
      await supabase.from("ledger_entries").delete().eq("transaction_id", id);
      await supabase.from("ledger_entries").delete().eq("reference_id", id);
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile?.company_id) {
            await supabase.rpc('refresh_afs_cache', { _company_id: profile.company_id });
          }
        }
      } catch {}
      toast({ title: "Success", description: "Transaction deleted" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteId(null);
    }
  };

  const handleExport = () => {
    const exportData = derived.filtered.map(t => ({
      date: t.date,
      description: t.description,
      type: t.type,
      amount: t.amount,
      vatAmount: t.vatAmount,
      reference: t.reference
    }));
    
    if (confirm("Export as Excel or PDF? (OK = Excel, Cancel = PDF)")) {
      exportTransactionsToExcel(exportData);
    } else {
      exportTransactionsToPDF(exportData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">

        <Suspense fallback={null}>
          <TransactionFormLazy
            open={open}
            onOpenChange={setOpen}
            onSuccess={load}
            editData={editData}
            prefill={prefillData}
            headless={headless}
          />
        </Suspense>

        <Dialog open={newFlowOpen} onOpenChange={(v) => { setNewFlowOpen(v); if (!v) { setQuickType(null); setQuickAmount(''); setQuickDesc(''); } }}>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader>
              <DialogTitle>Start a Transaction</DialogTitle>
            </DialogHeader>
            {!quickType ? (
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setQuickType('income')}>Income Received</Button>
                <Button variant="outline" onClick={() => setQuickType('expense')}>Expense Payment</Button>
                <Button variant="outline" onClick={() => setQuickType('receipt')}>Receivable Collection</Button>
                <Button variant="outline" onClick={() => setQuickType('product_purchase')}>Product Purchase</Button>
                <Button variant="outline" onClick={() => setQuickType('asset')}>Asset Purchase</Button>
                <Button variant="outline" onClick={() => setQuickType('liability')}>Liability Payment</Button>
                <Button variant="outline" onClick={() => setQuickType('equity')}>Equity / Capital</Button>
                <Button variant="outline" onClick={() => setQuickType('loan_received')}>Loan Received</Button>
                <Button variant="outline" onClick={() => setQuickType('loan_repayment')}>Loan Repayment</Button>
                <Button variant="outline" onClick={() => setQuickType('loan_interest')}>Loan Interest</Button>
                <Button variant="outline" onClick={() => setQuickType('depreciation')}>Depreciation</Button>
                <Button variant="outline" onClick={() => setQuickType('asset_disposal')}>Asset Disposal</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(quickType === 'product_purchase' || quickType === 'asset' || quickType === 'asset_disposal' || quickType === 'depreciation' || (quickType && quickType.startsWith('loan_'))) && (
                  <div className="relative p-6 border rounded-lg bg-muted/30 overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none opacity-10 flex items-center justify-center">
                      <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Business" className="h-32 w-32 rounded-lg object-cover" />
                    </div>
                    <div className="relative space-y-3">
                      {quickType === 'product_purchase' ? (
                        <>
                          <h3 className="text-lg font-semibold">Purchase Module</h3>
                          <p className="text-sm text-muted-foreground">
                            To purchase products, please use the Purchase module. All product purchases are recorded and managed there for accurate inventory and VAT posting.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/purchase'); }}>Go to Purchase Module</Button>
                          </div>
                        </>
                      ) : quickType === 'asset' ? (
                        <>
                          <h3 className="text-lg font-semibold">Fixed Asset Register</h3>
                          <p className="text-sm text-muted-foreground">
                            Record asset purchases in the Fixed Asset Register. Add new and opening balances, dispose assets, and calculate depreciation for accurate financials.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/fixed-assets'); }}>Go to Fixed Asset Register</Button>
                          </div>
                        </>
                      ) : quickType === 'asset_disposal' ? (
                        <>
                          <h3 className="text-lg font-semibold">Asset Disposal</h3>
                          <p className="text-sm text-muted-foreground">
                            Dispose fixed assets from the Fixed Asset Register. The system will post gain or loss and update accumulated depreciation.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/fixed-assets'); }}>Go to Fixed Asset Register</Button>
                          </div>
                        </>
                      ) : quickType === 'depreciation' ? (
                        <>
                          <h3 className="text-lg font-semibold">Depreciation</h3>
                          <p className="text-sm text-muted-foreground">
                            Calculate and post periodic depreciation in the Fixed Asset Register to keep your financials accurate.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/fixed-assets'); }}>Go to Fixed Asset Register</Button>
                          </div>
                        </>
                      ) : quickType === 'loan_received' ? (
                        <>
                          <h3 className="text-lg font-semibold">Loan Received</h3>
                          <p className="text-sm text-muted-foreground">
                            Manage loans in the Loans module: record loan receipts, set interest rates, and track outstanding balances.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/loans'); }}>Go to Loans</Button>
                          </div>
                        </>
                      ) : quickType === 'loan_repayment' ? (
                        <>
                          <h3 className="text-lg font-semibold">Loan Repayment</h3>
                          <p className="text-sm text-muted-foreground">
                            Record principal repayments and keep your loan schedules up to date in the Loans module.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/loans'); }}>Go to Loans</Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold">Loan Interest</h3>
                          <p className="text-sm text-muted-foreground">
                            Post loan interest charges and reconcile payments in the Loans module.
                          </p>
                          <div className="flex justify-end">
                            <Button onClick={() => { setNewFlowOpen(false); navigate('/loans'); }}>Go to Loans</Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {!(quickType === 'product_purchase' || quickType === 'asset' || quickType === 'asset_disposal' || quickType === 'depreciation' || (quickType && quickType.startsWith('loan_'))) && (
                <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)} placeholder={quickType === 'expense' ? 'Expense details' : 'Description'} />
                </div>
                </>
                )}
                {(quickType === 'expense' || quickType === 'income') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>VAT</Label>
                      <Select value={quickVatOn} onValueChange={(v: any) => setQuickVatOn(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>VAT Rate (%)</Label>
                      <Input type="number" min="0" max="100" value={quickVatRate} onChange={(e) => setQuickVatRate(e.target.value)} />
                    </div>
                  </div>
                )}
                {(quickType === 'expense' || quickType === 'income' || quickType === 'equity') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={quickPayment} onValueChange={(v: any) => setQuickPayment(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="accrual">Accrual</SelectItem>
                          {quickType === 'equity' && (
                            <SelectItem value="asset">Asset Contribution</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {quickPayment === 'cash' && (
                      <div>
                        <Label>Bank</Label>
                        <Select value={quickBankId} onValueChange={(v: any) => setQuickBankId(v)}>
                          <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                          <SelectContent>
                            {banks.length === 0 ? (
                              <SelectItem value="__none__" disabled>No bank accounts</SelectItem>
                            ) : (
                              banks.map(b => (
                                <SelectItem key={b.id} value={String(b.id)}>{b.bank_name} ({b.account_number})</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                {quickType === 'expense' && (
                  <div>
                    <Label>Expense Account</Label>
                    <Select value={quickExpenseAccountId} onValueChange={(v: any) => setQuickExpenseAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select expense account" /></SelectTrigger>
                      <SelectContent>
                        {coaExpense.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {quickType === 'expense' && quickPayment === 'accrual' && (
                  <div>
                    <Label>Payable Account</Label>
                    <Select value={quickPayableAccountId} onValueChange={(v: any) => setQuickPayableAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select payable account" /></SelectTrigger>
                      <SelectContent>
                        {coaPayable.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {quickType === 'liability' && (
                  <div>
                    <Label>Liability Account</Label>
                    <Select value={quickPayableAccountId} onValueChange={(v: any) => setQuickPayableAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select liability account" /></SelectTrigger>
                      <SelectContent>
                        {coaPayable.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {quickType === 'income' && (
                  <div>
                    <Label>Income Account</Label>
                    <Select value={quickIncomeAccountId} onValueChange={(v: any) => setQuickIncomeAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select income account" /></SelectTrigger>
                      <SelectContent>
                        {coaIncome.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {quickType === 'equity' && (
                  <div>
                    <Label>Equity Account</Label>
                    <Select value={quickEquityAccountId} onValueChange={(v: any) => setQuickEquityAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select equity account" /></SelectTrigger>
                      <SelectContent>
                        {coaOther.filter((a: any) => String(a.type || a.account_type || '').toLowerCase() === 'equity').map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {quickType === 'equity' && quickPayment === 'asset' && (
                  <div>
                    <Label>Asset Account (Director Contribution)</Label>
                    <Select value={quickAssetAccountId} onValueChange={(v: any) => setQuickAssetAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select asset account" /></SelectTrigger>
                      <SelectContent>
                        {coaOther.filter((a: any) => String(a.type || a.account_type || '').toLowerCase() === 'asset' && !String(a.account_name || '').toLowerCase().includes('accumulated')).map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {quickType === 'equity' && quickPayment === 'asset' && (() => { const sel = coaOther.find((a: any) => String(a.id) === String(quickAssetAccountId)); return fixedAssetCodes.includes(String(sel?.account_code || '')); })() && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Useful Life (years)</Label>
                      <Input type="number" min="1" value={quickUsefulLifeYears} onChange={(e) => setQuickUsefulLifeYears(e.target.value)} />
                    </div>
                    <div>
                      <Label>Depreciation Method</Label>
                      <Select value={quickDepMethod} onValueChange={(v: any) => setQuickDepMethod(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="straight_line">Straight Line</SelectItem>
                          <SelectItem value="diminishing">Diminishing Balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Useful Life Start Date</Label>
                      <Input type="date" value={quickUsefulLifeStartDate} onChange={(e) => setQuickUsefulLifeStartDate(e.target.value)} />
                    </div>
                  </div>
                )}
                {quickType === 'liability' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={quickPayment} onValueChange={(v: any) => setQuickPayment(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Bank</Label>
                      <Select value={quickBankId} onValueChange={(v: any) => setQuickBankId(v)}>
                        <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                        <SelectContent>
                          {banks.length === 0 ? (
                            <SelectItem value="__none__" disabled>No bank accounts</SelectItem>
                          ) : (
                            banks.map(b => (
                              <SelectItem key={b.id} value={String(b.id)}>{b.bank_name} ({b.account_number})</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {(quickType === 'receipt' || (quickType === 'income' && quickPayment === 'accrual')) && (
                  <div>
                    <Label>Receivable Account</Label>
                    <Select value={quickReceivableAccountId} onValueChange={(v: any) => setQuickReceivableAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select receivable account" /></SelectTrigger>
                      <SelectContent>
                        {coaReceivable.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>{a.account_code} • {a.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {!(quickType === 'product_purchase' || quickType === 'asset' || quickType === 'asset_disposal' || quickType === 'depreciation' || (quickType && quickType.startsWith('loan_'))) && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setQuickType(null); setQuickAmount(''); setQuickDesc(''); }}>Back</Button>
                  <Button onClick={() => {
                    const desc = String(quickDesc || '').trim();
                    if (!desc) { toast({ title: 'Description required', description: 'Please enter a description before proceeding', variant: 'destructive' }); return; }
                    const amtNum = Number(quickAmount || '0');
                    if (!amtNum || amtNum <= 0) { toast({ title: 'Amount required', description: 'Enter a valid amount', variant: 'destructive' }); return; }
                    const pf: any = {
                      date: quickDate,
                      description: desc,
                      element: quickType,
                      paymentMethod: (quickPayment === 'cash' ? 'bank' : quickPayment),
                      amount: String(amtNum.toFixed(2)),
                      ...(quickType === 'expense' || quickType === 'income' ? {
                        vatRate: quickVatOn === 'yes' ? String(Number(quickVatRate || '0')) : '0',
                        amountIncludesVAT: quickVatOn === 'yes'
                      } : {})
                    };
                    if (quickType === 'expense') {
                      pf.debitAccount = quickExpenseAccountId || "";
                      if (quickPayment === 'cash') {
                        pf.creditAccount = "";
                        pf.bankAccountId = String(quickBankId || "");
                      } else {
                        pf.creditAccount = quickPayableAccountId || "";
                        pf.bankAccountId = "";
                      }
                    } else if (quickType === 'income') {
                      pf.creditAccount = quickIncomeAccountId || "";
                      if (quickPayment === 'cash') {
                        pf.debitAccount = "";
                        pf.bankAccountId = String(quickBankId || "");
                      } else {
                        pf.debitAccount = quickReceivableAccountId || "";
                        pf.bankAccountId = "";
                      }
                    } else if (quickType === 'equity') {
                      pf.creditAccount = quickEquityAccountId || "";
                      if (quickPayment === 'cash') {
                        pf.debitAccount = "";
                        pf.bankAccountId = String(quickBankId || "");
                      } else if (quickPayment === 'accrual') {
                        pf.debitAccount = quickReceivableAccountId || "";
                        pf.bankAccountId = "";
                      } else {
                        // Asset contribution
                        pf.debitAccount = quickAssetAccountId || "";
                        pf.bankAccountId = "";
                        {
                          const sel = coaOther.find((a: any) => String(a.id) === String(quickAssetAccountId));
                          if (fixedAssetCodes.includes(String(sel?.account_code || ''))) {
                            pf.usefulLifeYears = quickUsefulLifeYears;
                            pf.depreciationMethod = quickDepMethod;
                            pf.usefulLifeStartDate = quickUsefulLifeStartDate;
                          }
                        }
                      }
                    } else if (quickType === 'receipt') {
                      pf.debitAccount = quickPayment === 'cash' ? "" : "";
                      pf.creditAccount = quickReceivableAccountId || "";
                      if (quickPayment === 'cash') pf.bankAccountId = String(quickBankId || "");
                    } else if (quickType === 'liability') {
                      pf.debitAccount = quickPayableAccountId || "";
                      pf.creditAccount = "";
                      pf.bankAccountId = String(quickBankId || "");
                      pf.paymentMethod = 'bank';
                    }
                    setPrefillData(pf);
                    setNewFlowOpen(false);
                    setOpen(true);
                  }}>Next</Button>
                </DialogFooter>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={allocationOpen} onOpenChange={setAllocationOpen}>
          <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>EXpense and income allocation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={allocDate} onChange={(e) => setAllocDate(e.target.value)} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={allocType} onValueChange={(v: any) => setAllocType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input readOnly value={String(Math.abs(Number(allocationTx?.total_amount || 0)))} />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={allocDesc} onChange={(e) => setAllocDesc(e.target.value)} placeholder="Enter description for approval" />
              </div>
            </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Payment Method</Label>
                  <Select value={allocPayment} onValueChange={(v: any) => setAllocPayment(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="accrual">Accrual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {allocPayment === 'cash' && (
                  <div>
                    <Label>Bank</Label>
                    <Select value={allocBankId} onValueChange={(v: any) => setAllocBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {banks.map(b => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.bank_name} ({b.account_number})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>VAT</Label>
                  <Select value={allocVatOn} onValueChange={(v: any) => setAllocVatOn(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>VAT Rate (%)</Label>
                  <Input type="number" min="0" max="100" value={allocVatRate} onChange={(e) => setAllocVatRate(e.target.value)} disabled={allocVatOn === 'no'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{allocType === 'income' ? 'Income Account' : 'Expense Account'}</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input placeholder="Search account" value={allocAccountSearch} onChange={(e) => setAllocAccountSearch(e.target.value)} />
                  </div>
                  <Select value={allocAccountId} onValueChange={(v: any) => setAllocAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {(allocType === 'income' ? coaIncome : coaExpense)
                        .filter(a => {
                          const q = allocAccountSearch.toLowerCase();
                          if (!q) return true;
                          return String(a.account_name || '').toLowerCase().includes(q) || String(a.account_code || '').toLowerCase().includes(q);
                        })
                        .map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.account_code} - {a.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {allocPayment === 'accrual' && (
                  <div>
                    <Label>Settlement</Label>
                    <Select value={allocSettlement} onValueChange={(v: any) => setAllocSettlement(v)} disabled>
                      <SelectTrigger disabled><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receivable">Receivable</SelectItem>
                        <SelectItem value="payable">Payable</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {allocPayment === 'accrual' && (
                <div>
                  <Label>{allocSettlement === 'receivable' ? 'Receivable Account' : allocSettlement === 'payable' ? 'Payable Account' : 'Other Account'}</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input placeholder="Search account" value={allocSettlementSearch} onChange={(e) => setAllocSettlementSearch(e.target.value)} />
                  </div>
                  <Select value={allocSettlementAccountId} onValueChange={(v: any) => setAllocSettlementAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {(allocSettlement === 'receivable' ? coaReceivable : allocSettlement === 'payable' ? coaPayable : coaOther)
                        .filter(a => {
                          const q = allocSettlementSearch.toLowerCase();
                          if (!q) return true;
                          return String(a.account_name || '').toLowerCase().includes(q) || String(a.account_code || '').toLowerCase().includes(q);
                        })
                        .map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.account_code} - {a.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAllocationOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  if (allocPayment === 'cash' && !allocBankId) return;
                  if (!allocAccountId) return;
                  if (allocPayment === 'accrual' && !allocSettlementAccountId) return;
              const txId = String(allocationTx?.id || '');
              if (!txId) return;
              const isIncome = allocType === 'income';
              const total = Math.abs(Number(allocationTx?.total_amount || 0));
              let debitAccount = '';
              let creditAccount = '';
                  if (allocPayment === 'cash') {
                    if (isIncome) { debitAccount = ''; creditAccount = allocAccountId; }
                    else { debitAccount = allocAccountId; creditAccount = ''; }
                  } else {
                    const settleId = allocSettlementAccountId;
                    if (isIncome) { debitAccount = settleId; creditAccount = allocAccountId; }
                    else { debitAccount = allocAccountId; creditAccount = settleId; }
                  }

                  const rate = allocVatOn === 'yes' ? Number(allocVatRate || '0') : 0;
                  const isPurchase = allocType === 'expense';
                  const vatAmount = rate > 0 ? ((total * rate) / (100 + rate)) : 0;
                  const netAmount = rate > 0 ? (total - vatAmount) : total;

                  if (rate > 0 && vatAmount > 0) {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        const { data: profile } = await supabase
                          .from('profiles')
                          .select('company_id')
                          .eq('user_id', user.id)
                          .single();
                        const companyId = (profile as any)?.company_id;
                        if (companyId) {
                          const { data: vatAccounts } = await supabase
                            .from('chart_of_accounts')
                            .select('id, account_name, account_code, account_type')
                            .eq('company_id', companyId)
                            .or('account_name.ilike.%vat%,account_name.ilike.%tax%');
                          const hasVat = (vatAccounts || []).length > 0;
                          if (!hasVat) {
                            if (isIncome) {
                              await supabase
                                .from('chart_of_accounts')
                                .insert({ company_id: companyId, account_code: '2100', account_name: 'VAT Output', account_type: 'liability', is_active: true });
                            } else {
                              await supabase
                                .from('chart_of_accounts')
                                .insert({ company_id: companyId, account_code: '1400', account_name: 'VAT Input', account_type: 'asset', is_active: true });
                            }
                          }
                        }
                      }
                    } catch {}
                  }

                  const { error: upErr } = await supabase
                    .from('transactions')
                  .update({
                    transaction_date: allocDate,
                    description: String(allocDesc || '').trim() || (allocationTx?.description || null),
                    bank_account_id: allocPayment === 'cash' ? allocBankId : null,
                    debit_account_id: debitAccount || null,
                    credit_account_id: creditAccount || null,
                    vat_rate: rate > 0 ? rate : null,
                    vat_amount: vatAmount > 0 ? vatAmount : null,
                    base_amount: netAmount,
                    vat_inclusive: (allocVatOn === 'yes')
                  })
                  .eq('id', txId);
                  if (upErr) throw upErr;

                  await setTransactionStatus(txId, 'approved');
                  setAllocationOpen(false);
                  toast({ title: 'Success', description: 'Transaction posted/allocated' });
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message || 'Failed to allocate', variant: 'destructive' });
                }
              }} disabled={posting}>
                {posting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</>) : (<>Continue</>)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {/* Advanced Control Panel */}
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
          {/* Source Filters (Pills) */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Transactions', icon: Filter },
              { id: 'invoice', label: 'Invoices', icon: FileText },
              { id: 'bank', label: 'Bank', icon: Wallet },
              { id: 'csv', label: 'CSV Import', icon: FileSpreadsheet },
              { id: 'purchase', label: 'Purchases', icon: ShoppingCart },
              { id: 'manual', label: 'Manual', icon: Edit },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSourceTab(tab.id as any)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 border select-none",
                  sourceTab === tab.id 
                    ? "bg-primary text-primary-foreground border-primary shadow-md" 
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
              >
                 <tab.icon className="h-3.5 w-3.5" />
                 <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="h-px bg-border/50" />

          {/* Filters Toolbar */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search description or ref..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-9 bg-background/50 focus:bg-background transition-colors h-9" 
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
                 <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[110px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="unposted">Unposted</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-md border h-9">
                     <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                     <Input 
                       type="date" 
                       value={dateFrom} 
                       onChange={(e) => setDateFrom(e.target.value)} 
                       className="w-auto h-7 border-none bg-transparent shadow-none focus-visible:ring-0 px-1 text-xs"
                     />
                     <span className="text-muted-foreground text-xs">-</span>
                     <Input 
                       type="date" 
                       value={dateTo} 
                       onChange={(e) => setDateTo(e.target.value)} 
                       className="w-auto h-7 border-none bg-transparent shadow-none focus-visible:ring-0 px-1 text-xs"
                     />
                     {(dateFrom || dateTo) && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full hover:bg-muted" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                           <XCircle className="h-3 w-3" />
                        </Button>
                     )}
                  </div>
              </div>
              
              <div className="flex items-center gap-2 ml-auto lg:ml-0">
                 <Button variant="outline" className="gap-2 h-9" onClick={handleExport}>
                   <Download className="h-3.5 w-3.5" />
                   Export
                 </Button>
                 <Button className="bg-gradient-primary hover:opacity-90 gap-2 h-9" onClick={() => { setEditData(null); setNewFlowOpen(true); }}>
                   <Plus className="h-4 w-4" />
                   New Transaction
                 </Button>
               </div>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader className="px-6 py-4 border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Manage and review your financial records. You have {totalCount} total transactions.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">
              Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
              <TableHeader className="bg-muted/5">
                <TableRow>
                  <TableHead className="w-32 pl-6"><Button variant="ghost" className="gap-1 p-0 h-auto font-medium hover:bg-transparent hover:text-primary">Date <ArrowUpDown className="h-3 w-3" /></Button></TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Bank</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="text-right w-32">Amount</TableHead>
                  <TableHead className="text-right w-24">VAT</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-20 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.filtered.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                       No transactions found.
                     </TableCell>
                   </TableRow>
                ) : derived.filtered.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="font-medium pl-6"><div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" />{transaction.date}</div></TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-foreground/90">{transaction.description}</span>
                        <span className="text-xs text-muted-foreground">{transaction.reference}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{transaction.bank}</TableCell>
                    <TableCell>
                       <Badge variant="outline" className={cn(
                          "font-normal",
                          transaction.type === "Income" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-rose-200 text-rose-700 bg-rose-50"
                       )}>
                          {transaction.type}
                       </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{transaction.category}</TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      <span className={transaction.type === "Income" ? "text-emerald-600" : "text-rose-600"}>
                        {transaction.type === "Income" ? "+" : "-"} R {transaction.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {transaction.vatAmount > 0 ? `R ${transaction.vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : "-"}
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", 
                             (transaction as any).statusKey === "approved" ? "bg-emerald-500" : 
                             (transaction as any).statusKey === "pending" ? "bg-amber-500" : 
                             (transaction as any).statusKey === "rejected" ? "bg-rose-500" : "bg-slate-300"
                          )} />
                          <span className="text-sm capitalize">{(transaction as any).statusLabel}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 opacity-70 hover:opacity-100">
                              <span className="sr-only">Open menu</span>
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            {(transaction.statusKey === "pending" || transaction.statusKey === "unposted") && (
                              <>
                <DropdownMenuItem onClick={() => {
                  const full = items.find(i => i.id === transaction.id) || null;
                  setAllocationTx(full);
                  const amt = Number(full?.total_amount || 0);
                  const isIncome = amt >= 0;
                                  setAllocType(isIncome ? 'income' : 'expense');
                                  setAllocDate(String(full?.transaction_date || new Date().toISOString().slice(0,10)));
                                  const hasBank = Boolean(full?.bank_account_id);
                                  setAllocPayment(hasBank ? 'cash' : 'accrual');
                                  setAllocBankId(String(full?.bank_account_id || ''));
                                  const vatRate = Number((full as any)?.vat_rate || 0);
                                  const vatAmount = Number((full as any)?.vat_amount || 0);
                                  setAllocVatOn(vatRate > 0 || vatAmount > 0 ? 'yes' : 'no');
                                  setAllocVatRate(String(vatRate || 0));
                                  setAllocSettlement(isIncome ? 'receivable' : 'payable');
                  setAllocSettlementAccountId('');
                  setAllocAccountId('');
                  setAllocDesc(String(full?.description || ''));
                  setAllocationOpen(true);
                }} disabled={posting}>
                                  {posting ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      <span>Posting…</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="mr-2 h-4 w-4 text-emerald-500" />
                                      <span>Approve</span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTransactionStatus(transaction.id, 'rejected')}>
                                  <XCircle className="mr-2 h-4 w-4 text-rose-500" />
                                  <span>Reject</span>
                                </DropdownMenuItem>
                              </>
                            )}
                            {transaction.statusKey === "approved" && (
                              <DropdownMenuItem onClick={() => setTransactionStatus(transaction.id, 'pending')}>
                                <XCircle className="mr-2 h-4 w-4 text-amber-500" />
                                <span>Unapprove</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { 
                              const full = items.find(i => i.id === transaction.id);
                              setPendingEditData(full || transaction);
                              setEditWarningOpen(true);
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                               toast({ title: "Not implemented", description: "Duplicate feature coming soon" });
                            }}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Duplicate</span>
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => {
                               const full = items.find(i => i.id === transaction.id);
                               setViewDetailsData(full || transaction);
                               setViewDetailsOpen(true);
                            }}>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => {
                               const full = items.find(i => i.id === transaction.id);
                               setAttachmentsData(full || transaction);
                               setAttachmentsOpen(true);
                            }}>
                              <Paperclip className="mr-2 h-4 w-4" />
                              <span>Attachments</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => initiateDelete(transaction.id)} className="text-rose-500 focus:text-rose-500">
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                  </TableRow>
                ))}
              </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between p-4 border-t">
          <div className="text-sm text-muted-foreground">
             Showing {items.length} of {totalCount} entries
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPage(0); setPageSize(parseInt(v)); }}>
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
               <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
               <Button variant="outline" size="sm" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Warning Dialog */}
      <Dialog open={editWarningOpen} onOpenChange={setEditWarningOpen}>
        <DialogContent className="sm:max-w-[425px] text-center">
           <DialogHeader className="flex flex-col items-center gap-4">
             <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Logo" className="h-16 w-auto object-contain" />
             <DialogTitle className="text-xl">Expert Mode Warning</DialogTitle>
             <DialogDescription className="text-base pt-2">
               Editing a transaction requires accounting knowledge. You will need to manually adjust debit and credit entries.
               <br/><br/>
               Incorrect changes may affect your trial balance. Proceed with caution.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter className="flex sm:justify-center gap-2 mt-4 w-full">
             <Button variant="outline" onClick={() => setEditWarningOpen(false)} className="w-full sm:w-auto">Cancel</Button>
             <Button onClick={() => {
               setEditData(pendingEditData);
               setEditWarningOpen(false);
               setOpen(true);
             }} className="w-full sm:w-auto bg-primary">
               Continue to Edit
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {viewDetailsData && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <div className="font-medium">{viewDetailsData.transaction_date || viewDetailsData.date}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reference</Label>
                  <div className="font-medium">{viewDetailsData.reference_number || viewDetailsData.reference || '—'}</div>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <div className="font-medium">{viewDetailsData.description}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <div className="font-medium">R {Number(viewDetailsData.total_amount || viewDetailsData.amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <Badge variant="outline">{viewDetailsData.transaction_type || viewDetailsData.type || 'Transaction'}</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={viewDetailsData.status === 'approved' ? 'default' : 'secondary'}>
                    {viewDetailsData.status || 'Pending'}
                  </Badge>
                </div>
                <div>
                   <Label className="text-muted-foreground">Bank Account</Label>
                   <div className="font-medium">{(viewDetailsData.bank_account?.bank_name || viewDetailsData.bank || '—')}</div>
                </div>
              </div>

              {viewDetailsData.entries && viewDetailsData.entries.length > 0 && (
                <div className="mt-4">
                  <Label className="mb-2 block text-muted-foreground">Journal Entries</Label>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewDetailsData.entries.map((e: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{e.chart_of_accounts?.account_name || 'Unknown Account'}</TableCell>
                            <TableCell className="text-right">{Number(e.debit) > 0 ? `R ${Number(e.debit).toFixed(2)}` : '-'}</TableCell>
                            <TableCell className="text-right">{Number(e.credit) > 0 ? `R ${Number(e.credit).toFixed(2)}` : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachments Dialog */}
      <Dialog open={attachmentsOpen} onOpenChange={setAttachmentsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Attachments</DialogTitle>
            <DialogDescription>Manage files associated with this transaction</DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center border-2 border-dashed rounded-lg bg-muted/10">
             <Paperclip className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
             <p className="text-sm text-muted-foreground mb-2">No attachments found for this transaction.</p>
             <Button variant="outline" onClick={() => toast({ title: "Upload", description: "File upload not yet connected to storage." })}>
               <Plus className="h-4 w-4 mr-2" />
               Add Attachment
             </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setAttachmentsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Delete Transaction
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action cannot be undone. Deleting a transaction will remove all associated ledger entries and may affect your financial reports.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
             <div className="p-3 bg-rose-50 border border-rose-100 rounded-md text-rose-800 text-sm font-medium">
               Warning: This will cause unreliable reports if the transaction has already been reconciled or reported.
             </div>
             <div className="space-y-2">
               <Label>To confirm, type: <span className="font-mono font-bold select-all">Are you sure that this will cause unreliable report?</span></Label>
               <Input 
                 value={deleteConfirmText} 
                 onChange={(e) => setDeleteConfirmText(e.target.value)} 
                 placeholder="Type the confirmation phrase"
                 className="border-rose-200 focus-visible:ring-rose-500"
               />
             </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteConfirmText !== "Are you sure that this will cause unreliable report?"}
            >
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
