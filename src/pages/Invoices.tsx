import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, FileText, Mail, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
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
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_email: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    total_amount: "",
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
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

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.from("invoices").insert({
        company_id: profile!.company_id,
        invoice_number: invoiceNumber,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email || null,
        invoice_date: formData.invoice_date,
        due_date: formData.due_date || null,
        total_amount: parseFloat(formData.total_amount),
        subtotal: parseFloat(formData.total_amount) / 1.15,
        tax_amount: parseFloat(formData.total_amount) * 0.15 / 1.15,
        status: "draft",
      });

      if (error) throw error;

      toast({ title: "Success", description: "Invoice created successfully" });
      setDialogOpen(false);
      setFormData({
        customer_name: "",
        customer_email: "",
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: "",
        total_amount: "",
      });
      loadInvoices();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

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
    
    toast({ title: "Coming soon", description: "Email functionality will be implemented with Resend integration" });
  };

  const canEdit = isAdmin || isAccountant;

  return (
    <>
      <SEO title="Invoices | ApexAccounts" description="Manage customer invoices" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Invoices</h1>
              <p className="text-muted-foreground mt-1">Create and manage customer invoices</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" disabled={invoices.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      New Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Invoice</DialogTitle>
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
                          <Label>Invoice Date</Label>
                          <Input
                            type="date"
                            value={formData.invoice_date}
                            onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={formData.due_date}
                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
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
                      <Button type="submit" className="w-full bg-gradient-primary">Create Invoice</Button>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.customer_name}</TableCell>
                        <TableCell>{new Date(invoice.invoice_date).toLocaleDateString()}</TableCell>
                        <TableCell>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-right font-semibold">R {invoice.total_amount.toLocaleString()}</TableCell>
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
                            <Button size="sm" variant="outline" onClick={() => toast({ title: "PDF export coming soon" })}>
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
        </div>
      </DashboardLayout>
    </>
  );
}
