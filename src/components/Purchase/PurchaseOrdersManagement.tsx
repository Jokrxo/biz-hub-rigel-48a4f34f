import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { transactionsApi } from "@/lib/transactions-api";

interface Supplier {
  id: string;
  name: string;
}

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  po_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  supplier_id: string;
  notes?: string;
  suppliers?: { name: string };
}

export const PurchaseOrdersManagement = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sentLoading, setSentLoading] = useState<string | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<PurchaseOrder | null>(null);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState<string>("");
  const [paidSoFar, setPaidSoFar] = useState<number>(0);
  const [paidMap, setPaidMap] = useState<Record<string, number>>({});
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; account_name: string }>>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const { toast } = useToast();

  const [form, setForm] = useState({
    po_date: new Date().toISOString().slice(0, 10),
    supplier_id: "",
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setOrders([]); setSuppliers([]); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) { setOrders([]); setSuppliers([]); return; }

      // Load suppliers
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");

      setSuppliers(suppliersData || []);
      const supplierNameMap = new Map<string, string>();
      (suppliersData || []).forEach((s: any) => supplierNameMap.set(s.id, s.name));

      // Load purchase orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from("purchase_orders")
        .select("id, po_number, po_date, status, subtotal, tax_amount, total_amount, supplier_id")
        .eq("company_id", (profile as any).company_id)
        .order("po_date", { ascending: false });
      if (ordersErr) throw ordersErr;

      // Map the data to match expected structure
      const mappedOrders = (ordersData || []).map((order: any) => ({
        ...order,
        supplierName: supplierNameMap.get(order.supplier_id) || "N/A",
      }));

      setOrders(mappedOrders as any);
      const poNumbers = mappedOrders.map((o: any) => o.po_number).filter(Boolean);
      if (poNumbers.length > 0) {
        const { data: payments } = await supabase
          .from('transactions')
          .select('reference_number,total_amount,transaction_type,status')
          .in('reference_number', poNumbers)
          .eq('transaction_type', 'payment')
          .eq('status', 'posted');
        const nextMap: Record<string, number> = {};
        (payments || []).forEach((p: any) => {
          const ref = String(p.reference_number || '');
          nextMap[ref] = (nextMap[ref] || 0) + Number(p.total_amount || 0);
        });
        setPaidMap(nextMap);
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
    setForm({
      ...form,
      items: [...form.items, { description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = form.items.filter((_, i) => i !== index);
    setForm({ ...form, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setForm({ ...form, items: newItems });
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    form.items.forEach(item => {
      const amount = item.quantity * item.unit_price;
      subtotal += amount;
      taxAmount += amount * (item.tax_rate / 100);
    });

    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const handleSubmit = async () => {
    try {
      if (!form.supplier_id || form.items.length === 0) {
        toast({ title: "Missing fields", description: "Please select supplier and add items", variant: "destructive" });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const totals = calculateTotals();
      
      // Generate PO number
      const poNumber = `PO-${Date.now()}`;

      // Create purchase order
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: profile.company_id,
          supplier_id: form.supplier_id,
          po_number: poNumber,
          po_date: form.po_date,
          subtotal: totals.subtotal,
          tax_amount: totals.taxAmount,
          total_amount: totals.total,
          notes: form.notes || null,
          status: "draft"
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create PO items
      const items = form.items.map(item => ({
        purchase_order_id: po.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        amount: item.quantity * item.unit_price * (1 + item.tax_rate / 100)
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(items);

      if (itemsError) throw itemsError;

      toast({ title: "Success", description: "Purchase order created successfully" });
      setShowForm(false);
      const supplierName = suppliers.find(s => s.id === form.supplier_id)?.name || "N/A";
      setOrders(prev => ([
        {
          id: po.id,
          po_number: po.po_number,
          po_date: po.po_date,
          status: po.status,
          subtotal: po.subtotal,
          tax_amount: po.tax_amount,
          total_amount: po.total_amount,
          supplier_id: po.supplier_id,
          suppliers: { name: supplierName },
          supplierName
        } as any,
        ...prev
      ]));
      
      // Reset form
      setForm({
        po_date: new Date().toISOString().slice(0, 10),
        supplier_id: "",
        notes: "",
        items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deletePO = async (id: string) => {
    if (!confirm("Delete this purchase order?")) return;

    try {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Success", description: "Purchase order deleted" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    const loadBankAccounts = async () => {
      try {
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
      } catch {}
    };
    loadBankAccounts();
  }, []);

  const markSent = async (order: PurchaseOrder) => {
    try {
      setSentLoading(order.id);
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "sent" })
        .eq("id", order.id);
      if (error) throw error;
      await transactionsApi.postPurchaseSentClient(order, order.po_date);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile) {
            const { data: poItems } = await supabase
              .from("purchase_order_items")
              .select("description, quantity, unit_price")
              .eq("purchase_order_id", order.id);
            for (const it of (poItems || [])) {
              const name = String(it.description || '').trim();
              if (!name) continue;
              const { data: existing } = await supabase
                .from("items")
                .select("id, quantity_on_hand")
                .eq("company_id", (profile as any).company_id)
                .eq("item_type", "product")
                .eq("name", name)
                .maybeSingle();
              if (existing?.id) {
                await supabase
                  .from("items")
                  .update({ 
                    quantity_on_hand: Number(existing.quantity_on_hand || 0) + Number(it.quantity || 0),
                    cost_price: Number(it.unit_price || 0)
                  })
                  .eq("id", existing.id);
              } else {
                await supabase
                  .from("items")
                  .insert({
                    company_id: (profile as any).company_id,
                    name,
                    description: name,
                    unit_price: Number(it.unit_price || 0),
                    cost_price: Number(it.unit_price || 0),
                    quantity_on_hand: Number(it.quantity || 0),
                    item_type: "product",
                  });
              }
            }
          }
        }
      } catch {}
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "sent" } : o));
      toast({ title: "Success", description: "Purchase order marked as Sent and posted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSentLoading(null);
    }
  };

  const openPayDialog = (order: PurchaseOrder) => {
    setPayOrder(order);
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayDialogOpen(true);
    (async () => {
      try {
        const { data: txs } = await supabase
          .from('transactions')
          .select('total_amount')
          .eq('reference_number', order.po_number)
          .eq('transaction_type', 'payment')
          .eq('status', 'posted');
        const paid = (txs || []).reduce((sum: number, t: any) => sum + Number(t.total_amount || 0), 0);
        setPaidSoFar(paid);
        const outstanding = Math.max(0, Number(order.total_amount || 0) - paid);
        setPayAmount(outstanding.toFixed(2));
      } catch {
        setPaidSoFar(0);
        setPayAmount(String(order.total_amount || 0));
      }
    })();
  };

  const confirmPayment = async () => {
    if (!payOrder || !selectedBankId) return;
    try {
      const amt = parseFloat(payAmount || '0');
      const outstanding = Math.max(0, Number((payOrder as any).total_amount || 0) - paidSoFar);
      if (!amt || amt <= 0) { throw new Error('Enter a valid payment amount'); }
      if (amt > outstanding + 0.0001) { throw new Error('Amount exceeds outstanding'); }
      await transactionsApi.postPurchasePaidClient(
        payOrder,
        payDate,
        selectedBankId,
        amt
      );
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: (amt >= outstanding ? "paid" : "sent") })
        .eq("id", (payOrder as any).id);
      if (error) throw error;
      const newPaid = paidSoFar + amt;
      setPaidMap(prev => ({ ...prev, [String(payOrder?.po_number || '')]: newPaid }));
      const fullySettled = newPaid >= Number((payOrder as any).total_amount || 0) - 0.0001;
      setOrders(prev => prev.map(o => o.id === (payOrder as any).id ? { ...o, status: (fullySettled ? "paid" : "sent") } : o));
      toast({ title: "Success", description: fullySettled ? "Payment posted and Purchase order marked as Paid" : "Partial payment posted" });
      setPayDialogOpen(false);
      setPayOrder(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const totals = calculateTotals();

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
          <p className="text-muted-foreground">Manage purchase orders</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto opacity-50 mb-4" />
              <p className="text-muted-foreground">No purchase orders yet</p>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono">{order.po_number}</TableCell>
                  <TableCell>{new Date(order.po_date).toLocaleDateString("en-ZA")}</TableCell>
                  <TableCell>{(order as any).supplierName || "N/A"}</TableCell>
                  <TableCell>
                    <Badge variant={order.status === "draft" ? "secondary" : "default"}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    R {Math.max(0, Number(order.total_amount || 0) - Number(paidMap[order.po_number] || 0)).toLocaleString('en-ZA')}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    R {order.total_amount.toLocaleString("en-ZA")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {order.status === 'draft' && (
                        <Button size="sm" onClick={() => markSent(order)} disabled={sentLoading === order.id}>
                          Sent
                        </Button>
                      )}
                      {order.status === 'sent' && (
                        <Button size="sm" variant="outline" onClick={() => openPayDialog(order)}>
                          Paid
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deletePO(order.id)}>
                        <Trash2 className="h-4 w-4" />
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.po_date}
                  onChange={(e) => setForm({ ...form, po_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Supplier *</Label>
                <Select value={form.supplier_id} onValueChange={(val) => setForm({ ...form, supplier_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Items</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                    <div className="col-span-4">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
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
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Create Purchase Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount to Pay (R)</Label>
              <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              <div className="text-xs text-muted-foreground mt-1">
                Outstanding: R {Math.max(0, Number(payOrder?.total_amount || 0) - paidSoFar).toLocaleString('en-ZA')}
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmPayment}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </div>
  );
};
