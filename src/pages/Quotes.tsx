import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, FileText, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    quote_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    total_amount: "",
  });

  useEffect(() => {
    loadQuotes();
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
              <Button variant="outline" disabled={quotes.length === 0}>
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
                    {quotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell className="font-medium">{quote.quote_number}</TableCell>
                        <TableCell>{quote.customer_name}</TableCell>
                        <TableCell>{new Date(quote.quote_date).toLocaleDateString()}</TableCell>
                        <TableCell>{quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString() : "-"}</TableCell>
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
                            <Button size="sm" variant="outline" onClick={() => toast({ title: "PDF export coming soon" })}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
