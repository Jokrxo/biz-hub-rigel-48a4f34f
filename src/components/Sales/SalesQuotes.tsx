import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import { ArrowRight, Plus, FileText, Download, Mail, History, Upload, Loader2, AlertTriangle, X } from "lucide-react";
import { buildQuotePDF, type QuoteForPDF, type QuoteItemForPDF, type CompanyForPDF } from '@/lib/quote-export';
import { addLogoToPDF, fetchLogoDataUrl } from '@/lib/invoice-export';
import { formatDate } from '@/lib/utils';
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
  po_number?: string | null;
  quote_date: string;
  expiry_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
}

export const SalesQuotes = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isAccountant } = useRoles();
  const todayStr = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    customer_id: "",
    customer_name: "",
    customer_email: "",
    po_number: "",
    quote_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    notes: "",
    items: [{ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
  });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState<string>('');
  const [sendMessage, setSendMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const [cancelOpen, setCancelOpen] = useState(false);
  const [quoteToCancel, setQuoteToCancel] = useState<Quote | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

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
        .from("quotes")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("quote_date", { ascending: false });
      if (error) throw error;
      setQuotes(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);
  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('quotes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try { setDateFormat(JSON.parse(saved).dateFormat || 'DD/MM/YYYY'); } catch {}
    }
  }, []);

  

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
    newItems[index] = { ...newItems[index], product_id: productId } as any;
    const picked: any = product || service;
    if (picked) {
      const name = (picked.name ?? picked.description ?? '').toString();
      (newItems[index] as any).description = name;
      if (typeof picked.unit_price === 'number') {
        (newItems[index] as any).unit_price = picked.unit_price;
      }
    }
    setFormData({ ...formData, items: newItems });
  };

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
      toast({ title: "Item required", description: "Select a product or service for each item.", variant: "destructive" });
      return;
    }
    if (formData.items.some((it: any) => (Number(it.quantity) || 0) <= 0)) {
      toast({ title: "Invalid quantity", description: "Each item must have quantity > 0.", variant: "destructive" });
      return;
    }
    for (const it of formData.items as any[]) {
      const prod = products.find((p: any) => String(p.id) === String((it as any).product_id));
      const svc = services.find((s: any) => String(s.id) === String((it as any).product_id));
      if (svc) continue;
      const available = Number(prod?.quantity_on_hand ?? 0);
      const requested = Number((it as any).quantity ?? 0);
      if (!prod) {
        toast({ title: "Product not found", description: "Selected product no longer exists.", variant: "destructive" });
        return;
      }
      if (requested > available) {
        toast({ title: "Insufficient stock", description: `Requested ${requested}, available ${available} for ${prod.name}.`, variant: "destructive" });
        return;
      }
    }
    const qDate = new Date(formData.quote_date);
    const eDate = formData.expiry_date ? new Date(formData.expiry_date) : null;
    const today = new Date(todayStr);
    if (isNaN(qDate.getTime())) {
      toast({ title: "Invalid date", description: "Quote date is not valid.", variant: "destructive" });
      return;
    }
    if (qDate > today) {
      toast({ title: "Invalid quote date", description: "Quote date cannot be in the future.", variant: "destructive" });
      return;
    }
    if (eDate && eDate < qDate) {
      toast({ title: "Invalid expiry date", description: "Expiry date cannot be earlier than quote date.", variant: "destructive" });
      return;
    }

    setDialogOpen(false);
    try {
      setIsSubmitting(true);
      setProgress(10);
      setProgressText("Creating Quote...");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const quoteNumber = `QTE-${Date.now().toString().slice(-6)}`;
      const totals = calculateTotals();

      let quote;
      try {
        const { data, error: quoteError } = await supabase
          .from("quotes")
          .insert({
            company_id: profile!.company_id,
            quote_number: quoteNumber,
            customer_id: formData.customer_id,
            customer_name: formData.customer_name,
            customer_email: formData.customer_email || null,
            po_number: formData.po_number || null,
            quote_date: formData.quote_date,
            expiry_date: formData.expiry_date || null,
            subtotal: totals.subtotal,
            tax_amount: totals.taxAmount,
            total_amount: totals.total,
            notes: formData.notes || null,
            status: "draft"
          })
          .select()
          .single();

        if (quoteError) throw quoteError;
        quote = data;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("schema cache") || msg.includes("column")) {
          // Retry without customer_id
          const { data, error: retryError } = await supabase
            .from("quotes")
            .insert({
              company_id: profile!.company_id,
              quote_number: quoteNumber,
              customer_name: formData.customer_name,
              customer_email: formData.customer_email || null,
              po_number: formData.po_number || null,
              quote_date: formData.quote_date,
              expiry_date: formData.expiry_date || null,
              subtotal: totals.subtotal,
              tax_amount: totals.taxAmount,
              total_amount: totals.total,
              notes: formData.notes || null,
              status: "draft"
            })
            .select()
            .single();

          if (retryError) throw retryError;
          quote = data;
          toast({ 
            title: "Warning", 
            description: "Quote saved, but customer link is incomplete due to connection issues. Please refresh the page." 
          });
        } else {
          throw err;
        }
      }

      setProgress(50);
      setProgressText("Saving Items...");
      await new Promise(r => setTimeout(r, 400));

      // Create quote items
      const items = formData.items.map(item => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100)
      }));

      const { error: itemsError } = await supabase
        .from("quote_items")
        .insert(items);

      if (itemsError) throw itemsError;

      setProgress(100);
      setProgressText("Finalizing...");
      await new Promise(r => setTimeout(r, 600));

      toast({ title: "Success", description: "Quote created successfully" });
      setIsSubmitting(false);
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
      po_number: "",
      quote_date: new Date().toISOString().split("T")[0],
      expiry_date: "",
      notes: "",
      items: [{ product_id: "", description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
    });
  };

  const convertToInvoice = async (quoteId: string, quote: Quote) => {
    try {
      setIsSubmitting(true);
      setProgress(10);
      setProgressText("Converting to Invoice...");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

      // Get quote items
      const { data: quoteItems } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", quoteId);

      // Create invoice
      let invoice;
      try {
        const { data, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            company_id: profile!.company_id,
            quote_id: quoteId,
            invoice_number: invoiceNumber,
            customer_id: (quote as any).customer_id, // Link to customer
            customer_name: quote.customer_name,
            customer_email: quote.customer_email,
            po_number: quote.po_number || null,
            invoice_date: new Date().toISOString().split("T")[0],
            due_date: quote.expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            subtotal: quote.subtotal,
            tax_amount: quote.tax_amount,
            total_amount: quote.total_amount,
            notes: quote.notes,
            status: "draft"
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        invoice = data;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("schema cache") || msg.includes("column")) {
          // Retry without customer_id
          const { data, error: retryError } = await supabase
            .from("invoices")
            .insert({
              company_id: profile!.company_id,
              quote_id: quoteId,
              invoice_number: invoiceNumber,
              customer_name: quote.customer_name,
              customer_email: quote.customer_email,
              po_number: quote.po_number || null,
              invoice_date: new Date().toISOString().split("T")[0],
              due_date: quote.expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              subtotal: quote.subtotal,
              tax_amount: quote.tax_amount,
              total_amount: quote.total_amount,
              notes: quote.notes,
              status: "draft"
            })
            .select()
            .single();

          if (retryError) throw retryError;
          invoice = data;
          toast({ 
            title: "Warning", 
            description: "Invoice created from quote, but customer link is incomplete due to connection issues." 
          });
        } else {
          throw err;
        }
      }

      // Copy quote items to invoice items
      if (quoteItems && quoteItems.length > 0) {
        const invoiceItems = quoteItems.map(item => {
           // Determine item type based on products/services list
           const isService = services.some((s: any) => s.id === item.product_id);
           return {
            invoice_id: invoice.id,
            product_id: item.product_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_rate: item.tax_rate,
            amount: item.amount,
            item_type: isService ? 'service' : 'product'
          };
        });

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(invoiceItems);

        if (itemsError) throw itemsError;
      }

      // Update quote status
      await supabase
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quoteId);

      setProgress(100);
      setProgressText("Converted Successfully");
      await new Promise(r => setTimeout(r, 600));

      toast({ title: "Success", description: "Quote converted to invoice successfully" });
      setIsSubmitting(false);
      loadData();
      window.location.href = `/sales?tab=invoices&action=edit&id=${invoice.id}`;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsSubmitting(false);
    }
  };

  // Helpers for PDF generation and email sending
  const fetchCompanyForPDF = async (): Promise<any> => {
    const { data, error } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url,bank_name,account_holder,branch_code,account_number')
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
      bank_name: (data as any).bank_name ?? null,
      account_holder: (data as any).account_holder ?? null,
      branch_code: (data as any).branch_code ?? null,
      account_number: (data as any).account_number ?? null,
    };
  };

  const fetchQuoteItemsForPDF = async (quoteId: string): Promise<QuoteItemForPDF[]> => {
    const { data, error } = await supabase
      .from('quote_items')
      .select('description,quantity,unit_price,tax_rate')
      .eq('quote_id', quoteId);
    if (error || !data) return [];
    return data as any;
  };

  const mapQuoteForPDF = (q: any): any => ({
    quote_number: q.quote_number || String(q.id),
    quote_date: q.quote_date || new Date().toISOString(),
    expiry_date: q.expiry_date || null,
    customer_name: q.customer_name || 'Customer',
    customer_email: q.customer_email || null,
    po_number: q.po_number || null,
    notes: q.notes || null,
    subtotal: q.subtotal ?? (q.total_amount ?? 0) - (q.tax_amount ?? 0),
    tax_amount: q.tax_amount ?? 0,
    total_amount: q.total_amount ?? 0,
  });

  const handleDownloadQuote = async (q: any) => {
    try {
      const [company, items] = await Promise.all([
        fetchCompanyForPDF(),
        fetchQuoteItemsForPDF(q.id),
      ]);
      const dto = mapQuoteForPDF(q);
      const doc = buildQuotePDF(dto, items as QuoteItemForPDF[], company);
      const logoDataUrl = await fetchLogoDataUrl(company.logo_url);
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      doc.save(`quote_${dto.quote_number}.pdf`);
      toast({ title: 'Success', description: 'Quote PDF downloaded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to download quote PDF', variant: 'destructive' });
    }
  };

  const openSendDialog = (q: any) => {
    setSelectedQuote(q);
    const email = q.customer_email || '';
    setSendEmail(email);
    const totalText = q.total_amount ?? '';
    const msg = `Hello,\n\nPlease find your Quote ${q.quote_number}.\nTotal: R ${totalText}.\n\nThank you.`;
    setSendMessage(msg);
    setSendDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedQuote) return;
    if (!sendEmail) { toast({ title: 'Error', description: 'Please enter recipient email', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const [company, items] = await Promise.all([
        fetchCompanyForPDF(),
        fetchQuoteItemsForPDF(selectedQuote.id),
      ]);
      const dto = mapQuoteForPDF(selectedQuote);
      const doc = buildQuotePDF(dto, items as QuoteItemForPDF[], company);
      const logoDataUrl = await fetchLogoDataUrl(company.logo_url);
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      const blob = doc.output('blob');
      const fileName = `quote_${dto.quote_number}.pdf`;
      const path = `quotes/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('quotes')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true });
      let publicUrl = '';
      if (!uploadErr) {
        const { data } = supabase.storage.from('quotes').getPublicUrl(path);
        publicUrl = data?.publicUrl || '';
      }
      const subject = encodeURIComponent(`Quote ${dto.quote_number}`);
      const bodyLines = [sendMessage, publicUrl ? `\nDownload your quote: ${publicUrl}` : ''].join('\n');
      const body = encodeURIComponent(bodyLines);
      window.location.href = `mailto:${sendEmail}?subject=${subject}&body=${body}`;
      await supabase
        .from('quotes')
        .update({ status: 'sent' })
        .eq('id', selectedQuote.id);
      toast({ title: 'Success', description: 'Email compose opened with quote link' });
      setSendDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to prepare email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleCancelQuote = async () => {
    if (!quoteToCancel) return;
    if (!cancelReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason for cancelling the quote.", variant: "destructive" });
      return;
    }

    setIsCancelling(true);
    try {
      const notes = `${quoteToCancel.notes || ''}\n[Cancelled: ${cancelReason}]${file ? `\n[Document: ${file.name}]` : ''}`;

      const { error } = await supabase
        .from("quotes")
        .update({ 
            status: "cancelled",
            notes: notes
        })
        .eq("id", quoteToCancel.id);

      if (error) throw error;

      toast({ title: "Success", description: "Quote cancelled" });
      setCancelOpen(false);
      setFile(null);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCancelling(false);
    }
  };

  const canEdit = isAdmin || isAccountant;
  const totals = calculateTotals();
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const qd = new Date(q.quote_date).getTime();
      const afterStart = startDate ? qd >= new Date(startDate).getTime() : true;
      const beforeEnd = endDate ? qd <= new Date(endDate).getTime() : true;
      return afterStart && beforeEnd;
    });
  }, [quotes, startDate, endDate]);

  const totalCount = filteredQuotes.length;
  const start = page * pageSize;
  const pagedQuotes = filteredQuotes.slice(start, start + pageSize);
  useEffect(() => { setPage(0); }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Green Masterfile Header */}
      <div className="bg-emerald-600 text-white p-4 rounded-t-md -mb-6 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Quotes</h1>
          <div className="text-sm opacity-90">Manage your sales quotations</div>
        </div>
        {canEdit && (
          <Button 
            onClick={() => setDialogOpen(true)}
            className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 font-semibold shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" /> New Quote
          </Button>
        )}
      </div>

      <Card className="shadow-sm pt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Quotes
          </CardTitle>
        </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No quotes yet. Click "New Quote" to create one.
          </div>
        ) : (
          <>
            <div className="flex items-end gap-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</Button>
            </div>
            {filteredQuotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No quotes in selected range</div>
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quote_number}</TableCell>
                      <TableCell>{quote.customer_name}</TableCell>
                  <TableCell>{formatDate(quote.quote_date, dateFormat)}</TableCell>
                  <TableCell>{quote.expiry_date ? formatDate(quote.expiry_date, dateFormat) : "-"}</TableCell>
                      <TableCell className="text-right font-semibold">R {Number(quote.total_amount).toLocaleString('en-ZA')}</TableCell>
                      <TableCell>
                        <Badge variant={
                          quote.status === 'accepted' ? 'default' :
                          quote.status === 'sent' ? 'secondary' :
                          'outline'
                        }>
                          {quote.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {quote.status !== 'accepted' && canEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => convertToInvoice(quote.id, quote)}
                              className="gap-2"
                            >
                              <ArrowRight className="h-3 w-3" />
                              Convert
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleDownloadQuote(quote)}>
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openSendDialog(quote)} disabled={!quote.customer_email}>
                            <Mail className="h-3 w-3" />
                          </Button>
                          {canEdit && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              setQuoteToCancel(quote);
                              setCancelOpen(true);
                            }} className="text-amber-600">
                              <History className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-muted-foreground">
                  Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Showing {pagedQuotes.length} of {totalCount}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                  <Button variant="outline" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
              </>
            )}
          </>
        )}
      </CardContent>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <History className="h-5 w-5" />
              Cancel Quote
            </DialogTitle>
            <DialogDescription className="pt-2">
              This will mark the quote as cancelled. It cannot be deleted for audit purposes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-sm font-medium flex gap-3 items-start">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                For audit compliance, quotes cannot be deleted. Use this form to cancel the quote.
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Reason for Cancellation</Label>
              <Textarea 
                value={cancelReason} 
                onChange={(e) => setCancelReason(e.target.value)} 
                placeholder="Reason for cancellation..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Supporting Document (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => document.getElementById('quote-file-upload')?.click()}>
                <input type="file" id="quote-file-upload" className="hidden" onChange={handleFileChange} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8 opacity-50" />
                  <span className="text-sm">Click to upload document</span>
                  {file && <span className="text-xs text-primary font-medium">{file.name}</span>}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelOpen(false)} className="w-full sm:w-auto">Dismiss</Button>
            <Button 
              onClick={handleCancelQuote}
              disabled={isCancelling || !cancelReason.trim()}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <History className="mr-2 h-4 w-4" />
                  Confirm Cancellation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Quote</DialogTitle>
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
              <div>
                <Label>PO Number</Label>
                <Input
                  value={formData.po_number || ""}
                  onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                  placeholder="Purchase Order #"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quote Date *</Label>
                <Input
                  type="date"
                  value={formData.quote_date}
                  onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                  max={todayStr}
                  required
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  min={formData.quote_date}
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
                      <Select value={(item as any).product_id || ""} onValueChange={(val) => updateItemProduct(index, val)}>
                        <SelectTrigger>
                          <SelectValue placeholder={(products.length + services.length) ? "Select an item" : "No items found"} />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{(p.name ?? p.title ?? p.description ?? `Product ${p.id}`) as string}</SelectItem>
                          ))}
                          {services.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{((s.name ?? s.title ?? s.description ?? `Service ${s.id}`) as string)}</SelectItem>
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
                        <X className="h-4 w-4" />
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
              <Button type="submit" className="bg-gradient-primary">Create Quote</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send quote</DialogTitle>
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
    </Card>
    </div>
  );
};
