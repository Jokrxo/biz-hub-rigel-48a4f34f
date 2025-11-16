import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, FileText, ArrowRight, Mail } from "lucide-react";
import { buildQuotePDF, type QuoteForPDF, type QuoteItemForPDF, type CompanyForPDF } from '@/lib/quote-export';
import { addLogoToPDF, fetchLogoDataUrl } from '@/lib/invoice-export';
import { formatDate } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string | null;
  quote_date: string;
  expiry_date: string | null;
  total_amount: number;
  status: string;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    quote_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    total_amount: "",
  });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

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
    notes: null,
    subtotal: (q.subtotal ?? q.total_amount ?? 0) - (q.tax_amount ?? 0),
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

  useEffect(() => {
    loadQuotes();
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
        .single();

      if (!profile) throw new Error("Profile not found");

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

      const quoteNumber = `QUO-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.from("quotes").insert({
        company_id: profile!.company_id,
        quote_number: quoteNumber,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        quote_date: formData.quote_date,
        expiry_date: formData.expiry_date || null,
        total_amount: parseFloat(formData.total_amount),
        subtotal: parseFloat(formData.total_amount) / 1.15,
        tax_amount: parseFloat(formData.total_amount) * 0.15 / 1.15,
        status: "draft",
      });

      if (error) throw error;

      toast({ title: "Success", description: "Quote created successfully" });
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_email: "",
        quote_date: new Date().toISOString().split("T")[0],
        expiry_date: "",
        total_amount: "",
      });
      loadQuotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const convertToInvoice = async (quote: Quote) => {
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

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

      const { error: invoiceError } = await supabase.from("invoices").insert({
        company_id: profile!.company_id,
        invoice_number: invoiceNumber,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: null,
        total_amount: quote.total_amount,
        subtotal: quote.total_amount / 1.15,
        tax_amount: quote.total_amount * 0.15 / 1.15,
        status: "draft",
        quote_id: quote.id,
      });

      if (invoiceError) throw invoiceError;

      const { error: updateError } = await supabase
        .from("quotes")
        .update({ status: "converted" })
        .eq("id", quote.id);

      if (updateError) throw updateError;

      toast({ title: "Success", description: "Quote converted to invoice successfully" });
      loadQuotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = isAdmin || isAccountant;
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const qd = new Date(q.quote_date).getTime();
      const afterStart = startDate ? qd >= new Date(startDate).getTime() : true;
      const beforeEnd = endDate ? qd <= new Date(endDate).getTime() : true;
      return afterStart && beforeEnd;
    });
  }, [quotes, startDate, endDate]);

  return (
    <>
      <SEO title="Sales Quotes | ApexAccounts" description="Manage sales quotes and convert to invoices" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Sales Quotes</h1>
              <p className="text-muted-foreground mt-1">Create quotes and convert them to invoices</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" disabled={quotes.length === 0} onClick={() => toast({ title: 'Use per-quote Download below' })}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      New Quote
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Quote</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label>Customer Name</Label>
                        <Input
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Customer Email</Label>
                        <Input
                          type="email"
                          value={formData.customer_email}
                          onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                          placeholder="optional"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Quote Date</Label>
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
                        <Label>Total Amount (R) incl. VAT</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.total_amount}
                          onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full bg-gradient-primary">Create Quote</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                All Quotes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No quotes yet</div>
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
                            <TableCell className="text-right font-semibold">R {quote.total_amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                quote.status === 'converted' ? 'bg-primary/10 text-primary' :
                                quote.status === 'accepted' ? 'bg-accent/10 text-accent' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {quote.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {quote.status !== 'converted' && canEdit && (
                                  <Button size="sm" variant="default" onClick={() => convertToInvoice(quote)} className="bg-gradient-primary">
                                    <ArrowRight className="h-3 w-3 mr-1" />
                                    Invoice
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => handleDownloadQuote(quote)}>
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openSendDialog(quote)} disabled={!quote.customer_email}>
                                  <Mail className="h-3 w-3" />
                                </Button>
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
          </Card>
        </div>
      </DashboardLayout>
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="email" placeholder="Recipient email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
            <Textarea rows={6} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
