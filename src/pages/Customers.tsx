import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Mail, Phone, Info, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { exportCustomerStatementToPDF } from "@/lib/export-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [monthsPreset, setMonthsPreset] = useState<string>("12");
  const [useCustomRange, setUseCustomRange] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_customers_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  const loadCustomers = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
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

      const { error } = await supabase.from("customers").insert({
        company_id: profile!.company_id,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Customer added successfully" });
      setDialogOpen(false);
      setFormData({ name: "", email: "", phone: "", address: "" });
      loadCustomers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = isAdmin || isAccountant;

  const downloadStatement = async (customer: Customer, start: string, end: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();
      if (!profile?.company_id) throw new Error("Company not found");

      const { data: periodInv, error: invErr1 } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_date, total_amount")
        .eq("company_id", profile.company_id)
        .eq("customer_name", customer.name)
        .gte("invoice_date", start)
        .lte("invoice_date", end)
        .order("invoice_date", { ascending: true });
      if (invErr1) throw invErr1;

      const { data: priorInv, error: invErr2 } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_date, total_amount")
        .eq("company_id", profile.company_id)
        .eq("customer_name", customer.name)
        .lt("invoice_date", start);
      if (invErr2) throw invErr2;

      const allNumbers = Array.from(new Set([...
        (periodInv || []).map((i: any) => String(i.invoice_number)),
        (priorInv || []).map((i: any) => String(i.invoice_number))
      ]));

      let txAll: any[] = [];
      if (allNumbers.length > 0) {
        const { data: tx, error: txErr } = await supabase
          .from("transactions")
          .select("reference_number, transaction_date, total_amount, description, transaction_type, status")
          .eq("company_id", profile.company_id)
          .eq("transaction_type", "receipt")
          .eq("status", "posted")
          .in("reference_number", allNumbers);
        if (txErr) throw txErr;
        txAll = tx || [];
      }

      const paymentsPrior = txAll.filter((t) => String(t.transaction_date) < start);
      const paymentsPeriod = txAll.filter((t) => String(t.transaction_date) >= start && String(t.transaction_date) <= end);

      const openingInvoicesTotal = (priorInv || []).reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
      const openingPaymentsTotal = paymentsPrior.reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
      const openingBalance = openingInvoicesTotal - openingPaymentsTotal;

      const entries = [
        ...((periodInv || []).map((r: any) => ({
          date: r.invoice_date,
          description: `Invoice ${r.invoice_number}`,
          reference: r.invoice_number,
          dr: Number(r.total_amount || 0),
          cr: 0,
        }))),
        ...(paymentsPeriod.map((t: any) => ({
          date: t.transaction_date,
          description: t.description || `Payment ${t.reference_number || ''}`.trim(),
          reference: t.reference_number || null,
          dr: 0,
          cr: Number(t.total_amount || 0),
        })))
      ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

      const periodLabel = `${new Date(start).toLocaleDateString('en-ZA')} – ${new Date(end).toLocaleDateString('en-ZA')}`;
      exportCustomerStatementToPDF(entries, customer.name, periodLabel, openingBalance, `statement_${customer.name.replace(/\s+/g,'_')}` , { email: customer.email || undefined, phone: customer.phone || undefined, address: customer.address || undefined });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openStatementDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setStatementOpen(true);
    setMonthsPreset("12");
    setUseCustomRange(false);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const exportStatement = async () => {
    if (!selectedCustomer) return;
    let start = startDate;
    let end = endDate;
    if (!useCustomRange) {
      const endDt = new Date();
      const months = parseInt(monthsPreset || "12");
      const startDt = new Date();
      startDt.setMonth(startDt.getMonth() - months);
      start = startDt.toISOString().split('T')[0];
      end = endDt.toISOString().split('T')[0];
    }
    await downloadStatement(selectedCustomer, start, end);
    setStatementOpen(false);
  };

  return (
    <>
      <SEO title="Customers | Rigel Business" description="Manage customer information" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Customers</h1>
              <p className="text-muted-foreground mt-1">Manage your customer database</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Customer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Customer</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label>Customer Name</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Address</Label>
                        <Input
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                      <Button type="submit" className="w-full bg-gradient-primary">Add Customer</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                All Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No customers yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          {customer.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{customer.address || "-"}</TableCell>
                        <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => openStatementDialog(customer)}>
                            <FileDown className="h-4 w-4 mr-2" /> Statement PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
          </Card>

          <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Statement Options</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quick period</Label>
                    <Select value={monthsPreset} onValueChange={setMonthsPreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Last 3 months</SelectItem>
                        <SelectItem value="6">Last 6 months</SelectItem>
                        <SelectItem value="12">Last 12 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={useCustomRange} onCheckedChange={setUseCustomRange} />
                    <Label>Use custom date range</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!useCustomRange} />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!useCustomRange} />
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={exportStatement} className="w-full bg-gradient-primary">Export PDF</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Customers Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>To issue an invoice, first add the customer here.</p>
                <p>Capture the customer’s basic information so invoices and statements reflect correct details.</p>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
