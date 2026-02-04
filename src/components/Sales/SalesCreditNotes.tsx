import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  customer_id: string;
  invoice_id?: string;
  total_amount: number;
  status: string;
  reason: string;
  customer?: { name: string };
}

import { transactionsApi } from "@/lib/transactions-api";

export const SalesCreditNotes = () => {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customer_id: "",
    invoice_id: "none",
    credit_note_date: new Date().toISOString().split("T")[0],
    reason: "",
    total_amount: 0,
    items: [{ product_id: "", description: "", quantity: 1, unit_price: 0 }]
  });

  const loadData = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) return;

      const { data: cnData, error } = await supabase
        .from("credit_notes")
        .select("*, customer:customers(name)")
        .eq("company_id", profile.company_id)
        .order("credit_note_date", { ascending: false });

      if (error) throw error;
      setCreditNotes(cnData || []);

      const { data: custData } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");
      setCustomers(custData || []);

      const { data: invData } = await supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, status")
        .eq("company_id", profile.company_id)
        .neq("status", "draft")
        .order("invoice_date", { ascending: false });
      setInvoices(invData || []);

      const { data: prodData } = await supabase
        .from("items")
        .select("id, name, selling_price, type")
        .eq("company_id", profile.company_id)
        .eq("status", "active");
      setProducts(prodData || []);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      // Generate CN Number
      const { count } = await supabase
        .from("credit_notes")
        .select("*", { count: 'exact', head: true })
        .eq("company_id", profile.company_id);
      
      const cnNumber = `CN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

      // Calculate totals
      const subtotal = formData.items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
      const taxAmount = subtotal * 0.15; // 15% VAT
      const totalAmount = subtotal + taxAmount;

      // Insert Header
      const { data: cn, error: cnError } = await supabase
        .from("credit_notes")
        .insert({
          company_id: profile.company_id,
          credit_note_number: cnNumber,
          credit_note_date: formData.credit_note_date,
          customer_id: formData.customer_id,
          invoice_id: formData.invoice_id === "none" ? null : formData.invoice_id,
          reason: formData.reason,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          status: 'draft',
          created_by: user?.id
        })
        .select()
        .single();

      if (cnError) throw cnError;

      // Insert Items
      const itemsToInsert = formData.items.map(item => ({
        credit_note_id: cn.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        tax_rate: 15,
        product_id: item.product_id || null
      }));

      const { error: itemsError } = await supabase
        .from("credit_note_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({ title: "Success", description: "Credit Note created successfully" });
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (id: string) => {
    try {
      setLoading(true);
      await transactionsApi.postCreditNote(id);
      toast({ title: "Posted", description: "Credit Note posted and GL updated" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Green Masterfile Header */}
      <div className="bg-emerald-600 text-white p-4 rounded-t-md -mb-6 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Notes</h1>
          <div className="text-sm opacity-90">Manage customer credit notes and refunds</div>
        </div>
        <Button 
          onClick={() => setDialogOpen(true)}
          className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 font-semibold shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" /> New Credit Note
        </Button>
      </div>

      <Card className="shadow-sm pt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Credit Notes List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditNotes.map((cn) => (
                <TableRow key={cn.id}>
                  <TableCell className="font-medium">{cn.credit_note_number}</TableCell>
                  <TableCell>{cn.credit_note_date}</TableCell>
                  <TableCell>{cn.customer?.name}</TableCell>
                  <TableCell>{cn.reason}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cn.total_amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cn.status === 'posted' ? 'default' : 'secondary'}>
                      {cn.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {cn.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => handlePost(cn.id)}>
                        Post
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Credit Note</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select 
                  onValueChange={(val) => setFormData({...formData, customer_id: val})}
                  value={formData.customer_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={formData.credit_note_date}
                  onChange={(e) => setFormData({...formData, credit_note_date: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Linked Invoice (Optional)</Label>
              <Select 
                onValueChange={(val) => setFormData({...formData, invoice_id: val})}
                value={formData.invoice_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {invoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(inv.total_amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input 
                value={formData.reason} 
                onChange={(e) => setFormData({...formData, reason: e.target.value})} 
                placeholder="Return, Discount, etc."
              />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <div className="flex gap-2">
                      <Select
                        value={item.product_id}
                        onValueChange={(val) => {
                          const product = products.find(p => p.id === val);
                          const newItems = [...formData.items];
                          newItems[index].product_id = val;
                          if (product) {
                            newItems[index].description = product.name;
                            newItems[index].unit_price = product.selling_price;
                          }
                          setFormData({...formData, items: newItems});
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input 
                        placeholder="Description" 
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].description = e.target.value;
                          setFormData({...formData, items: newItems});
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      placeholder="Qty" 
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].quantity = Number(e.target.value);
                        setFormData({...formData, items: newItems});
                      }}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input 
                      type="number" 
                      placeholder="Price" 
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[index].unit_price = Number(e.target.value);
                        setFormData({...formData, items: newItems});
                      }}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        const newItems = formData.items.filter((_, i) => i !== index);
                        setFormData({...formData, items: newItems});
                      }}
                    >
                      <Plus className="h-4 w-4 rotate-45" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setFormData({...formData, items: [...formData.items, { product_id: "", description: "", quantity: 1, unit_price: 0 }]})}
              >
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
