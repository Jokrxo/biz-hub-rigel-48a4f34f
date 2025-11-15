import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";

interface Bill {
  id: string;
  supplier_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
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
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
  });

  useEffect(() => {
    loadData();

    // Real-time updates
    const channel = supabase
      .channel('bills-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
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

      // Load suppliers
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("name");

      setSuppliers(suppliersData || []);

      // Load bills
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          suppliers:supplier_id (name)
        `)
        .eq("company_id", profile.company_id)
        .order("bill_date", { ascending: false });

      if (error) throw error;
      setBills(data as any || []);
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

      const billNumber = `BILL-${Date.now().toString().slice(-6)}`;
      const totals = calculateTotals();

      const { data: bill, error: billError } = await supabase
        .from("bills")
        .insert({
          company_id: profile!.company_id,
          supplier_id: formData.supplier_id,
          bill_number: billNumber,
          bill_date: formData.bill_date,
          due_date: formData.due_date || null,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total_amount: totals.total,
          notes: formData.notes || null,
          status: "pending"
        })
        .select()
        .single();

      if (billError) throw billError;

      // Create bill items
      const items = formData.items.map(item => ({
        bill_id: bill.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100)
      }));

      const { error: itemsError } = await supabase
        .from("bill_items")
        .insert(items);

      if (itemsError) throw itemsError;

      toast({ title: "Success", description: "Bill created successfully" });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_id: "",
      bill_date: new Date().toISOString().split("T")[0],
      due_date: "",
      total_amount: "",
      notes: "",
      items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
    });
  };

  const deleteBill = async (id: string) => {
    if (!confirm("Delete this bill?")) return;
    try {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Bill deleted" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = isAdmin || isAccountant;
  const totals = calculateTotals();

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Bills (Supplier Invoices)
        </CardTitle>
        {canEdit && (
          <Button size="sm" className="bg-gradient-primary" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Bill
          </Button>
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
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.suppliers?.name || "N/A"}</TableCell>
                  <TableCell>{new Date(bill.bill_date).toLocaleDateString('en-ZA')}</TableCell>
                  <TableCell>{bill.due_date ? new Date(bill.due_date).toLocaleDateString('en-ZA') : "-"}</TableCell>
                  <TableCell className="text-right font-semibold">R {Number(bill.total_amount).toLocaleString('en-ZA')}</TableCell>
                  <TableCell>
                    <Badge variant={bill.status === 'paid' ? 'default' : bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                      {bill.status}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteBill(bill.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Supplier *</Label>
                <Select value={formData.supplier_id} onValueChange={(val) => setFormData({ ...formData, supplier_id: val })} required>
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
              <div>
                <Label>Bill Date *</Label>
                <Input
                  type="date"
                  value={formData.bill_date}
                  onChange={(e) => setFormData({ ...formData, bill_date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
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
              <Button type="submit" className="bg-gradient-primary">Create Bill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};