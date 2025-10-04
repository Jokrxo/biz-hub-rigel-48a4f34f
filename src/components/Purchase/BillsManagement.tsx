import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";

interface Bill {
  id: string;
  supplier_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  suppliers: { name: string };
}

export const BillsManagement = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    supplier_id: "",
    bill_date: new Date().toISOString().split("T")[0],
    due_date: "",
    total_amount: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) return;

      // Load suppliers
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", profile.company_id);

      setSuppliers(suppliersData || []);

      // Load bills
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          suppliers:customer_name
        `)
        .eq("company_id", profile.company_id)
        .eq("status", "draft")
        .order("bill_date", { ascending: false });

      if (error) throw error;
      // For now, bills are stored as invoices with type distinction
      setBills([]);
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

      const billNumber = `BILL-${Date.now().toString().slice(-6)}`;
      const supplier = suppliers.find(s => s.id === formData.supplier_id);

      // For now, store as invoice (proper bills table can be created later)
      const { error } = await supabase.from("invoices").insert({
        company_id: profile!.company_id,
        invoice_number: billNumber,
        customer_name: supplier?.name || "Supplier",
        invoice_date: formData.bill_date,
        due_date: formData.due_date || null,
        total_amount: parseFloat(formData.total_amount),
        subtotal: parseFloat(formData.total_amount) / 1.15,
        tax_amount: parseFloat(formData.total_amount) * 0.15 / 1.15,
        status: "draft",
      });

      if (error) throw error;

      toast({ title: "Success", description: "Bill created successfully" });
      setDialogOpen(false);
      setFormData({
        supplier_id: "",
        bill_date: new Date().toISOString().split("T")[0],
        due_date: "",
        total_amount: "",
      });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = isAdmin || isAccountant;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Bills (Supplier Invoices)
        </CardTitle>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                New Bill
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Bill</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Supplier</Label>
                  <Select value={formData.supplier_id} onValueChange={(val) => setFormData({ ...formData, supplier_id: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bill Date</Label>
                    <Input
                      type="date"
                      value={formData.bill_date}
                      onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-gradient-primary">Create Bill</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : bills.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No bills yet. Click "New Bill" to create your first supplier invoice.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.suppliers.name}</TableCell>
                  <TableCell>{new Date(bill.bill_date).toLocaleDateString()}</TableCell>
                  <TableCell>{bill.due_date ? new Date(bill.due_date).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right font-semibold">R {bill.total_amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                      {bill.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
