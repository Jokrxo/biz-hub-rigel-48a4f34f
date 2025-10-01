import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  quote_date: string;
  expiry_date: string | null;
  total_amount: number;
  status: string;
}

export const SalesQuotes = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("quote_date", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const convertToInvoice = async (quoteId: string, quote: Quote) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.from("invoices").insert({
        company_id: profile!.company_id,
        quote_id: quoteId,
        invoice_number: invoiceNumber,
        customer_name: quote.customer_name,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: quote.total_amount / 1.15,
        tax_amount: quote.total_amount * 0.15 / 1.15,
        total_amount: quote.total_amount,
        status: "draft",
      });

      if (error) throw error;

      await supabase
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quoteId);

      toast({ title: "Success", description: "Quote converted to invoice successfully" });
      loadQuotes();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.quote_number}</TableCell>
                  <TableCell>{quote.customer_name}</TableCell>
                  <TableCell>{new Date(quote.quote_date).toLocaleDateString()}</TableCell>
                  <TableCell>{quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right font-semibold">R {quote.total_amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      quote.status === 'accepted' ? 'bg-primary/10 text-primary' :
                      quote.status === 'sent' ? 'bg-accent/10 text-accent' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {quote.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {quote.status !== 'accepted' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => convertToInvoice(quote.id, quote)}
                        className="gap-2"
                      >
                        <ArrowRight className="h-3 w-3" />
                        Convert to Invoice
                      </Button>
                    )}
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
