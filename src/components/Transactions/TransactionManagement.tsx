import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useLocation } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Download, Edit, Trash2, Receipt, ArrowUpDown, Calendar, CheckCircle, XCircle, MoreHorizontal } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
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
      setTotalCount(typeof count === 'number' ? count : (data?.length || 0));
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, filterType, filterStatus, sourceTab, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(0); }, [searchTerm, filterType, filterStatus, sourceTab, pageSize]);

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
          vatRate: "0",
          paymentMethod,
          depreciationMethod,
          usefulLifeYears
        };
        setPrefillData(prefill);
        setEditData(null);
        setHeadless(false);
        setOpen(true);
        return;
      }
    } catch {}
  }, [location.search]);

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
        // Prefer posted VAT from entries
        const vatFromEntries = (t.entries || []).reduce((sum: number, e: any) => {
          const name = String(e.chart_of_accounts?.account_name || '').toLowerCase();
          if (!name.includes('vat')) return sum;
          return sum + Math.abs(Number(e.debit || 0) - Number(e.credit || 0));
        }, 0);
        const vaStored = (t as any).vat_amount;
        const ratePct = Number((t as any).vat_rate) || 0;
        const r = ratePct / 100;
        const vat = vatFromEntries > 0
          ? vatFromEntries
          : (typeof vaStored === 'number' && !Number.isNaN(vaStored))
            ? Math.abs(vaStored)
            : (base > 0 && r > 0) ? Math.abs(base * r) : 0;
        const net = base > 0 ? base : Math.max(0, total - vat);
        return Math.abs(net);
      })(),
      vatAmount: (() => {
        const vatFromEntries = (t.entries || []).reduce((sum: number, e: any) => {
          const name = String(e.chart_of_accounts?.account_name || '').toLowerCase();
          if (!name.includes('vat')) return sum;
          return sum + Math.abs(Number(e.debit || 0) - Number(e.credit || 0));
        }, 0);
        if (vatFromEntries > 0) return vatFromEntries;
        const va = (t as any).vat_amount;
        if (typeof va === 'number' && !Number.isNaN(va)) return Math.abs(va);
        const ratePct = Number((t as any).vat_rate) || 0;
        const r = ratePct / 100;
        const base = Number((t as any).base_amount) || 0;
        if (r > 0 && base > 0) return Math.abs(base * r);
        return 0;
      })(),
      reference: t.reference_number || "—",
      statusKey: t.status, // raw DB status
      statusLabel: t.status === 'approved' ? 'Approved' : t.status === 'pending' ? 'Pending' : t.status.charAt(0).toUpperCase() + t.status.slice(1),
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
            const { data: bankAcc } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccountId).maybeSingle();
            if (bankAcc && typeof bankAcc.current_balance === 'number') {
              const newBal = Number(bankAcc.current_balance) + bankDebitAmount;
              await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', bankAccountId);
            }
          } else if (isCreditBank && bankCreditAmount > 0) {
            try { await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: bankCreditAmount, _operation: 'subtract' }); } catch {}
            const { data: bankAcc } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccountId).maybeSingle();
            if (bankAcc && typeof bankAcc.current_balance === 'number') {
              const newBal = Number(bankAcc.current_balance) - bankCreditAmount;
              await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', bankAccountId);
            }
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
    }
  };

  const deleteTransaction = async (id: string) => {
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
        <Button className="bg-gradient-primary hover:opacity-90" onClick={() => { setEditData(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Transaction
        </Button>
        
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
      </div>

      <div className="flex justify-between items-center">
        <Tabs defaultValue="all" onValueChange={(v) => setSourceTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="invoice">Invoices</TabsTrigger>
            <TabsTrigger value="csv">CSV</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary cards removed for a cleaner, list-focused layout */}

      <div className="p-4 rounded-md border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search transactions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unposted">Unposted</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" />Export</Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Transactions ({totalCount})</h2>
        </div>
        <div className="rounded-md border">
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32"><Button variant="ghost" className="gap-1 p-0 h-auto font-medium">Date <ArrowUpDown className="h-3 w-3" /></Button></TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32">Bank</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-32">Category</TableHead>
                  <TableHead className="text-right w-32">Amount</TableHead>
                  <TableHead className="text-right w-24">VAT</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-40">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derived.filtered.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{transaction.date}</div></TableCell>
                    <TableCell><div><div className="font-medium">{transaction.description}</div><div className="text-sm text-muted-foreground">{transaction.reference}</div></div></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{transaction.bank}</TableCell>
                    <TableCell><Badge variant={transaction.type === "Income" ? "default" : "secondary"} className={transaction.type === "Income" ? "bg-primary" : ""}>{transaction.type}</Badge></TableCell>
                    <TableCell className="text-sm">{transaction.category}</TableCell>
                    <TableCell className="text-right font-mono"><span className={transaction.type === "Income" ? "text-primary" : "text-muted-foreground"}>R {transaction.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></TableCell>
                    <TableCell className="text-right font-mono text-sm">R {transaction.vatAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell><Badge variant={(transaction as any).statusKey === "approved" ? "default" : "outline"} className={(transaction as any).statusKey === "approved" ? "bg-primary" : ""}>{(transaction as any).statusLabel}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(transaction.statusKey === "pending" || transaction.statusKey === "unposted") && (
                              <>
                                <DropdownMenuItem onClick={() => { 
                                  const full = items.find(i => i.id === transaction.id);
                                  setEditData(full || transaction);
                                  setOpen(true);
                                }}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  <span>Approve</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTransactionStatus(transaction.id, 'rejected')}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  <span>Reject</span>
                                </DropdownMenuItem>
                              </>
                            )}
                            {transaction.statusKey === "approved" && (
                              <DropdownMenuItem onClick={() => setTransactionStatus(transaction.id, 'pending')}>
                                <XCircle className="mr-2 h-4 w-4" />
                                <span>Unapprove</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { 
                              const full = items.find(i => i.id === transaction.id);
                              setEditData(full || transaction);
                              setOpen(true); 
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteTransaction(transaction.id)}>
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
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Showing {items.length} of {totalCount}
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(pageSize)} onValueChange={(v) => { setPage(0); setPageSize(parseInt(v)); }}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
            <Button variant="outline" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
