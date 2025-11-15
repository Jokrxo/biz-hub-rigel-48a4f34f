import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VatRow {
  period: string;
  salesExclVat: number;
  vatCollected: number; // output VAT (credits)
  vatRate: string;
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr + "-01");
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
}

export const SalesTaxReport = () => {
  const [rows, setRows] = useState<VatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        if (!profile?.company_id) return;

        // Get last 6 months of VAT-related entries
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 6);
        const from = fromDate.toISOString().slice(0, 10);

        // Pull transactions and entries joined to accounts
        const { data, error } = await supabase
          .from("transaction_entries")
          .select(`
            debit, credit, created_at,
            transactions(transaction_date, company_id, vat_rate),
            chart_of_accounts(account_name, account_type)
          `)
          .gte("created_at", from)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const filtered = (data || []).filter((e: any) => (e.transactions?.company_id === profile.company_id));

        // Aggregate by year-month for VAT accounts (account name contains vat or tax)
        const byMonth: Record<string, { vatCollected: number; salesExclVat: number; rate: number } > = {};
        for (const e of filtered as any[]) {
          const accName = (e.chart_of_accounts?.account_name || "").toLowerCase();
          const isVat = accName.includes("vat") || accName.includes("tax");
          if (!isVat) continue;
          const txDate = e.transactions?.transaction_date || e.created_at?.slice(0, 10);
          const ym = (txDate || "").slice(0, 7); // YYYY-MM
          if (!byMonth[ym]) byMonth[ym] = { vatCollected: 0, salesExclVat: 0, rate: e.transactions?.vat_rate || 15 };
          // In SA, VAT Output is typically credits; treat credit as VAT collected
          const credit = Number(e.credit || 0);
          const debit = Number(e.debit || 0);
          byMonth[ym].vatCollected += Math.max(0, credit - debit);
          // Approximate sales excl VAT from VAT amount and rate
          const rate = Number(e.transactions?.vat_rate || 15);
          if (rate > 0) {
            const salesExcl = (credit - debit) * (100 / rate);
            byMonth[ym].salesExclVat += Math.max(0, salesExcl);
            byMonth[ym].rate = rate;
          }
        }

        const result: VatRow[] = Object.keys(byMonth)
          .sort()
          .map((ym) => ({
            period: formatMonth(ym),
            salesExclVat: byMonth[ym].salesExclVat,
            vatCollected: byMonth[ym].vatCollected,
            vatRate: `${byMonth[ym].rate}%`,
          }))
          .reverse();

        setRows(result);
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Sales Tax Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-muted-foreground">Loading VAT report…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Total Sales (excl. VAT)</TableHead>
                <TableHead className="text-right">VAT Collected</TableHead>
                <TableHead className="text-right">Tax Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.period}>
                  <TableCell className="font-medium">{row.period}</TableCell>
                  <TableCell className="text-right">R {row.salesExclVat.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">R {row.vatCollected.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right">{row.vatRate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
