import { useState, useEffect, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, FileText, ArrowRight, Mail, Info, LayoutDashboard, TrendingUp, CheckCircle2, XCircle, AlertCircle, Clock, Users, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildQuotePDF, type QuoteForPDF, type QuoteItemForPDF, type CompanyForPDF } from '@/lib/quote-export';
import { addLogoToPDF, fetchLogoDataUrl } from '@/lib/invoice-export';
import { formatDate } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { MetricCard } from "@/components/ui/MetricCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();
  const [dateFormat, setDateFormat] = useState<string>('DD/MM/YYYY');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [tab, setTab] = useState("all");

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
    const { data } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .limit(1)
      .maybeSingle();
    return {
      name: (data as any)?.name || 'Company',
      email: (data as any)?.email,
      phone: (data as any)?.phone,
      address: (data as any)?.address,
      tax_number: (data as any)?.tax_number ?? null,
      vat_number: (data as any)?.vat_number ?? null,
      logo_url: (data as any)?.logo_url ?? null,
    } as CompanyForPDF;
  };

  const fetchQuoteItemsForPDF = async (quoteId: string): Promise<QuoteItemForPDF[]> => {
    const { data } = await supabase.from('quote_items').select('description,quantity,unit_price,tax_rate').eq('quote_id', quoteId);
    return (data || []) as any;
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

  const loadQuotes = useCallback(async () => {
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
  }, [user?.id, toast]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try { setDateFormat(JSON.parse(saved).dateFormat || 'DD/MM/YYYY'); } catch {}
    }
  }, []);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_quotes_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user?.id]);

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
      
      let matchesTab = true;
      if (tab === 'draft') matchesTab = q.status === 'draft';
      else if (tab === 'accepted') matchesTab = q.status === 'accepted' || q.status === 'converted';
      else if (tab === 'sent') matchesTab = q.status === 'sent';
      else if (tab === 'expired') matchesTab = q.status === 'expired';

      return afterStart && beforeEnd && matchesTab;
    });
  }, [quotes, startDate, endDate, tab]);

  const totalCount = filteredQuotes.length;
  const start = page * pageSize;
  const pagedQuotes = filteredQuotes.slice(start, start + pageSize);

  useEffect(() => { setPage(0); }, [startDate, endDate, tab]);

  // Metrics
  const metrics = {
    total: quotes.reduce((acc, q) => acc + Number(q.total_amount || 0), 0),
    count: quotes.length,
    accepted: quotes.filter(q => q.status === 'accepted' || q.status === 'converted').length,
    draft: quotes.filter(q => q.status === 'draft').length,
  };

  const statusData = [
    { name: 'Draft', value: quotes.filter(q => q.status === 'draft').length },
    { name: 'Sent', value: quotes.filter(q => q.status === 'sent').length },
    { name: 'Accepted', value: quotes.filter(q => q.status === 'accepted' || q.status === 'converted').length },
    { name: 'Expired', value: quotes.filter(q => q.status === 'expired').length },
  ].filter(i => i.value > 0);

  return (
    <>
      <SEO title="Sales Quotes | Rigel Business" description="View and download quotes; create quotes in Sales module" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Quotes Management</h1>
              <p className="text-muted-foreground mt-1">Manage customer quotes, track conversions, and follow up</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help
              </Button>
              <Sheet open={isQuickActionsOpen} onOpenChange={setIsQuickActionsOpen}>
                <SheetTrigger asChild>
                  <Button className="bg-gradient-primary shadow-lg hover:shadow-xl transition-all">
                    <Plus className="h-4 w-4 mr-2" /> Quick Actions
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Quote Actions</SheetTitle>
                    <SheetDescription>Quickly manage your sales pipeline</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <Button variant="outline" className="justify-start h-12" onClick={() => { navigate('/sales?tab=quotes'); setIsQuickActionsOpen(false); }}>
                      <FileText className="h-5 w-5 mr-3 text-purple-500" />
                      Create Quote
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { navigate('/customers'); setIsQuickActionsOpen(false); }}>
                      <Users className="h-5 w-5 mr-3 text-green-500" />
                      Add Customer
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { navigate('/sales'); setIsQuickActionsOpen(false); }}>
                      <ArrowRight className="h-5 w-5 mr-3 text-blue-500" />
                      Go to Sales
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="Total Value" 
              value={`R ${metrics.total.toLocaleString('en-ZA')}`} 
              icon={<FileText className="h-4 w-4" />}
              gradient="bg-purple-500/10"
              className="border-l-4 border-l-purple-500"
            />
            <MetricCard 
              title="Total Quotes" 
              value={metrics.count.toString()} 
              icon={<LayoutDashboard className="h-4 w-4" />}
              gradient="bg-blue-500/10"
              className="border-l-4 border-l-blue-500"
            />
            <MetricCard 
              title="Accepted" 
              value={metrics.accepted.toString()} 
              icon={<CheckCircle2 className="h-4 w-4" />}
              gradient="bg-green-500/10"
              className="border-l-4 border-l-green-500"
            />
            <MetricCard 
              title="Drafts" 
              value={metrics.draft.toString()} 
              icon={<Clock className="h-4 w-4" />}
              gradient="bg-orange-500/10"
              className="border-l-4 border-l-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
               <CardHeader>
                <CardTitle>Quotes Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 mb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>From</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9" />
                      </div>
                      <div>
                        <Label>To</Label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9" />
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</Button>
                  </div>
                  
                  <Tabs value={tab} onValueChange={setTab} className="w-full">
                    <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                      <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 bg-transparent">All Quotes</TabsTrigger>
                      <TabsTrigger value="draft" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 bg-transparent">Drafts</TabsTrigger>
                      <TabsTrigger value="sent" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 bg-transparent">Sent</TabsTrigger>
                      <TabsTrigger value="accepted" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-2 bg-transparent">Accepted</TabsTrigger>
                    </TabsList>

                    <TabsContent value={tab} className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead>Quote #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
                            </TableRow>
                          ) : pagedQuotes.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No quotes found.</TableCell>
                            </TableRow>
                          ) : (
                            pagedQuotes.map((quote) => (
                              <TableRow key={quote.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium text-primary">{quote.quote_number}</TableCell>
                                <TableCell>{quote.customer_name}</TableCell>
                                <TableCell>{formatDate(quote.quote_date, dateFormat)}</TableCell>
                                <TableCell>{quote.expiry_date ? formatDate(quote.expiry_date, dateFormat) : "-"}</TableCell>
                                <TableCell className="text-right font-semibold">R {quote.total_amount.toLocaleString()}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                                    quote.status === 'converted' || quote.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                    quote.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                    quote.status === 'expired' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {quote.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {quote.status !== 'converted' && canEdit && (
                                      <Button size="icon" variant="ghost" onClick={() => convertToInvoice(quote)} className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" title="Convert to Invoice">
                                        <ArrowRight className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownloadQuote(quote)} title="Download PDF">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openSendDialog(quote)} disabled={!quote.customer_email} title="Email Quote">
                                      <Mail className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      {pagedQuotes.length > 0 && (
                        <div className="flex items-center justify-between mt-4 border-t pt-4">
                          <div className="text-xs text-muted-foreground">
                            Page {page + 1} of {Math.max(1, Math.ceil(totalCount / pageSize))} • Showing {pagedQuotes.length} of {totalCount}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={(page + 1) >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full flex justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
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
      
      <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
        <DialogContent className="sm:max-w-[640px] p-4">
          <DialogHeader>
            <DialogTitle>Sales Quotes Tutorial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This module is for viewing and downloading quotes.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Use the tabs to filter by status (Draft, Sent, Accepted).</li>
              <li>Convert quotes to invoices with a single click (Green Arrow).</li>
              <li>Download PDFs or email quotes directly to customers.</li>
              <li>To create new quotes, use the "Quick Actions" menu.</li>
            </ul>
          </div>
          <div className="pt-4">
            <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}