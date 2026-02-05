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
import { Plus, Search, CheckCircle2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Receipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  status: string;
  po_number?: string;
  customer?: { name: string };
}

import { transactionsApi } from "@/lib/transactions-api";

export const SalesReceipts = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [openInvoices, setOpenInvoices] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    customer_id: "",
    receipt_date: new Date().toISOString().split("T")[0],
    amount: 0,
    payment_method: "EFT",
    reference: "",
    po_number: "",
    allocations: {} as Record<string, number> // invoice_id -> amount
  });

  const loadData = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (!profile) return;

      const { data: recData, error } = await supabase
        .from("receipts")
        .select("*, customer:customers(name)")
        .eq("company_id", profile.company_id)
        .order("receipt_date", { ascending: false });

      if (error) throw error;
      setReceipts(recData || []);

      const { data: custData } = await supabase
        .from("customers")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .order("name");
      setCustomers(custData || []);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadOpenInvoices = async (customerId: string) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user?.id).single();
      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", profile?.company_id)
        .eq("customer_id", customerId)
        .in("status", ["sent", "partial"]) // Assuming 'partial' exists or we check balance
        .order("invoice_date");
      
      // In a real app we would check outstanding balance per invoice
      setOpenInvoices(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (formData.customer_id) {
      loadOpenInvoices(formData.customer_id);
    }
  }, [formData.customer_id]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user?.id).single();

      // Generate Receipt Number
      const { count } = await supabase
        .from("receipts")
        .select("*", { count: 'exact', head: true })
        .eq("company_id", profile?.company_id);
      
      const recNumber = `REC-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

      // Insert Receipt
      const { data: rec, error: recError } = await supabase
        .from("receipts")
        .insert({
          company_id: profile?.company_id,
          receipt_number: recNumber,
          receipt_date: formData.receipt_date,
          customer_id: formData.customer_id,
          amount: formData.amount,
          payment_method: formData.payment_method,
          reference: formData.reference,
          po_number: formData.po_number,
          status: 'draft',
          created_by: user?.id
        })
        .select()
        .single();

      if (recError) throw recError;

      // Insert Allocations
      const allocations = Object.entries(formData.allocations)
        .filter(([_, amount]) => amount > 0)
        .map(([invoiceId, amount]) => ({
          receipt_id: rec.id,
          invoice_id: invoiceId,
          amount
        }));

      if (allocations.length > 0) {
        const { error: allocError } = await supabase
          .from("receipt_allocations")
          .insert(allocations);
        if (allocError) throw allocError;
      }

      toast({ title: "Success", description: "Receipt created successfully" });
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
      await transactionsApi.postReceipt(id);
      toast({ title: "Posted", description: "Receipt posted and GL updated" });
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
          <h1 className="text-2xl font-bold tracking-tight">Receipts</h1>
          <div className="text-sm opacity-90">Manage customer payments and receipts</div>
        </div>
        <Button 
          onClick={() => setDialogOpen(true)}
          className="bg-white text-emerald-700 hover:bg-emerald-50 border-0 font-semibold shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" /> New Receipt
        </Button>
      </div>

      <Card className="shadow-sm pt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Receipts List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-medium">{rec.receipt_number}</TableCell>
                  <TableCell>{rec.po_number || '-'}</TableCell>
                  <TableCell>{rec.receipt_date}</TableCell>
                  <TableCell>{rec.customer?.name}</TableCell>
                  <TableCell>{rec.payment_method}</TableCell>
                  <TableCell className="text-right">
                    {new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(rec.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={rec.status === 'posted' ? 'default' : 'secondary'}>
                      {rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {rec.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => handlePost(rec.id)}>
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
            <DialogTitle>Receive Payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select 
                  onValueChange={(val) => setFormData({...formData, customer_id: val, allocations: {}})}
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
                  value={formData.receipt_date}
                  onChange={(e) => setFormData({...formData, receipt_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>PO Number</Label>
                <Input 
                  value={formData.po_number}
                  onChange={(e) => setFormData({...formData, po_number: e.target.value})}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount Received</Label>
                <Input 
                  type="number" 
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select 
                  onValueChange={(val) => setFormData({...formData, payment_method: val})}
                  value={formData.payment_method}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFT">EFT</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {openInvoices.length > 0 && (
              <div className="space-y-2">
                <Label>Allocate to Invoices</Label>
                <div className="border rounded-md p-2 max-h-40 overflow-y-auto">
                  {openInvoices.map(inv => (
                    <div key={inv.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div className="text-sm">
                        <div className="font-medium">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">{inv.invoice_date} - Total: {inv.total_amount}</div>
                      </div>
                      <Input 
                        className="w-24 h-8"
                        type="number"
                        placeholder="Alloc"
                        value={formData.allocations[inv.id] || ''}
                        onChange={(e) => setFormData({
                          ...formData, 
                          allocations: {
                            ...formData.allocations, 
                            [inv.id]: Number(e.target.value)
                          }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
