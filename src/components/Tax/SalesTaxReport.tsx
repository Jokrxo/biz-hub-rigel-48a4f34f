import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface VatRow {
  period: string;
  salesExclVat: number;
  vatCollected: number; // output VAT (credits)
  vatRate: string;
}
interface DetailRow { date: string; description: string; net: number; vat: number; total: number }

function formatMonth(dateStr: string) {
  const d = new Date(dateStr + "-01");
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
}

export const SalesTaxReport = () => {
  const [rows, setRows] = useState<VatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const exportCsv = () => {
    const header = ['Period','Sales Excl VAT','VAT Collected','Tax Rate'];
    const lines = rows.map(r => [r.period, r.salesExclVat.toFixed(2), r.vatCollected.toFixed(2), r.vatRate]);
    const csv = [header.join(','), ...lines.map(l => l.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-tax-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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

        // Get last 6 months
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 6);
        const from = fromDate.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("transaction_entries")
          .select(`
            debit, credit,
            transactions!inner(transaction_date, company_id, vat_rate, vat_inclusive, total_amount, description, status, transaction_type),
            chart_of_accounts!inner(account_name, account_type, account_code)
          `)
          .eq('transactions.company_id', profile.company_id)
          .gte('transactions.transaction_date', from)
          .eq('transactions.status', 'posted')
          .order('transactions.transaction_date', { ascending: false });

        if (error) throw error;

        const filtered = (data || []);

        const byMonth: Record<string, { vatCollected: number; salesExclVat: number; rate: number }> = {};
        const detail: DetailRow[] = [];
        for (const e of filtered as any[]) {
          const accName = (e.chart_of_accounts?.account_name || '').toLowerCase();
          const accCode = String(e.chart_of_accounts?.account_code || '');
          const isVatOutput = accName.includes('vat output') || accName.includes('vat payable') || accCode === '2100' || accName.includes('vat');
          const isIncomeTx = String(e.transactions?.transaction_type || '').toLowerCase() === 'income' || String(e.transactions?.transaction_type || '').toLowerCase() === 'sales';
          const credit = Number(e.credit || 0);
          const debit = Number(e.debit || 0);
          const txDate = e.transactions?.transaction_date || e.created_at?.slice(0, 10);
          const ym = (txDate || '').slice(0, 7);
          const rate = Number(e.transactions?.vat_rate || 0);
          if (!byMonth[ym]) byMonth[ym] = { vatCollected: 0, salesExclVat: 0, rate };
          if (isVatOutput && credit > debit && rate > 0) {
            const vat = credit - debit;
            byMonth[ym].vatCollected += vat;
            const inclusive = Boolean(e.transactions?.vat_inclusive);
            const total = Number(e.transactions?.total_amount || 0);
            const base = Number(e.transactions?.base_amount || 0);
            const net = base > 0 ? base : (inclusive ? total / (1 + rate / 100) : total - vat);
            byMonth[ym].salesExclVat += Math.max(0, net);
            detail.push({ date: txDate || '', description: e.transactions?.description || '', net: Math.max(0, net), vat, total });
          } else if (isIncomeTx && rate > 0 && Number(e.transactions?.vat_amount || 0) > 0) {
            const inclusive = Boolean(e.transactions?.vat_inclusive);
            const total = Number(e.transactions?.total_amount || 0);
            const base = Number(e.transactions?.base_amount || 0);
            const net = base > 0 ? base : (inclusive ? total / (1 + rate / 100) : total - Number(e.transactions?.vat_amount || 0));
            const vat = Number(e.transactions?.vat_amount || 0);
            byMonth[ym].vatCollected += Math.max(0, vat);
            byMonth[ym].salesExclVat += Math.max(0, net);
            detail.push({ date: txDate || '', description: e.transactions?.description || '', net, vat, total });
          }
        }

        if (filtered.length === 0) {
          const { data: txs } = await supabase
            .from('transactions')
            .select('transaction_date, company_id, vat_rate, vat_inclusive, total_amount, description, status, transaction_type, vat_amount, base_amount')
            .eq('company_id', profile.company_id)
            .gte('transaction_date', from)
            .eq('status', 'posted');
          for (const t of (txs || []) as any[]) {
            const type = String(t.transaction_type || '').toLowerCase();
            const isIncome = type === 'income' || type === 'sales' || type === 'receipt';
            const rate = Number(t.vat_rate || 0);
            const vat = Number(t.vat_amount || 0);
            if (!isIncome || rate <= 0 || vat <= 0) continue;
            const ym = String(t.transaction_date || '').slice(0, 7);
            if (!byMonth[ym]) byMonth[ym] = { vatCollected: 0, salesExclVat: 0, rate };
            const total = Number(t.total_amount || 0);
            const base = Number(t.base_amount || 0);
            const inclusive = Boolean(t.vat_inclusive);
            const net = base > 0 ? base : (inclusive ? total / (1 + rate / 100) : total - vat);
            byMonth[ym].vatCollected += vat;
            byMonth[ym].salesExclVat += Math.max(0, net);
            detail.push({ date: String(t.transaction_date || ''), description: t.description || '', net, vat, total });
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
        setDetails(detail.slice(0, 20));
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
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Sales Tax Report</span>
          <Button variant="outline" onClick={exportCsv}>Export</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-muted-foreground">Loading VAT report…</div>
        ) : (
          <>
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
          <div className="mt-6">
            <CardTitle className="text-sm font-medium mb-2">Recent VAT-bearing Sales</CardTitle>
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
