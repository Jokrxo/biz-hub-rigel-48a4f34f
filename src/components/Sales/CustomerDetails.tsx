import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Customer } from "./CustomerForm";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { Plus, FileText, CreditCard, Receipt } from "lucide-react";

interface CustomerDetailsProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: Customer) => void;
}

export function CustomerDetails({ customer, open, onOpenChange, onEdit }: CustomerDetailsProps) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer && open) {
      loadHistory();
    }
  }, [customer, open]);

  const loadHistory = async () => {
    if (!customer) return;
    setLoading(true);

    const safeFetch = async (table: string, dateCol: string) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .or(`customer_id.eq.${customer.id},customer_name.eq."${customer.name}"`)
          .order(dateCol, { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        if (msg.includes("schema cache") || msg.includes("column")) {
           // Fallback: Fetch by company_id and filter in memory
           const { data } = await supabase
             .from(table)
             .select('*')
             .eq("company_id", customer.company_id)
             .order(dateCol, { ascending: false })
             .limit(200);
           return (data || []).filter((item: any) => 
             item.customer_id === customer.id || item.customer_name === customer.name
           );
        }
        return [];
      }
    };

    try {
      // Load Invoices
      const invData = await safeFetch('invoices', 'invoice_date');
      setInvoices(invData);

      // Load Quotes
      const quoteData = await safeFetch('quotes', 'quote_date');
      setQuotes(quoteData);

      // Load Payments (Transactions) - Special case for filter
      try {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('transaction_type', 'receipt')
          .or(`customer_id.eq.${customer.id},description.ilike.%${customer.name}%`)
          .order('transaction_date', { ascending: false });
        
        if (txError) throw txError;
        setPayments(txData || []);
      } catch (txErr: any) {
         const msg = String(txErr?.message || "").toLowerCase();
         if (msg.includes("schema cache") || msg.includes("column")) {
            const { data } = await supabase
             .from('transactions')
             .select('*')
             .eq('transaction_type', 'receipt')
             .eq("company_id", customer.company_id)
             .order('transaction_date', { ascending: false })
             .limit(200);
            
            setPayments((data || []).filter((t: any) => 
               t.customer_id === customer.id || (t.description || '').toLowerCase().includes(customer.name.toLowerCase())
            ));
         }
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!customer) return null;

  const totalSales = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  const outstanding = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0) - (Number(inv.amount_paid) || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[800px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <div className="flex justify-between items-start">
            <div>
              <SheetTitle className="text-2xl">{customer.name}</SheetTitle>
              <SheetDescription>{customer.customer_code}</SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(customer)}>Edit</Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-medium">Outstanding</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-2xl font-bold text-red-600">
                {formatCurrency(outstanding)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-medium">Credit Limit</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-2xl font-bold">
                {formatCurrency(customer.credit_limit)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 text-2xl font-bold text-green-600">
                {formatCurrency(totalSales)}
              </CardContent>
            </Card>
          </div>

          {/* Contact Info */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="grid grid-cols-2">
                <span className="text-muted-foreground">Email:</span>
                <span>{customer.email}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-muted-foreground">Phone:</span>
                <span>{customer.phone}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-muted-foreground">Contact Person:</span>
                <span>{customer.contact_person}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-muted-foreground">Address:</span>
                <span className="truncate">{customer.address}</span>
              </div>
              {customer.notes && (
                <div className="grid grid-cols-2">
                  <span className="text-muted-foreground">Notes:</span>
                  <span className="whitespace-pre-wrap">{customer.notes}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="invoices">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="quotes">Quotes</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="space-y-4">
              <div className="flex justify-end">
                {/* Placeholder for creating invoice from here - could link to main invoices page with query param */}
                <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Number</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>{new Date(inv.invoice_date).toLocaleDateString()}</TableCell>
                      <TableCell>{inv.invoice_number}</TableCell>
                      <TableCell>{formatCurrency(inv.total_amount)}</TableCell>
                      <TableCell><Badge variant={inv.status === 'paid' ? 'default' : 'secondary'}>{inv.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {invoices.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No invoices found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="quotes" className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> New Quote</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Number</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {quotes.map(q => (
                    <TableRow key={q.id}>
                      <TableCell>{new Date(q.quote_date).toLocaleDateString()}</TableCell>
                      <TableCell>{q.quote_number}</TableCell>
                      <TableCell>{formatCurrency(q.total_amount)}</TableCell>
                      <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {quotes.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No quotes found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
               <div className="flex justify-end">
                <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> New Receipt</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Ref</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell>{p.reference_number || '-'}</TableCell>
                      <TableCell>{formatCurrency(p.total_amount)}</TableCell>
                      <TableCell><Badge variant="default">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No payments found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
