import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Mail, Trash2, Info } from "lucide-react";
import { exportInvoiceToPDF, buildInvoicePDF, addLogoToPDF, fetchLogoDataUrl, type InvoiceForPDF, type InvoiceItemForPDF, type CompanyForPDF } from '@/lib/invoice-export';
import { exportInvoicesToExcel } from '@/lib/export-utils';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string | null;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  status: string;
  amount_paid?: number;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [tutorialOpen, setTutorialOpen] = useState(false);


  const filteredInvoices = invoices.filter((inv) => {
    const total = Number(inv.total_amount || 0);
    const paid = Number(inv.amount_paid || 0);
    const outstanding = Math.max(0, total - paid);
    const d = new Date(inv.invoice_date);
    const matchesYear = yearFilter === 'all' || String(d.getFullYear()) === yearFilter;
    const matchesMonth = monthFilter === 'all' || String(d.getMonth() + 1).padStart(2, '0') === monthFilter;
    switch (statusFilter) {
      case 'unpaid':
        return inv.status !== 'paid' && outstanding > 0 && matchesYear && matchesMonth;
      case 'paid':
        return (inv.status === 'paid' || outstanding === 0) && matchesYear && matchesMonth;
      case 'draft':
        return inv.status === 'draft' && matchesYear && matchesMonth;
      case 'cancelled':
        return inv.status === 'cancelled' && matchesYear && matchesMonth;
      case 'overdue':
        return inv.status === 'overdue' && matchesYear && matchesMonth;
      default:
        return matchesYear && matchesMonth;
    }
  });

  const exportAllInvoices = () => {
    const filename = `invoices_${statusFilter}`;
    exportInvoicesToExcel(filteredInvoices as any, filename);
  };

  const loadInvoices = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("invoice_date", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_invoices_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user?.id]);

  


  const handleDelete = async (id: string) => {
    if (!isAdmin && !isAccountant) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }
    
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    
    try {
      // Delete related invoice_items first
      await supabase.from("invoice_items").delete().eq("invoice_id", id);
      
      // Delete invoice
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "Success", description: "Invoice deleted successfully" });
      loadInvoices();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSendEmail = async (invoice: Invoice) => {
    if (!invoice.customer_email) {
      toast({ title: "Error", description: "No email address for this customer", variant: "destructive" });
      return;
    }
    try {
      const company: CompanyForPDF = await fetchCompanyForPDF();
      const items: any[] = await fetchInvoiceItemsForPDF(invoice.id);
      const dto = mapInvoiceForPDF(invoice);
      const doc = buildInvoicePDF(dto, items as InvoiceItemForPDF[], company);
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
        `Hello,`,
        `Please find your Invoice ${dto.invoice_number}.`,
        `Total due: R ${dto.total_amount}.`,
        publicUrl ? `Download your invoice: ${publicUrl}` : ''
      ].filter(Boolean).join('\n');
      const body = encodeURIComponent(bodyLines);
      window.location.href = `mailto:${invoice.customer_email}?subject=${subject}&body=${body}`;
      toast({ title: 'Success', description: 'Email compose opened with invoice link' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to prepare email', variant: 'destructive' });
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const company: CompanyForPDF = await fetchCompanyForPDF();
      const items: any[] = await fetchInvoiceItemsForPDF(invoice.id);
      const dto = mapInvoiceForPDF(invoice);
      const doc = buildInvoicePDF(dto, items as InvoiceItemForPDF[], company);
      const logoDataUrl = await fetchLogoDataUrl(company.logo_url);
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      doc.save(`invoice_${dto.invoice_number}.pdf`);
      toast({ title: 'Success', description: 'Invoice PDF downloaded' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to download invoice PDF', variant: 'destructive' });
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

  const fetchInvoiceItemsForPDF = async (invoiceId: string): Promise<InvoiceItemForPDF[]> => {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('description,quantity,unit_price,tax_rate')
      .eq('invoice_id', invoiceId);
    if (error || !data) return [];
    return data as any;
  };

  const mapInvoiceForPDF = (inv: any): InvoiceForPDF => ({
    invoice_number: inv.invoice_number || String(inv.id),
    invoice_date: inv.invoice_date || new Date().toISOString(),
    due_date: inv.due_date || null,
    customer_name: inv.customer_name || 'Customer',
    customer_email: inv.customer_email || null,
    notes: null,
    subtotal: (inv.subtotal ?? inv.total_amount ?? 0) - (inv.tax_amount ?? 0),
    tax_amount: inv.tax_amount ?? 0,
    total_amount: inv.total_amount ?? 0,
  });

  const canEdit = isAdmin || isAccountant;

  return (
    <>
      <SEO title="Invoices | Rigel Business" description="Manage customer invoices" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Invoices</h1>
              <p className="text-muted-foreground mt-1">View and download customer invoices</p>
            </div>
            <div className="flex gap-3 items-center">
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
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" disabled={invoices.length === 0} onClick={exportAllInvoices}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                All Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No invoices yet</div>
              ) : (
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
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.customer_name}</TableCell>
                        <TableCell>{new Date(invoice.invoice_date).toLocaleDateString('en-ZA')}</TableCell>
                        <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-ZA') : "-"}</TableCell>
                        <TableCell className="text-right font-semibold">R {Number(invoice.total_amount).toLocaleString('en-ZA')}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">R {Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0)).toLocaleString('en-ZA')}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            invoice.status === 'paid' ? 'bg-primary/10 text-primary' :
                            invoice.status === 'sent' ? 'bg-accent/10 text-accent' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {invoice.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(invoice)}>
                              <Download className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSendEmail(invoice)} disabled={!invoice.customer_email}>
                              <Mail className="h-3 w-3" />
                            </Button>
                            {canEdit && (
                              <Button size="sm" variant="outline" onClick={() => handleDelete(invoice.id)} className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3 w-3" />
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
        </Card>

        <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
          <DialogContent className="sm:max-w-[560px] p-4">
            <DialogHeader>
              <DialogTitle>Invoices Tutorial</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>This module is for viewing and downloading invoices.</p>
              <p>To add and issue a new invoice, go to <strong>Sales → Invoices</strong>.</p>
              <p>Use the filters to find invoices by year, month and status, and export the list.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
