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
import { transactionsApi } from "@/lib/transactions-api";

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
  const [sentLoading, setSentLoading] = useState<string | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payBill, setPayBill] = useState<Bill | null>(null);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; account_name: string }>>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [paidMap, setPaidMap] = useState<Record<string, number>>({});
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

  useEffect(() => {
    const loadBanks = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) return;
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, account_name")
        .eq("company_id", (profile as any).company_id)
        .order("created_at", { ascending: false });
      setBankAccounts((data || []).map((b: any) => ({ id: b.id, account_name: b.account_name })));
    };
    loadBanks();
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
      const billNumbers = (data || []).map((b: any) => b.bill_number).filter(Boolean);
      if (billNumbers.length > 0) {
        const { data: pays } = await supabase
          .from("transactions")
          .select("reference_number,total_amount,transaction_type,status")
          .in("reference_number", billNumbers)
          .eq("transaction_type", "payment")
          .eq("status", "posted");
        const map: Record<string, number> = {};
        (pays || []).forEach((t: any) => {
          const ref = String(t.reference_number || "");
          map[ref] = (map[ref] || 0) + Number(t.total_amount || 0);
        });
        setPaidMap(map);
      } else {
        setPaidMap({});
      }
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

      // Validate items
      const invalid = formData.items.some(it => !String(it.description || '').trim() || Number(it.quantity || 0) <= 0 || Number(it.unit_price || 0) < 0);
      if (invalid) {
        toast({ title: "Invalid Items", description: "Each item needs a name, quantity > 0 and non-negative price", variant: "destructive" });
        return;
      }

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

      try {
        const { data: existingItems } = await supabase
          .from("items")
          .select("id,name,quantity_on_hand")
          .eq("company_id", profile!.company_id)
          .eq("item_type", "product");

        const existingMap = new Map<string, { id: string; qty: number }>();
        (existingItems || []).forEach((it: any) => {
          existingMap.set(String(it.name || '').trim().toLowerCase(), { id: it.id, qty: Number(it.quantity_on_hand || 0) });
        });

        const toInsert: any[] = [];
        const updatePromises: Promise<any>[] = [];

        items.forEach((bi) => {
          const nameKey = String(bi.description || '').trim().toLowerCase();
          if (!nameKey) return;
          const found = existingMap.get(nameKey);
          if (found) {
            updatePromises.push(
              supabase
                .from("items")
                .update({
                  cost_price: Number((bi as any).unit_price || 0),
                  quantity_on_hand: found.qty + Number((bi as any).quantity || 0)
                })
                .eq("id", found.id)
            );
          } else {
            toInsert.push({
              company_id: profile!.company_id,
              name: String((bi as any).description || '').trim(),
              description: String((bi as any).description || '').trim(),
              item_type: "product",
              unit_price: Number((bi as any).unit_price || 0),
              cost_price: Number((bi as any).unit_price || 0),
              quantity_on_hand: Number((bi as any).quantity || 0)
            });
          }
        });

        if (toInsert.length > 0) {
          const { error: insertErr } = await supabase.from("items").insert(toInsert);
          if (insertErr) throw insertErr;
        }
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
        toast({ title: "Products Updated", description: "Purchased items synced to Sales products" });
      } catch (syncErr: any) {
        console.error("Products sync error:", syncErr);
        toast({ title: "Product Sync Failed", description: String(syncErr?.message || syncErr), variant: "destructive" });
      }

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

  const markSent = async (bill: Bill) => {
    try {
      setSentLoading(bill.id);
      const { error } = await supabase
        .from("bills")
        .update({ status: "pending" })
        .eq("id", bill.id);
      if (error) throw error;
      await transactionsApi.postBillRecordedClient(bill, bill.bill_date);
      setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: "pending" } : b));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSentLoading(null);
    }
  };

  const openPayDialog = (bill: Bill) => {
    setPayBill(bill);
    setPayDate(new Date().toISOString().split("T")[0]);
    const outstanding = Math.max(0, Number(bill.total_amount || 0) - Number(paidMap[bill.bill_number] || 0));
    setPayAmount(outstanding.toFixed(2));
    setPayDialogOpen(true);
  };

  const confirmPayment = async () => {
    if (!payBill || !selectedBankId) return;
    try {
      const amt = parseFloat(payAmount || '0');
      const outstanding = Math.max(0, Number((payBill as any).total_amount || 0) - Number(paidMap[(payBill as any).bill_number] || 0));
      if (!amt || amt <= 0) throw new Error('Enter a valid payment amount');
      if (amt > outstanding + 0.0001) throw new Error('Amount exceeds outstanding');
      await transactionsApi.postBillPaidClient(payBill, payDate, selectedBankId, amt);
      const { error } = await supabase
        .from("bills")
        .update({ status: (amt >= outstanding ? "paid" : "sent") })
        .eq("id", (payBill as any).id);
      if (error) throw error;
      const newPaid = Number(paidMap[(payBill as any).bill_number] || 0) + amt;
      setPaidMap(prev => ({ ...prev, [String((payBill as any).bill_number || '')]: newPaid }));
      const fullySettled = newPaid >= Number((payBill as any).total_amount || 0) - 0.0001;
      setBills(prev => prev.map(b => b.id === (payBill as any).id ? { ...b, status: (fullySettled ? "paid" : "sent") } : b));
      setPayDialogOpen(false);
      setPayBill(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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
                <TableHead className="text-right">Outstanding</TableHead>
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
                  <TableCell className="text-right font-mono">R {Math.max(0, Number(bill.total_amount || 0) - Number(paidMap[bill.bill_number] || 0)).toLocaleString('en-ZA')}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-2">
                        {bill.status !== 'paid' && (
                          <Button size="sm" onClick={() => markSent(bill)} disabled={sentLoading === bill.id}>Sent</Button>
                        )}
                        {bill.status === 'pending' && (
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(bill)}>Paid</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => deleteBill(bill.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Bill Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div>
                <Label>Amount to Pay (R)</Label>
                <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <div className="text-xs text-muted-foreground mt-1">
                  Outstanding: R {Math.max(0, Number(payBill?.total_amount || 0) - Number(paidMap[payBill?.bill_number || ''] || 0)).toLocaleString('en-ZA')}
                </div>
              </div>
            </div>
            <div>
              <Label>Bank Account</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmPayment}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};