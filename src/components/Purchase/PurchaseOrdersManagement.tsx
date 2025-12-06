import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, FileText, Download, Search, MoreHorizontal, Calendar, Filter, Send, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { transactionsApi } from "@/lib/transactions-api";
import { TransactionFormEnhanced } from "@/components/Transactions/TransactionFormEnhanced";

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
  supplierName?: string;
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
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalEditData, setJournalEditData] = useState<any>(null);
  const [poSentDialogOpen, setPoSentDialogOpen] = useState(false);
  const [poSentOrder, setPoSentOrder] = useState<PurchaseOrder | null>(null);
  const [poSentDate, setPoSentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [poSentIncludeVAT, setPoSentIncludeVAT] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [form, setForm] = useState({
    po_date: new Date().toISOString().slice(0, 10),
    supplier_id: "",
    notes: "",
    items: [{ description: "", quantity: 1, unit_price: 0, tax_rate: 15 }]
  });

  const loadData = useCallback(async () => {
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
      const { data: suppliersData } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");
      setSuppliers(suppliersData || []);
      const supplierNameMap = new Map<string, string>();
      (suppliersData || []).forEach((s: any) => supplierNameMap.set(s.id, s.name));
      const { data: ordersData, error: ordersErr } = await supabase
        .from("purchase_orders")
        .select("id, po_number, po_date, status, subtotal, tax_amount, total_amount, supplier_id")
        .eq("company_id", (profile as any).company_id)
        .order("po_date", { ascending: false });
      if (ordersErr) throw ordersErr;
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
  }, [toast]);
  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.supplierName && order.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesDate = 
        (!startDate || order.po_date >= startDate) &&
        (!endDate || order.po_date <= endDate);

      return matchesSearch && matchesDate;
    });
  }, [orders, searchTerm, startDate, endDate]);

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

      const invalid = form.items.some(it => !String(it.description || '').trim() || Number(it.quantity || 0) <= 0 || Number(it.unit_price || 0) < 0);
      if (invalid) {
        toast({ title: "Invalid Items", description: "Each item needs a name, quantity > 0 and non-negative price", variant: "destructive" });
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

      try {
        const { data: existingItems } = await supabase
          .from("items")
          .select("id,name")
          .eq("company_id", profile.company_id)
          .eq("item_type", "product");

        const existingSet = new Set<string>((existingItems || []).map((it: any) => String(it.name || '').trim().toLowerCase()));
        const toInsert: any[] = [];

        for (const poi of items) {
          const nameKey = String((poi as any).description || '').trim().toLowerCase();
          if (!nameKey) return;
          if (existingSet.has(nameKey)) {
            await supabase
              .from("items")
              .update({ cost_price: Number((poi as any).unit_price || 0) })
              .eq("company_id", profile.company_id)
              .eq("item_type", "product")
              .eq("name", String((poi as any).description || '').trim());
          } else {
            toInsert.push({
              company_id: profile.company_id,
              name: String((poi as any).description || '').trim(),
              description: String((poi as any).description || '').trim(),
              item_type: "product",
              unit_price: Number((poi as any).unit_price || 0),
              cost_price: Number((poi as any).unit_price || 0),
              quantity_on_hand: 0
            });
          }
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from("items").insert(toInsert);
          if (insErr) throw insErr;
        }
        
      } catch (syncErr: any) {
        console.error("PO products sync error:", syncErr);
        toast({ title: "Product Sync Failed", description: String(syncErr?.message || syncErr), variant: "destructive" });
      }

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
      // Load PO to get company and reference
      const { data: po } = await supabase
        .from("purchase_orders")
        .select("po_number, company_id")
        .eq("id", id)
        .single();

      // Find related transactions by reference number (purchase, payment)
      if (po?.po_number) {
        const { data: txs } = await supabase
          .from("transactions")
          .select("id")
          .eq("reference_number", po.po_number);
        const txIds = (txs || []).map((t: any) => t.id);
        if (txIds.length > 0) {
          // Remove transaction entries and ledger entries for these transactions
          await supabase.from("transaction_entries").delete().in("transaction_id", txIds as any);
          await supabase.from("ledger_entries").delete().in("transaction_id", txIds as any);
          await supabase.from("ledger_entries").delete().in("reference_id", txIds as any);
          // Delete transactions
          await supabase.from("transactions").delete().in("id", txIds as any);
        }
      }

      // Delete PO items then PO
      await supabase.from("purchase_order_items").delete().eq("purchase_order_id", id);
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;

      // Refresh AFS cache
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("company_id")
            .eq("user_id", user.id)
            .maybeSingle();
          if (profile?.company_id) {
            await supabase.rpc('refresh_afs_cache', { _company_id: profile.company_id });
          }
        }
      } catch {}

      toast({ title: "Success", description: "Purchase order and postings deleted" });
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
      setPoSentOrder(order);
      setPoSentDate(new Date().toISOString().slice(0, 10));
      setPoSentIncludeVAT(true);
      setPoSentDialogOpen(true);
      return;
    } catch {}
  };

  const confirmPOSent = async () => {
    if (!poSentOrder) return;
    try {
      setSentLoading(poSentOrder.id);
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "sent" })
        .eq("id", poSentOrder.id);
      if (error) throw error;
      await openJournalForPOSent(poSentOrder, poSentDate, poSentIncludeVAT);
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
              .eq("purchase_order_id", poSentOrder.id);
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
      setOrders(prev => prev.map(o => o.id === poSentOrder.id ? { ...o, status: "sent" } : o));
      toast({ title: "Success", description: "Purchase order marked as Sent and posted" });
      setPoSentDialogOpen(false);
      setPoSentOrder(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSentLoading(null);
    }
  };

  const openJournalForPOSent = async (po: PurchaseOrder, postDateStr?: string, includeVAT?: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.company_id) return;
      const { data: accounts } = await supabase
        .from("chart_of_accounts")
        .select("id, account_name, account_type, account_code")
        .eq("company_id", profile.company_id)
        .eq("is_active", true);
      const list = (accounts || []).map(a => ({ id: String(a.id), name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
      const pick = (type: string, codes: string[], names: string[]) => {
        const byType = list.filter(a => a.type === type.toLowerCase());
        const byCode = byType.find(a => codes.includes(a.code));
        if (byCode) return byCode.id;
        const byName = byType.find(a => names.some(k => a.name.includes(k)));
        return byName?.id || byType[0]?.id || '';
      };
      const invId = pick('asset', ['1300'], ['inventory','stock']);
      const apId = pick('liability', ['2000'], ['accounts payable','payable']);
      const net = Number(po.subtotal || 0);
      const vat = Number(po.tax_amount || 0);
      const rate = net > 0 ? ((vat / net) * 100) : 0;
      const editData = {
        id: null,
        transaction_date: postDateStr || po.po_date,
        description: `PO ${po.po_number || po.id} sent`,
        reference_number: po.po_number || null,
        transaction_type: 'product_purchase',
        payment_method: 'accrual',
        debit_account_id: invId,
        credit_account_id: apId,
        total_amount: includeVAT ? Number(po.total_amount || 0) : net,
        bank_account_id: null,
        lockType: 'po_sent',
        vat_rate: includeVAT ? String(rate.toFixed(2)) : '0',
        amount_includes_vat: Boolean(includeVAT),
      };
      setJournalEditData(editData);
      setJournalOpen(true);
    } catch {}
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
    <Card className="card-professional">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <CardTitle>Purchase Orders</CardTitle>
          <Button onClick={() => setShowForm(true)} className="bg-gradient-primary shadow-elegant hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-2" />
            New Purchase Order
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO number or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              className="w-auto"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-muted-foreground">-</span>
            <Input 
              type="date" 
              className="w-auto"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No purchase orders found</p>
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
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">{order.po_number}</TableCell>
                    <TableCell>{new Date(order.po_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{(order as any).supplierName || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={
                        order.status === "paid" ? "default" : 
                        order.status === "sent" ? "secondary" : "outline"
                      } className={
                        order.status === "paid" ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200" :
                        order.status === "sent" ? "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200" : ""
                      }>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      R {Math.max(0, Number(order.total_amount || 0) - Number(paidMap[order.po_number] || 0)).toLocaleString('en-ZA')}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      R {order.total_amount.toLocaleString("en-ZA")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {order.status === 'draft' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => markSent(order)}
                            disabled={sentLoading === order.id}
                            title="Mark as Sent"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {order.status === 'sent' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => openPayDialog(order)}
                            title="Record Payment"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => deletePO(order.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>

      <Dialog open={poSentDialogOpen} onOpenChange={setPoSentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Post Sent Purchase</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Posting Date</Label>
              <Input type="date" value={poSentDate} onChange={(e) => setPoSentDate(e.target.value)} />
            </div>
            {poSentOrder && (
              <div className="p-3 border rounded bg-muted/30 space-y-1 text-sm">
                <div className="flex justify-between"><span>Amount (excl. VAT)</span><span className="font-mono">R {Number(poSentOrder.subtotal || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span>VAT amount</span><span className="font-mono">R {Number(poSentOrder.tax_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between"><span>Total</span><span className="font-mono">R {Number(poSentOrder.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex items-center gap-2 pt-2">
                  <Label htmlFor="includeVatPo">Include VAT in posting?</Label>
                  <input id="includeVatPo" type="checkbox" checked={poSentIncludeVAT} onChange={e => setPoSentIncludeVAT(e.target.checked)} />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPoSentDialogOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-primary" onClick={confirmPOSent}>Post</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

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
            <Button onClick={handleSubmit} className="bg-gradient-primary">Create Purchase Order</Button>
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
          <Button onClick={confirmPayment} className="bg-gradient-primary">Confirm</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <TransactionFormEnhanced open={journalOpen} onOpenChange={setJournalOpen} onSuccess={loadData} editData={journalEditData} />
    </Card>
  );
};
