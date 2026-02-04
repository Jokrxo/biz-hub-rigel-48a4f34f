import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { transactionsApi } from "@/lib/transactions-api";
import { TransactionFormEnhanced } from "@/components/Transactions/TransactionFormEnhanced";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import { Download, Mail, Plus, Trash2, FileText, MoreHorizontal, CheckCircle2, Clock, AlertTriangle, DollarSign, FilePlus, ArrowRight, Check, History, Upload, Loader2 } from "lucide-react";
import { exportInvoiceToPDF, buildInvoicePDF, addLogoToPDF, fetchLogoDataUrl, type InvoiceForPDF, type InvoiceItemForPDF, type CompanyForPDF } from '@/lib/invoice-export';
import { exportInvoicesToExcel } from '@/lib/export-utils';
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
  amount_paid?: number;
  sent_at?: string | null;
  paid_at?: string | null;
}

export const SalesInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceTypeDialogOpen, setInvoiceTypeDialogOpen] = useState(false);
  const [invoicePaymentMode, setInvoicePaymentMode] = useState<'cash' | 'credit' | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isAccountant } = useRoles();
  const todayStr = new Date().toISOString().split("T")[0];
  const [posting, setPosting] = useState(false);
  const [lastPosting, setLastPosting] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    notes: "",
    items: [{ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
  });

  // Send dialog state (inside component)
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState<string>('');
  const [sendMessage, setSendMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [companyEmail, setCompanyEmail] = useState<string>('');

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  const [sentDialogOpen, setSentDialogOpen] = useState(false);
  const [sentDate, setSentDate] = useState<string>(todayStr);
  const [sentInvoice, setSentInvoice] = useState<any>(null);
  const [sentIncludeVAT, setSentIncludeVAT] = useState<boolean>(true);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalEditData, setJournalEditData] = useState<any>(null);

  // Credit Note / Adjustment State
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [invoiceToCredit, setInvoiceToCredit] = useState<any>(null);
  const [creditReason, setCreditReason] = useState("");
  const [isCrediting, setIsCrediting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!profile) return;
      const { data: customersData } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("name");
      setCustomers(customersData || []);
      const { data: productsData } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("item_type", "product")
        .order("name");
      setProducts(productsData || []);
      const { data: servicesData } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("item_type", "service")
        .order("name");
      setServices(servicesData || []);
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
      try {
        await (supabase as any).rpc('backfill_invoice_postings', { _company_id: profile.company_id });
        await (supabase as any).rpc('refresh_afs_cache', { _company_id: profile.company_id });
      } catch {}
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);
  useEffect(() => {
    loadData();

    // Real-time updates
    const channel = supabase
      .channel('invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    const loadCompanyEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile?.company_id) return;
      const { data: company } = await supabase
        .from('companies')
        .select('email')
        .eq('id', profile.company_id)
        .maybeSingle();
      setCompanyEmail((company as any)?.email || '');
    };
    loadCompanyEmail();
  }, []);

  const handleConfirmSent = async () => {
    if (!sentInvoice) return;
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date(sentDate).toISOString() })
        .eq("id", sentInvoice.id);
      if (error) throw error;
      await openJournalForSent(sentInvoice, sentDate, sentIncludeVAT);
      toast({ title: "Success", description: "Opening transaction form to post Debtors (AR), Revenue and VAT; plus COGS/Inventory if applicable" });
      setSentDialogOpen(false);
      setSentInvoice(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const updateItemProduct = (index: number, productId: string) => {
    const product = products.find((p: any) => String(p.id) === String(productId));
    const service = services.find((s: any) => String(s.id) === String(productId));
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], product_id: productId };
    const picked = product || service;
    if (picked) {
      const name = (picked.name ?? picked.description ?? '').toString();
      newItems[index].description = name;
      if (typeof picked.unit_price === 'number') {
        newItems[index].unit_price = picked.unit_price;
      }
    }
    setFormData({ ...formData, items: newItems });
  };

  // Apply selected customer to form (name and email)
  const applyCustomerSelection = (customerId: string) => {
    const selected = customers.find((c: any) => String(c.id) === String(customerId));
    if (selected) {
      setFormData(prev => ({
        ...prev,
        customer_id: selected.id,
        customer_name: selected.name,
        customer_email: selected.email ?? "",
      }));
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    formData.items.forEach(item => {
      const amount = item.quantity * item.unit_price;
      subtotal += amount;
      taxAmount += amount * (item.tax_rate / 100);
    });

    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isAccountant) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }
    if (!formData.customer_name) {
      toast({ title: "Customer required", description: "Please select a customer.", variant: "destructive" });
      return;
    }
    if (formData.items.some((it: any) => !it.product_id)) {
      toast({ title: "Product required", description: "Please select a product for each item.", variant: "destructive" });
      return;
    }
    if (formData.items.some((it: any) => (Number(it.quantity) || 0) <= 0)) {
      toast({ title: "Invalid quantity", description: "Each item must have quantity > 0.", variant: "destructive" });
      return;
    }
    // Validate stock availability against loaded products
    for (const it of formData.items) {
      const prod = products.find((p: any) => String(p.id) === String(it.product_id));
      const svc = services.find((s: any) => String(s.id) === String(it.product_id));
      if (svc) continue;
      const available = Number(prod?.quantity_on_hand ?? 0);
      const requested = Number(it.quantity ?? 0);
      if (!prod) {
        toast({ title: "Product not found", description: "Selected product no longer exists.", variant: "destructive" });
        return;
      }
      if (requested > available) {
        toast({ title: "Insufficient stock", description: `Requested ${requested}, available ${available} for ${prod.name}.`, variant: "destructive" });
        return;
      }
    }
    // Date validation: invoice_date must be today or earlier; due_date (if provided) must be >= invoice_date
    const invDate = new Date(formData.invoice_date);
    const dueDate = formData.due_date ? new Date(formData.due_date) : null;
    const today = new Date(todayStr);
    if (isNaN(invDate.getTime())) {
      toast({ title: "Invalid date", description: "Invoice date is not valid.", variant: "destructive" });
      return;
    }
    if (invDate > today) {
      toast({ title: "Invalid invoice date", description: "Invoice date cannot be in the future.", variant: "destructive" });
      return;
    }
    if (dueDate && dueDate < invDate) {
      toast({ title: "Invalid due date", description: "Due date cannot be earlier than invoice date.", variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    try {
      setIsSubmitting(true);
      setProgress(10);
      setProgressText("Creating Invoice...");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const totals = calculateTotals();

      let invoice;
      try {
        const { data, error } = await supabase
          .from("invoices")
          .insert({
            company_id: profile!.company_id,
            invoice_number: invoiceNumber,
            customer_id: formData.customer_id,
            customer_name: formData.customer_name,
            customer_email: formData.customer_email || null,
            invoice_date: formData.invoice_date,
            due_date: formData.due_date || null,
            subtotal: totals.subtotal,
            tax_amount: totals.taxAmount,
            total_amount: totals.total,
            notes: formData.notes || null,
            status: "draft",
            user_id: user?.id
          })
          .select()
          .single();

        if (error) throw error;
        invoice = data;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("schema cache") || msg.includes("column")) {
          // Retry without customer_id
          const { data, error: retryError } = await supabase
            .from("invoices")
            .insert({
              company_id: profile!.company_id,
              invoice_number: invoiceNumber,
              customer_name: formData.customer_name,
              customer_email: formData.customer_email || null,
              invoice_date: formData.invoice_date,
              due_date: formData.due_date || null,
              subtotal: totals.subtotal,
              tax_amount: totals.taxAmount,
              total_amount: totals.total,
              notes: formData.notes || null,
              status: "draft",
              user_id: user?.id
            })
            .select()
            .single();
          
          if (retryError) throw retryError;
          invoice = data;
          toast({ title: "Warning", description: "Invoice saved, but customer link is incomplete due to connection issues. Please refresh the page." });
        } else {
          throw err;
        }
      }

      setProgress(40);
      setProgressText("Saving Invoice Items...");
      await new Promise(r => setTimeout(r, 400));

      // Create invoice items
      const items = formData.items.map(item => ({
        invoice_id: invoice.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        item_type: services.find((s: any) => String(s.id) === String(item.product_id)) ? 'service' : 'product'
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items);

      if (itemsError) throw itemsError;

      setProgress(70);
      setProgressText("Updating Inventory...");
      await new Promise(r => setTimeout(r, 400));

      // Decrease stock for each product item
      for (const it of formData.items) {
        const prod = products.find((p: any) => String(p.id) === String(it.product_id));
        const svc = services.find((s: any) => String(s.id) === String(it.product_id));
        if (!prod || svc) continue;
        const currentQty = Number(prod.quantity_on_hand ?? 0);
        const newQty = currentQty - Number(it.quantity ?? 0);
        const { error: stockError } = await supabase
          .from("items")
          .update({ quantity_on_hand: newQty })
          .eq("id", prod.id);
        if (stockError) throw stockError;
      }

      setProgress(100);
      setProgressText("Finalizing...");
      await new Promise(r => setTimeout(r, 600));

      setSuccessMessage("Invoice created successfully");
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsSubmitting(false);
      }, 2000);
      
      // If cash sale: post issuance (AR/Revenue/VAT & COGS), mark sent, then open payment dialog
      try {
        if (invoicePaymentMode === 'cash') {
          await transactionsApi.postInvoiceSentClient(invoice, formData.invoice_date);
          await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id);
          const totalsNow = totals;
          setPaymentInvoice({ ...invoice, _payment_amount: totalsNow.total, _cash_sale: true });
          setPaymentDate(todayStr);
          setPaymentAmount(totalsNow.total);
          const companyId = await getCompanyId();
          if (companyId) {
            const list = await loadBankAccounts(companyId);
            if (!list || list.length === 0) {
              toast({ title: "No bank accounts", description: "Add a bank account in the Bank module before posting payment.", variant: "destructive" });
            } else {
              setSelectedBankId("");
              setPaymentDialogOpen(true);
            }
          } else {
            setPaymentDialogOpen(true);
          }
        }
      } catch {}
      setInvoicePaymentMode(null);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsSubmitting(false);
      setDialogOpen(true);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: "",
      customer_name: "",
      customer_email: "",
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: "",
      notes: "",
      items: [{ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
    });
  };

  const getCompanyId = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user?.id)
      .maybeSingle();
    return profile?.company_id as string;
  };

  const loadAccounts = async (companyId: string) => {
    try { await (supabase as any).rpc('ensure_core_accounts', { _company_id: companyId }); } catch {}
    const { data } = await supabase
      .from("chart_of_accounts")
      .select("id, account_name, account_type, account_code")
      .eq("company_id", companyId)
      .eq("is_active", true);
    return (data || []) as Array<{ id: string; account_name: string; account_type: string; account_code: string }>;
  };

  const loadBankAccounts = async (companyId: string) => {
    const { data } = await supabase
      .from("bank_accounts")
      .select("id,bank_name,account_name,account_number")
      .eq("company_id", companyId)
      .order("bank_name");
    const list = data || [];
    setBankAccounts(list);
    return list;
  };

  const findAccountByCodeOrName = (
    accounts: Array<{ id: string; account_name: string; account_type: string; account_code: string }>,
    type: string,
    codes: string[],
    names: string[]
  ) => {
    const lower = accounts.map(a => ({
      ...a,
      account_name: (a.account_name || "").toLowerCase(),
      account_type: (a.account_type || "").toLowerCase(),
      account_code: (a.account_code || "").toString()
    }));
    const byType = lower.filter(a => a.account_type === type.toLowerCase());
    const byCode = byType.find(a => codes.includes((a.account_code || "").toString()));
    if (byCode) return byCode.id;
    const byName = byType.find(a => names.some(k => a.account_name.includes(k)));
    return byName?.id || byType[0]?.id || null;
  };

  const ensureNoDuplicatePosting = async (companyId: string, reference: string) => {
    const { data: txs } = await supabase
      .from("transactions")
      .select("id")
      .eq("company_id", companyId)
      .eq("reference_number", reference);
    const ids = (txs || []).map(t => t.id);
    if (ids.length === 0) return true;
    const { count } = await supabase
      .from("transaction_entries")
      .select("id", { count: 'exact', head: true })
      .in("transaction_id", ids);
    return (count || 0) === 0;
  };

  const insertEntries = async (
    companyId: string,
    txId: string,
    entryDate: string,
    description: string,
    rows: Array<{ account_id: string; debit: number; credit: number }>
  ) => {
    const txEntries = rows.map(r => ({ transaction_id: txId, account_id: r.account_id, debit: r.debit, credit: r.credit, description, status: "approved" }));
    const { error: teErr } = await supabase.from("transaction_entries").insert(txEntries);
    if (teErr) throw teErr;
  };

  const postInvoiceSent = async (inv: any, postDateStr?: string) => {
    try {
      setPosting(true);
      setIsSubmitting(true);
      setProgress(10);
      setProgressText("Posting Invoice to Ledger...");

      const postDate = postDateStr || inv.invoice_date;
      // Post full AR/Revenue/VAT and COGS/Inventory via client to guarantee all four accounts
      await transactionsApi.postInvoiceSentClient(inv, postDate);
      
      setProgress(70);
      setProgressText("Updating Financial Statements...");
      await new Promise(r => setTimeout(r, 600));

      const companyId = await getCompanyId();
      if (companyId) {
        try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
      }
      
      setProgress(100);
      setProgressText("Posted Successfully");
      await new Promise(r => setTimeout(r, 400));

      toast({ title: "Success", description: `Posted invoice ${inv.invoice_number}: Dr Receivable | Cr Revenue, Cr VAT; Dr COGS | Cr Inventory` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to post Sent invoice', variant: 'destructive' });
    } finally {
      setPosting(false);
      setIsSubmitting(false);
    }
  };

  const openJournalForSent = async (inv: any, postDateStr?: string, includeVAT?: boolean) => {
    const companyId = await getCompanyId();
    if (!companyId) return;
    try { await (supabase as any).rpc('ensure_core_accounts', { _company_id: companyId }); } catch {}
    let accounts = await loadAccounts(companyId);
    const pick = (
      type: string,
      codes: string[],
      names: string[]
    ) => {
      const id = findAccountByCodeOrName(accounts, type, codes, names);
      if (id) return id;
      const lower = accounts.map(a => ({
        ...a,
        account_type: (a.account_type || '').toLowerCase(),
        account_name: (a.account_name || '').toLowerCase(),
        account_code: (a.account_code || '').toString(),
      }));
      const byType = lower.filter(a => a.account_type === type.toLowerCase());
      return byType[0]?.id || null;
    };
    let arId = pick('asset', ['1200'], ['receiv','debtors','accounts receiv']);
    let revId = pick('income', ['4000'], ['sales revenue','revenue','sales','income']);
    if (!arId) {
      const { data } = await supabase
        .from('chart_of_accounts')
        .insert({ company_id: companyId, account_code: '1200', account_name: 'Accounts Receivable', account_type: 'asset', is_active: true })
        .select('id')
        .single();
      arId = (data as any)?.id || arId;
      accounts = await loadAccounts(companyId);
    }
    if (!revId) {
      const { data } = await supabase
        .from('chart_of_accounts')
        .insert({ company_id: companyId, account_code: '4000', account_name: 'Sales Revenue', account_type: 'income', is_active: true })
        .select('id')
        .single();
      revId = (data as any)?.id || revId;
      accounts = await loadAccounts(companyId);
    }
    const amount = Number(inv.total_amount || inv.subtotal || 0);
    const net = Number(inv.subtotal || 0);
    const vat = Number(inv.tax_amount || 0);
    const rate = net > 0 ? ((vat / net) * 100) : 0;
    const editData = {
      id: null,
      transaction_date: postDateStr || inv.invoice_date,
      description: `Invoice ${inv.invoice_number || inv.id} issued`,
      reference_number: inv.invoice_number || null,
      transaction_type: 'income',
      payment_method: 'accrual',
      debit_account_id: arId,
      credit_account_id: revId,
      total_amount: includeVAT ? amount : net,
      vat_rate: includeVAT ? String(rate.toFixed(2)) : '0',
      bank_account_id: null,
      lockType: 'sent',
      customer_id: inv.customer_id || null,
    };
    setJournalEditData(editData);
    setJournalOpen(true);
  };

  const postInvoicePaid = async (inv: any, payDateStr?: string, bankAccountId?: string) => {
    try {
      setPosting(true);
      setIsSubmitting(true);
      setProgress(10);
      setProgressText("Processing Payment...");

      const amt = Number(inv._payment_amount || inv.total_amount || 0);
      try {
        await (supabase as any).rpc('post_invoice_paid', { _invoice_id: inv.id, _payment_date: payDateStr || todayStr, _bank_account_id: bankAccountId, _amount: amt });
      } catch (rpcErr) {
        await transactionsApi.postInvoicePaidClient(inv, payDateStr || todayStr, bankAccountId as string, amt);
      }
      
      setProgress(60);
      setProgressText("Updating Bank Balance...");
      await new Promise(r => setTimeout(r, 600));

      const companyId = await getCompanyId();
      if (companyId) {
        try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
      }

      setProgress(100);
      setProgressText("Payment Recorded");
      await new Promise(r => setTimeout(r, 400));

      toast({ title: "Success", description: `Posted payment for ${inv.invoice_number}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to post payment', variant: 'destructive' });
    } finally {
      setPosting(false);
      setIsSubmitting(false);
    }
  };

  const openJournalForPaid = async (inv: any, payDateStr?: string, bankAccountId?: string, amount?: number) => {
    const companyId = await getCompanyId();
    if (!companyId) return;
    try { await (supabase as any).rpc('ensure_core_accounts', { _company_id: companyId }); } catch {}
    let accounts = await loadAccounts(companyId);
    const pick = (
      type: string,
      codes: string[],
      names: string[]
    ) => {
      const id = findAccountByCodeOrName(accounts, type, codes, names);
      if (id) return id;
      const lower = accounts.map(a => ({
        ...a,
        account_type: (a.account_type || '').toLowerCase(),
        account_name: (a.account_name || '').toLowerCase(),
        account_code: (a.account_code || '').toString(),
      }));
      const byType = lower.filter(a => a.account_type === type.toLowerCase());
      return byType[0]?.id || null;
    };
    let bankLedgerId = pick('asset', ['1100'], ['bank','cash']);
    let arId = pick('asset', ['1200'], ['receiv','debtors','accounts receiv']);
    if (!bankLedgerId) {
      const { data } = await supabase
        .from('chart_of_accounts')
        .insert({ company_id: companyId, account_code: '1100', account_name: 'Bank', account_type: 'asset', is_active: true, is_cash_equivalent: true, financial_statement_category: 'current_asset' })
        .select('id')
        .single();
      bankLedgerId = (data as any)?.id || bankLedgerId;
      accounts = await loadAccounts(companyId);
    }
    if (!arId) {
      const { data } = await supabase
        .from('chart_of_accounts')
        .insert({ company_id: companyId, account_code: '1200', account_name: 'Accounts Receivable', account_type: 'asset', is_active: true })
        .select('id')
        .single();
      arId = (data as any)?.id || arId;
      accounts = await loadAccounts(companyId);
    }
    const amt = Number(amount || inv._payment_amount || inv.total_amount || 0);
    const editData = {
      id: null,
      transaction_date: payDateStr || todayStr,
      description: `${inv._cash_sale ? 'Cash sale ' : ''}Payment for invoice ${inv.invoice_number || inv.id}`,
      reference_number: inv.invoice_number || null,
      transaction_type: 'receipt',
      payment_method: inv._cash_sale ? 'cash' : 'bank',
      bank_account_id: bankAccountId || null,
      debit_account_id: bankLedgerId,
      credit_account_id: arId,
      total_amount: amt,
      lockType: 'paid',
      customer_id: inv.customer_id || null,
    };
    setJournalEditData(editData);
    setJournalOpen(true);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const inv = invoices.find(i => i.id === id);
      if (!inv) return;
      if (newStatus === "paid") {
        setPaymentInvoice(inv);
        setPaymentDate(todayStr);
        const amtPaid = Number(inv.amount_paid ?? 0);
        const outstanding = Math.max(0, Number(inv.total_amount || 0) - amtPaid);
        setPaymentAmount(outstanding);
        const companyId = await getCompanyId();
        if (companyId) {
          const list = await loadBankAccounts(companyId);
          if (!list || list.length === 0) {
            toast({ title: "No bank accounts", description: "Add a bank account in the Bank module before posting payment.", variant: "destructive" });
            return;
          }
        }
        setSelectedBankId("");
        setPaymentDialogOpen(true);
        return;
      }
      if (newStatus === "sent") {
        setSentInvoice(inv);
        setSentDate(todayStr);
        setSentDialogOpen(true);
        return;
      }

      const { error } = await supabase
        .from("invoices")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "Invoice status updated" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentInvoice) return;
    setPaymentDialogOpen(false);
    try {
      const outstanding = Math.max(0, Number(paymentInvoice.total_amount || 0) - Number(paymentInvoice.amount_paid || 0));
      const amount = Number(paymentAmount || 0);
      if (!amount || amount <= 0) {
        toast({ title: "Invalid amount", description: "Enter a payment amount greater than zero.", variant: "destructive" });
        return;
      }
      if (!selectedBankId) {
        toast({ title: "Bank required", description: "Select a bank account to post the payment.", variant: "destructive" });
        return;
      }
      const selectedBank = bankAccounts.find((b: any) => String(b.id) === String(selectedBankId));
      if (!selectedBank) {
        toast({ title: "Invalid bank account", description: "Selected bank account no longer exists.", variant: "destructive" });
        return;
      }
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(selectedBankId))) {
        toast({ title: "Invalid bank account ID", description: "Bank account identifier format is invalid.", variant: "destructive" });
        return;
      }
      if (amount > outstanding + 0.0001) {
        toast({ title: "Amount exceeds outstanding", description: `Outstanding: R ${outstanding.toLocaleString('en-ZA')}`, variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from("invoices")
        .update({ 
          status: amount >= outstanding ? "paid" : "sent", 
          amount_paid: Number(paymentInvoice.amount_paid || 0) + amount 
        })
        .eq("id", paymentInvoice.id);
      if (error) throw error;
      const invForPost = { ...paymentInvoice, _payment_amount: amount };
      await openJournalForPaid(invForPost, paymentDate, selectedBankId, amount);
      // Optionally record paid date if schema supports it (non-blocking)
      // if your invoices table includes paid_at, you can enable the following:
      // await (supabase as any).from('invoices').update({ paid_at: new Date(paymentDate).toISOString() }).eq('id', paymentInvoice.id);
      toast({ title: "Success", description: "Opening journal to post payment" });
      setPaymentInvoice(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPaymentDialogOpen(true);
    }
  };

  const handleCreditNote = async () => {
    if (!invoiceToCredit) return;
    if (!creditReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for the credit note.", variant: "destructive" });
      return;
    }

    setIsCrediting(true);
    try {
      // 1. Find original transaction
      const { data: originalTx } = await supabase
        .from('transactions')
        .select('*, transaction_entries(*)')
        .eq('reference_number', invoiceToCredit.invoice_number)
        .eq('company_id', invoiceToCredit.company_id)
        .maybeSingle();

      // 2. Create Reversal Entries if transaction exists
      if (originalTx) {
        const originalEntries = originalTx.transaction_entries || [];
        const reversalEntries = originalEntries.map((entry: any) => ({
          account_id: entry.account_id,
          debit: entry.credit,
          credit: entry.debit,
          description: `Credit Note/Reversal: ${entry.description || ''}`,
          status: 'approved'
        }));

        const { data: newTx, error: txError } = await supabase
          .from('transactions')
          .insert({
            company_id: invoiceToCredit.company_id,
            transaction_date: new Date().toISOString().split('T')[0],
            description: `Credit Note for ${invoiceToCredit.invoice_number}: ${creditReason}`,
            reference_number: `CN-${invoiceToCredit.invoice_number}-${Date.now().toString().slice(-4)}`,
            transaction_type: 'Credit Note',
            status: 'approved',
            total_amount: invoiceToCredit.total_amount,
            user_id: user?.id,
            customer_id: invoiceToCredit.customer_id || null,
          })
          .select()
          .single();

        if (txError) throw txError;

        if (newTx && reversalEntries.length > 0) {
            const entriesWithTxId = reversalEntries.map((e: any) => ({
                ...e,
                transaction_id: newTx.id
            }));
            const { error: entriesError } = await supabase.from('transaction_entries').insert(entriesWithTxId);
            if (entriesError) throw entriesError;
        }
      }

      // 3. Update Invoice Status
      const { error: invError } = await supabase
        .from('invoices')
        .update({ 
            status: 'cancelled', 
            notes: `${invoiceToCredit.notes || ''}\n[Credit Note Issued: ${creditReason}]`
        })
        .eq('id', invoiceToCredit.id);

      if (invError) throw invError;

      // 4. Create Credit Note Transaction with customer_id
      if (originalTx) {
          // ... (reversal logic handled above but we need to ensure customer_id is in the new tx)
      } else {
         // If no original tx, we still might want a CN transaction? 
         // The current logic only creates tx if originalTx exists. 
         // We should probably ensure the NEW transaction has customer_id.
      }


      toast({ title: "Success", description: "Credit Note issued and invoice cancelled." });
      setCreditNoteOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Credit Note error:", error);
      toast({ title: "Error", description: error.message || "Failed to process credit note.", variant: "destructive" });
    } finally {
      setIsCrediting(false);
    }
  };

  // Helpers for PDF generation and email sending
  const fetchCompanyForPDF = async (): Promise<any> => {
    const { data, error } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      return { name: 'Company' };
    }
    return {
      name: (data as any).name,
      email: (data as any).email,
      phone: (data as any).phone,
      address: (data as any).address,
      tax_number: (data as any).tax_number ?? null,
      vat_number: (data as any).vat_number ?? null,
      logo_url: (data as any).logo_url ?? null,
    };
  };

  const fetchInvoiceItemsForPDF = async (invoiceId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('description,quantity,unit_price,tax_rate')
      .eq('invoice_id', invoiceId);
    if (error || !data) return [] as any[];
    return data as any[];
  };

  const mapInvoiceForPDF = (inv: any) => ({
    invoice_number: inv.invoice_number || String(inv.id),
    invoice_date: inv.invoice_date || new Date().toISOString(),
    due_date: inv.due_date || null,
    customer_name: inv.customer_name || inv.customer?.name || 'Customer',
    customer_email: inv.customer_email || inv.customer?.email || null,
    notes: inv.notes || null,
    subtotal: inv.subtotal ?? inv.total_before_tax ?? 0,
    tax_amount: inv.tax_amount ?? inv.tax ?? 0,
    total_amount: inv.total_amount ?? inv.total ?? inv.amount ?? 0,
  });

  const handleDownloadInvoice = async (inv: any) => {
    try {
      const [company, items] = await Promise.all([
        fetchCompanyForPDF(),
        fetchInvoiceItemsForPDF(inv.id),
      ]);
      const dto = mapInvoiceForPDF(inv);
      const doc = buildInvoicePDF(dto, items, company);
      const logoDataUrl = await fetchLogoDataUrl(company.logo_url);
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      doc.save(`invoice_${dto.invoice_number}.pdf`);
      toast({ title: 'Success', description: 'Invoice PDF downloaded' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to download invoice PDF', variant: 'destructive' });
    }
  };

  const openSendDialog = (inv: any) => {
    setSelectedInvoice(inv);
    const email = inv.customer_email || inv.customer?.email || '';
    setSendEmail(email);
    const totalText = inv.total_amount ?? inv.total ?? inv.amount ?? '';
    const msg = `Hello,\n\nPlease find your Invoice ${inv.invoice_number} for our company.\nTotal due: R ${totalText}.\n\nThank you.\n`;
    setSendMessage(msg);
    setSendDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedInvoice) return;
    if (!sendEmail) {
      toast({ title: 'Error', description: 'Please enter recipient email', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const [company, items] = await Promise.all([
        fetchCompanyForPDF(),
        fetchInvoiceItemsForPDF(selectedInvoice.id),
      ]);
      const dto = mapInvoiceForPDF(selectedInvoice);
      const doc = buildInvoicePDF(dto, items, company);
      const logoDataUrl = await fetchLogoDataUrl(company.logo_url);
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      const blob = doc.output('blob');
      const fileName = `invoice_${dto.invoice_number}.pdf`;
      const path = `invoices/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('invoices')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true });
      let publicUrl = '';
      if (!uploadErr) {
        const { data } = supabase.storage.from('invoices').getPublicUrl(path);
        publicUrl = data?.publicUrl || '';
      }
      const subject = encodeURIComponent(`Invoice ${dto.invoice_number}`);
      const bodyLines = [
        sendMessage,
        publicUrl ? `\nDownload your invoice: ${publicUrl}` : '',
      ].join('\n');
      const body = encodeURIComponent(bodyLines);
      const ccParam = companyEmail ? `&cc=${encodeURIComponent(companyEmail)}` : '';
      window.location.href = `mailto:${sendEmail}?subject=${subject}&body=${body}${ccParam}`;
      await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', selectedInvoice.id);
      await postInvoiceSent(selectedInvoice);
      toast({ title: 'Success', description: 'Email compose opened with invoice link' });
      setSendDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to prepare email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const canEdit = isAdmin || isAccountant;
  const totals = calculateTotals();

  const filteredInvoices = invoices.filter((inv) => {
    const total = Number(inv.total_amount || 0);
    const paid = Number(inv.amount_paid || 0);
    const outstanding = Math.max(0, total - paid);
    switch (statusFilter) {
      case 'unpaid':
        return inv.status !== 'paid' && outstanding > 0;
      case 'paid':
        return inv.status === 'paid' || outstanding === 0;
      case 'draft':
        return inv.status === 'draft';
      case 'cancelled':
        return inv.status === 'cancelled';
      case 'overdue':
        return inv.status === 'overdue';
      default:
        return true;
    }
  });
  const filteredByDateInvoices = filteredInvoices.filter((inv) => {
    const d = new Date(inv.invoice_date);
    const matchesYear = yearFilter === 'all' || String(d.getFullYear()) === yearFilter;
    const matchesMonth = monthFilter === 'all' || String(d.getMonth() + 1).padStart(2, '0') === monthFilter;
    return matchesYear && matchesMonth;
  });

  const totalCount = filteredByDateInvoices.length;
  const start = page * pageSize;
  const pagedInvoices = filteredByDateInvoices.slice(start, start + pageSize);

  // Advanced Metrics & Charts Logic REMOVED as per user request (moved to ARDashboard)
  // Kept simple stats for metric cards? User said "hide them on invoice module".
  // Removing Metric Cards from return JSX.

  useEffect(() => {
    setPage(0);
  }, [statusFilter, yearFilter, monthFilter]);

  const exportFilteredInvoicesDate = () => {
    const filename = `invoices_${statusFilter}`;
    exportInvoicesToExcel(filteredByDateInvoices as any, filename);
  };

  const getStatusBadge = (status: string, dueDate: string | null, amountPaid: number, totalAmount: number) => {
    const outstanding = Math.max(0, totalAmount - amountPaid);
    if (status === 'paid' || outstanding <= 0) return <Badge className="bg-green-500 hover:bg-green-600">Paid</Badge>;
    if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>;
    if (status === 'draft') return <Badge variant="outline" className="text-muted-foreground">Draft</Badge>;
    if (dueDate && new Date(dueDate) < new Date()) return <Badge variant="destructive">Overdue</Badge>;
    return <Badge className="bg-amber-500 hover:bg-amber-600">Pending</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Charts and Metric Cards REMOVED */}
      
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Invoices
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {Array.from(new Set(invoices.map(i => new Date(i.invoice_date).getFullYear()))).sort((a,b)=>b-a).map(y => (
                  <SelectItem key={String(y)} value={String(y)}>{String(y)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                  <SelectItem key={m} value={m}>{new Date(2025, Number(m)-1, 1).toLocaleString('en-ZA', { month: 'long' })}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportFilteredInvoicesDate}>Export</Button>
            {canEdit && (
              <Button className="bg-gradient-primary" onClick={() => setInvoiceTypeDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lastPosting && (
            <div className="mb-4 p-3 border rounded bg-muted/30 text-sm">
              {lastPosting}
            </div>
          )}
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices yet. Click "New Invoice" to create one.
            </div>
          ) : (<>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.customer_name}</TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}</TableCell>
                    <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-ZA') : "-"}</TableCell>
                    <TableCell className="text-right font-semibold">R {Number(invoice.total_amount).toLocaleString('en-ZA')}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">R {Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)).toLocaleString('en-ZA')}</TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status, invoice.due_date, invoice.amount_paid || 0, invoice.total_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleDownloadInvoice(invoice)}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openSendDialog(invoice)}>
                            <Mail className="mr-2 h-4 w-4" /> Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {canEdit && (
                            <>
                              <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => updateStatus(invoice.id, "sent")}>
                                Mark as Sent
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(invoice.id, "paid")}>
                                <DollarSign className="mr-2 h-4 w-4" /> Mark as Paid
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(invoice.id, "cancelled")} className="text-destructive">
                                Cancel Invoice
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setInvoiceToCredit(invoice); setCreditReason(""); setCreditNoteOpen(true); }} className="text-amber-600">
                                <History className="mr-2 h-4 w-4" /> Credit Note
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Showing {pagedInvoices.length} of {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </>)}
        </CardContent>

        <Dialog open={invoiceTypeDialogOpen} onOpenChange={setInvoiceTypeDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Sale Type</DialogTitle>
              <DialogDescription>Is this cash or on credit?</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => { setInvoicePaymentMode('cash'); setInvoiceTypeDialogOpen(false); setDialogOpen(true); }}>Cash</Button>
              <Button className="bg-gradient-primary" onClick={() => { setInvoicePaymentMode('credit'); setInvoiceTypeDialogOpen(false); setDialogOpen(true); }}>Credit</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Invoice</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Customer *</Label>
                    <Button type="button" variant="link" size="sm" onClick={() => window.open('/customers', '_blank')}>Add customer</Button>
                  </div>
                  <Select value={String(formData.customer_id || "")} onValueChange={(value) => applyCustomerSelection(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder={customers.length ? "Select customer" : "No customers found"} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id ?? c.name} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Customer Email</Label>
                  <Input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    placeholder="customer@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Invoice Date *</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                    max={todayStr}
                    required
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    min={formData.invoice_date}
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <Label>Items</Label>
                    <Button type="button" variant="link" size="sm" onClick={() => window.open('/sales?tab=products', '_blank')}>Add product</Button>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                      <div className="col-span-4">
                        <Label className="text-xs">Product/Service</Label>
                        <Select value={item.product_id || ""} onValueChange={(val) => updateItemProduct(index, val)}>
                          <SelectTrigger>
                            <SelectValue placeholder={(products.length + services.length) ? "Select an item" : "No items found"} />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p: any) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {(p.name ?? p.title ?? p.description ?? `Product ${p.id}`) as string}
                              </SelectItem>
                            ))}
                            {services.map((s: any) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                {((s.name ?? s.title ?? s.description ?? `Service ${s.id}`) as string)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="mt-2 text-[11px] text-muted-foreground">{item.description}</div>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Tax %</Label>
                        <Input
                          type="number"
                          step="1"
                          value={item.tax_rate}
                          onChange={(e) => updateItem(index, "tax_rate", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-xs">Amount</Label>
                        <div className="text-sm font-mono py-2">
                          {(item.quantity * item.unit_price).toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(index)}
                          disabled={formData.items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-mono">R {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span className="font-mono">R {totals.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span className="font-mono">R {totals.total.toFixed(2)}</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                <Button type="submit" className="bg-gradient-primary">Create Invoice</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={sentDialogOpen} onOpenChange={setSentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Post Sent Invoice</DialogTitle>
              <DialogDescription>
                Confirm date and amounts to post Debtors (AR), Revenue and VAT.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Posting Date</Label>
                <Input type="date" value={sentDate} max={todayStr} onChange={(e) => setSentDate(e.target.value)} />
              </div>
              {sentInvoice && (
                <div className="p-3 border rounded bg-muted/30 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Amount (excl. VAT)</span><span className="font-mono">R {Number(sentInvoice.subtotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span>VAT amount</span><span className="font-mono">R {Number(sentInvoice.tax_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span>Total</span><span className="font-mono">R {Number(sentInvoice.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span>Revenue account</span><span className="font-mono">4000 - Sales Revenue</span></div>
                  <div className="flex items-center gap-2 pt-2">
                    <Label htmlFor="includeVat">Include VAT in posting?</Label>
                    <input id="includeVat" type="checkbox" checked={sentIncludeVAT} onChange={e => setSentIncludeVAT(e.target.checked)} />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSentDialogOpen(false)}>Cancel</Button>
                <Button className="bg-gradient-primary" onClick={handleConfirmSent}>Post</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Payment</DialogTitle>
              <DialogDescription>
                Select the payment date to post Bank and settle Debtors.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {paymentInvoice && (
                <div className="text-sm text-muted-foreground">
                  Outstanding: R {Math.max(0, Number(paymentInvoice.total_amount || 0) - Number(paymentInvoice.amount_paid || 0)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </div>
              )}
              <div>
                <Label>Payment Amount</Label>
                <Input type="number" min={0} step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} />
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} max={todayStr} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div>
                <Label>Bank Account</Label>
                <Select value={selectedBankId} onValueChange={(v) => setSelectedBankId(v)}>
                  <SelectTrigger>
                <SelectValue placeholder={bankAccounts.length ? "Select bank account" : "No bank accounts"} />
                </SelectTrigger>
                <SelectContent>
                    {bankAccounts.map((b: any) => (
                      <SelectItem key={b.id} value={String(b.id)}>{`${b.bank_name} - ${b.account_name} (${b.account_number})`}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
                <Button className="bg-gradient-primary" onClick={handleConfirmPayment}>Post Payment</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <TransactionFormEnhanced
          open={journalOpen}
          onOpenChange={setJournalOpen}
          onSuccess={loadData}
          editData={journalEditData}
        />

        {/* Send Invoice Dialog */}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send invoice</DialogTitle>
              <DialogDescription>Enter recipient email. Message is prefilled. Sender CC: {companyEmail || 'not set'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input type="email" placeholder="Recipient email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
              <Textarea rows={6} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sending}>{sending ? 'Sending...' : 'Send'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
          <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
              <Check className="h-12 w-12 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl text-green-700">Success!</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
              <p className="text-muted-foreground">The operation has been completed successfully.</p>
            </div>
          </DialogContent>
        </Dialog>

        {isSubmitting && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-500">
            <div className="bg-background border shadow-xl rounded-xl flex flex-col items-center gap-8 p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
              <LoadingSpinner size="lg" className="scale-125" />
              <div className="w-full space-y-4">
                <Progress value={progress} className="h-2 w-full" />
                <div className="text-center space-y-2">
                  <div className="text-xl font-semibold text-primary animate-pulse">
                    {progressText}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Please wait while we update your financial records...
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Credit Note Dialog */}
        <Dialog open={creditNoteOpen} onOpenChange={setCreditNoteOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-amber-600 flex items-center gap-2">
                <History className="h-5 w-5" />
                Issue Credit Note
              </DialogTitle>
              <DialogDescription className="pt-2">
                This will cancel the invoice and create a credit note transaction in the ledger.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm font-medium flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  For audit compliance, invoices cannot be deleted. Use this form to issue a credit note.
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Reason for Credit Note</Label>
                <Textarea 
                  value={creditReason} 
                  onChange={(e) => setCreditReason(e.target.value)} 
                  placeholder="Reason for return or cancellation..."
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Supporting Document (Optional)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => toast({ title: "Upload", description: "File upload will be available in the next update." })}>
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8 opacity-50" />
                    <span className="text-sm">Click to upload document</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setCreditNoteOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button 
                onClick={handleCreditNote}
                disabled={isCrediting || !creditReason.trim()}
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isCrediting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <History className="mr-2 h-4 w-4" />
                    Issue Credit Note
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
};
