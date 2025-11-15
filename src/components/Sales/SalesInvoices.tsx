import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { transactionsApi } from "@/lib/transactions-api";
import { TransactionFormEnhanced } from "@/components/Transactions/TransactionFormEnhanced";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import { Download, Mail, Plus, Trash2, FileText } from "lucide-react";
import { exportInvoiceToPDF, buildInvoicePDF, addLogoToPDF, fetchLogoDataUrl, type InvoiceForPDF, type InvoiceItemForPDF, type CompanyForPDF } from '@/lib/invoice-export';

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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isAccountant } = useRoles();
  const todayStr = new Date().toISOString().split("T")[0];
  const [posting, setPosting] = useState(false);
  const [lastPosting, setLastPosting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
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
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalEditData, setJournalEditData] = useState<any>(null);

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
  }, []);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) return;

      // Load customers
      const { data: customersData } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("name");

      setCustomers(customersData || []);

      // Load products from items table
      const { data: productsData } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", profile.company_id)
        .eq("item_type", "product")
        .order("name");
      setProducts(productsData || []);

      // Load invoices
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
  };

  const handleConfirmSent = async () => {
    if (!sentInvoice) return;
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "sent", sent_at: new Date(sentDate).toISOString() })
        .eq("id", sentInvoice.id);
      if (error) throw error;
      await openJournalForSent(sentInvoice, sentDate);
      toast({ title: "Success", description: "Opening journal to post invoice" });
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
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], product_id: productId };
    if (product) {
      const name = (product.name ?? product.description ?? '').toString();
      newItems[index].description = name;
      if (typeof product.unit_price === 'number') {
        newItems[index].unit_price = product.unit_price;
      }
    }
    setFormData({ ...formData, items: newItems });
  };

  // Apply selected customer to form (name and email)
  const applyCustomerSelection = (name: string) => {
    const selected = customers.find((c: any) => c.name === name);
    setFormData(prev => ({
      ...prev,
      customer_name: name,
      customer_email: selected?.email ?? "",
    }));
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
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const totals = calculateTotals();

      const { data: invoice, error: invoiceError } = await supabase
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
          status: "draft"
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const items = formData.items.map(item => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100),
        item_type: 'product'
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Decrease stock for each product item
      for (const it of formData.items) {
        const prod = products.find((p: any) => String(p.id) === String(it.product_id));
        if (!prod) continue;
        const currentQty = Number(prod.quantity_on_hand ?? 0);
        const newQty = currentQty - Number(it.quantity ?? 0);
        const { error: stockError } = await supabase
          .from("items")
          .update({ quantity_on_hand: newQty })
          .eq("id", prod.id);
        if (stockError) throw stockError;
      }

      toast({ title: "Success", description: "Invoice created successfully" });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
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
      try {
        await (supabase as any).rpc('post_invoice_sent', { _invoice_id: inv.id, _post_date: postDateStr || inv.invoice_date });
      } catch (rpcErr) {
        await transactionsApi.postInvoiceSentClient(inv, postDateStr || inv.invoice_date);
      }
      const companyId = await getCompanyId();
      if (companyId) {
        try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
      }
      toast({ title: "Success", description: `Posted invoice ${inv.invoice_number} to Receivable and Revenue` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to post Sent invoice', variant: 'destructive' });
    } finally {
      setPosting(false);
    }
  };

  const openJournalForSent = async (inv: any, postDateStr?: string) => {
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
    const editData = {
      id: null,
      transaction_date: postDateStr || inv.invoice_date,
      description: `Invoice ${inv.invoice_number || inv.id} issued`,
      reference_number: inv.invoice_number || null,
      transaction_type: 'income',
      payment_method: 'accrual',
      debit_account_id: arId,
      credit_account_id: revId,
      total_amount: amount,
      bank_account_id: null,
      lockType: 'sent',
    };
    setJournalEditData(editData);
    setJournalOpen(true);
  };

  const postInvoicePaid = async (inv: any, payDateStr?: string, bankAccountId?: string) => {
    try {
      setPosting(true);
      const amt = Number(inv._payment_amount || inv.total_amount || 0);
      try {
        await (supabase as any).rpc('post_invoice_paid', { _invoice_id: inv.id, _payment_date: payDateStr || todayStr, _bank_account_id: bankAccountId, _amount: amt });
      } catch (rpcErr) {
        await transactionsApi.postInvoicePaidClient(inv, payDateStr || todayStr, bankAccountId as string, amt);
      }
      const companyId = await getCompanyId();
      if (companyId) {
        try { await supabase.rpc('refresh_afs_cache', { _company_id: companyId }); } catch {}
      }
      toast({ title: "Success", description: `Posted payment for ${inv.invoice_number}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || 'Failed to post payment', variant: 'destructive' });
    } finally {
      setPosting(false);
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
      description: `Payment for invoice ${inv.invoice_number || inv.id}`,
      reference_number: inv.invoice_number || null,
      transaction_type: 'receipt',
      payment_method: 'bank',
      bank_account_id: bankAccountId || null,
      debit_account_id: bankLedgerId,
      credit_account_id: arId,
      total_amount: amt,
      lockType: 'paid',
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
      setPaymentDialogOpen(false);
      setPaymentInvoice(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Invoice deleted" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
      window.location.href = `mailto:${sendEmail}?subject=${subject}&body=${body}`;
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

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Sales Invoices
        </CardTitle>
        {canEdit && (
          <Button className="bg-gradient-primary" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        )}
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
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell>{new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}</TableCell>
                  <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-ZA') : "-"}</TableCell>
                  <TableCell className="text-right font-semibold">R {Number(invoice.total_amount).toLocaleString('en-ZA')}</TableCell>
                  <TableCell>
                    <Select
                      value={invoice.status}
                      onValueChange={(value) => updateStatus(invoice.id, value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(invoice)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openSendDialog(invoice)}>
                        <Mail className="h-3 w-3" />
                      </Button>
                      {canEdit && (
                        <Button size="sm" variant="ghost" onClick={() => deleteInvoice(invoice.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

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
                <Select value={formData.customer_name} onValueChange={(value) => applyCustomerSelection(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={customers.length ? "Select customer" : "No customers found"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: any) => (
                      <SelectItem key={c.id ?? c.name} value={c.name}>{c.name}</SelectItem>
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
                      <Label className="text-xs">Product</Label>
                      <Select value={item.product_id || ""} onValueChange={(val) => updateItemProduct(index, val)}>
                        <SelectTrigger>
                          <SelectValue placeholder={products.length ? "Select a product" : "No products found"} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {(p.name ?? p.title ?? p.description ?? `Product ${p.id}`) as string}
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
              Choose the posting date for Debtors and Revenue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Posting Date</Label>
              <Input type="date" value={sentDate} max={todayStr} onChange={(e) => setSentDate(e.target.value)} />
            </div>
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
            <DialogDescription>Enter recipient email. A professional message is prefilled.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="email" placeholder="Recipient email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
            <Textarea rows={6} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};