import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/use-roles";
import { ArrowRight, Plus, Trash2, FileText, Download, Mail } from "lucide-react";
import { buildQuotePDF, type QuoteForPDF, type QuoteItemForPDF, type CompanyForPDF } from '@/lib/quote-export';
import { addLogoToPDF, fetchLogoDataUrl } from '@/lib/invoice-export';
import { formatDate } from '@/lib/utils';

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    quote_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
  });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState<string>('');
  const [sendMessage, setSendMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    loadQuotes();

    // Real-time updates
    const channel = supabase
      .channel('quotes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        loadQuotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try { setDateFormat(JSON.parse(saved).dateFormat || 'DD/MM/YYYY'); } catch {}
    }
  }, []);

  const loadQuotes = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) return;

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
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
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

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const quoteNumber = `QTE-${Date.now().toString().slice(-6)}`;
      const totals = calculateTotals();

      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          company_id: profile!.company_id,
          quote_number: quoteNumber,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email || null,
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

      // Create quote items
      const items = formData.items.map(item => ({
        quote_id: quote.id,
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

      toast({ title: "Success", description: "Quote created successfully" });
      setDialogOpen(false);
      resetForm();
      loadQuotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: "",
      customer_email: "",
      quote_date: new Date().toISOString().split("T")[0],
      expiry_date: "",
      notes: "",
      items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
    });
  };

  const convertToInvoice = async (quoteId: string, quote: Quote) => {
    try {
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
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          company_id: profile!.company_id,
          quote_id: quoteId,
          invoice_number: invoiceNumber,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          invoice_date: new Date().toISOString().split("T")[0],
          subtotal: quote.subtotal,
          tax_amount: quote.tax_amount,
          total_amount: quote.total_amount,
          notes: quote.notes,
          status: "draft"
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Copy quote items to invoice items
      if (quoteItems && quoteItems.length > 0) {
        const invoiceItems = quoteItems.map(item => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          amount: item.amount,
          item_type: 'product'
        }));

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

      toast({ title: "Success", description: "Quote converted to invoice successfully" });
      loadQuotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const fetchCompanyForPDF = async (): Promise<CompanyForPDF> => {
    const { data, error } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      return { name: 'Company' } as CompanyForPDF;
    }
    return {
      name: (data as any).name,
      email: (data as any).email,
      phone: (data as any).phone,
      address: (data as any).address,
      tax_number: (data as any).tax_number ?? null,
      vat_number: (data as any).vat_number ?? null,
      logo_url: (data as any).logo_url ?? null,
    } as CompanyForPDF;
  };

  const fetchQuoteItemsForPDF = async (quoteId: string): Promise<QuoteItemForPDF[]> => {
    const { data, error } = await supabase
      .from('quote_items')
      .select('description,quantity,unit_price,tax_rate')
      .eq('quote_id', quoteId);
    if (error || !data) return [];
    return data as any;
  };

  const mapQuoteForPDF = (q: any): QuoteForPDF => ({
    quote_number: q.quote_number || String(q.id),
    quote_date: q.quote_date || new Date().toISOString(),
    expiry_date: q.expiry_date || null,
    customer_name: q.customer_name || 'Customer',
    customer_email: q.customer_email || null,
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

  const deleteQuote = async (id: string) => {
    if (!confirm("Delete this quote?")) return;
    try {
      const { error } = await supabase.from("quotes").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Quote deleted" });
      loadQuotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Sales Quotes
        </CardTitle>
        {canEdit && (
          <Button className="bg-gradient-primary" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Quote
          </Button>
        )}
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
                  {filteredQuotes.map((quote) => (
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
                            <Button size="sm" variant="ghost" onClick={() => deleteQuote(quote.id)}>
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
          </>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Quote</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Enter customer name"
                  required
                />
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
                <Label>Quote Date *</Label>
                <Input
                  type="date"
                  value={formData.quote_date}
                  onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
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
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                    <div className="col-span-4">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        required
                      />
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
    </Card>
  );
};