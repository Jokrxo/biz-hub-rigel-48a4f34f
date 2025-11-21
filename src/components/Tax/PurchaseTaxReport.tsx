import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VatRow { period: string; purchasesExclVat: number; vatInput: number; vatRate: string }
interface DetailRow { date: string; description: string; net: number; vat: number; total: number }

function formatMonth(dateStr: string) {
  const d = new Date(dateStr + "-01");
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
}

export const PurchaseTaxReport = () => {
  const [rows, setRows] = useState<VatRow[]>([]);
  const [details, setDetails] = useState<DetailRow[]>([]);
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

        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 6);
        const from = fromDate.toISOString().slice(0, 10);

        const { data } = await supabase
          .from("transaction_entries")
          .select(`
            debit, credit, created_at,
            transactions(transaction_date, company_id, vat_rate, vat_inclusive, total_amount, description, status, transaction_type),
            chart_of_accounts(account_name, account_type
            )
          `)
          .gte("created_at", from)
          .order("created_at", { ascending: false });

        const filtered = (data || []).filter((e: any) => e.transactions?.company_id === profile.company_id && (e.transactions?.status === 'approved' || e.transactions?.status === 'posted'));

        const byMonth: Record<string, { vatInput: number; purchasesExclVat: number; rate: number }> = {};
        const detail: DetailRow[] = [];
        for (const e of filtered as any[]) {
          const accName = (e.chart_of_accounts?.account_name || '').toLowerCase();
          const isVatInput = accName.includes('vat input') || accName.includes('vat receivable') || accName.includes('vat');
          const isExpenseTx = String(e.transactions?.transaction_type || '').toLowerCase() === 'expense';
          const isPurchaseTx = String(e.transactions?.transaction_type || '').toLowerCase() === 'purchase';
          const debit = Number(e.debit || 0);
          const credit = Number(e.credit || 0);
          const txDate = e.transactions?.transaction_date || e.created_at?.slice(0, 10);
          const ym = (txDate || '').slice(0, 7);
          const rate = Number(e.transactions?.vat_rate || 0);
          if (!byMonth[ym]) byMonth[ym] = { vatInput: 0, purchasesExclVat: 0, rate };
          if (isVatInput && debit > credit && rate > 0) {
            byMonth[ym].vatInput += debit - credit;
            const inclusive = Boolean(e.transactions?.vat_inclusive);
            const total = Number(e.transactions?.total_amount || 0);
            const base = Number(e.transactions?.base_amount || 0);
            const net = base > 0 ? base : (inclusive ? total / (1 + rate / 100) : total - (debit - credit));
            byMonth[ym].purchasesExclVat += Math.max(0, net);
            detail.push({ date: txDate || '', description: e.transactions?.description || '', net: Math.max(0, net), vat: debit - credit, total });
          } else if (isExpenseTx && rate > 0 && Number(e.transactions?.vat_amount || 0) > 0) {
            const inclusive = Boolean(e.transactions?.vat_inclusive);
            const total = Number(e.transactions?.total_amount || 0);
            const net = inclusive ? total - (total / (1 + rate / 100)) : total;
            const vat = inclusive ? total - net : (net * rate) / 100;
            byMonth[ym].vatInput += Math.max(0, vat);
            byMonth[ym].purchasesExclVat += Math.max(0, net);
            detail.push({ date: txDate || '', description: e.transactions?.description || '', net, vat, total });
          } else if (isPurchaseTx && rate > 0 && Number(e.transactions?.vat_amount || 0) > 0) {
            const inclusive = Boolean(e.transactions?.vat_inclusive);
            const total = Number(e.transactions?.total_amount || 0);
            const base = Number(e.transactions?.base_amount || 0);
            const vat = Number(e.transactions?.vat_amount || 0);
            const net = base > 0 ? base : (inclusive ? total / (1 + rate / 100) : total - vat);
            byMonth[ym].vatInput += Math.max(0, vat);
            byMonth[ym].purchasesExclVat += Math.max(0, net);
            detail.push({ date: txDate || '', description: e.transactions?.description || '', net, vat, total });
          }
        }

        const result: VatRow[] = Object.keys(byMonth)
          .sort()
          .map((ym) => ({
            period: formatMonth(ym),
            purchasesExclVat: byMonth[ym].purchasesExclVat,
            vatInput: byMonth[ym].vatInput,
            vatRate: `${byMonth[ym].rate}%`
          }))
          .reverse();

        setRows(result);
        setDetails(detail.slice(0, 20));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const exportCsv = () => {
    const header = ['Period','Purchases Excl VAT','VAT Input','VAT Rate'];
    const lines = rows.map(r => [r.period, r.purchasesExclVat.toFixed(2), r.vatInput.toFixed(2), r.vatRate]);
    const csv = [header.join(','), ...lines.map(l => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tax-expense-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Tax on Expense (Purchases)</span>
          <Button variant="outline" onClick={exportCsv}>Export</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-muted-foreground">Loading tax on expense…</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Purchases (excl. VAT)</TableHead>
                  <TableHead className="text-right">VAT Input</TableHead>
                  <TableHead className="text-right">Tax Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="font-medium">{row.period}</TableCell>
                    <TableCell className="text-right">R {row.purchasesExclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">R {row.vatInput.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{row.vatRate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-6">
              <CardTitle className="text-sm font-medium mb-2">Recent VAT-bearing Expenses</CardTitle>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>{d.date}</TableCell>
                      <TableCell className="font-medium">{d.description}</TableCell>
                      <TableCell className="text-right">R {d.net.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">R {d.vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">R {d.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};