import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type Position = "VAT Payable" | "VAT Receivable" | "Neutral";
interface Vat201Row {
  period: string;
  vatOutput: number;
  vatInput: number;
  net: number;
  position: Position;
}
interface VatDetail { date: string; description: string; type: "Output VAT" | "Input VAT"; amount: number }

function formatMonth(dateStr: string) {
  const d = new Date(dateStr + "-01");
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
}

export const VAT201 = () => {
  const [rows, setRows] = useState<Vat201Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsByMonth, setDetailsByMonth] = useState<Record<string, VatDetail[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const exportCsv = () => {
    const header = ["Period", "VAT Output", "VAT Input", "Net (Input - Output)", "Position"];
    const lines = rows.map((r) => [
      r.period,
      r.vatOutput.toFixed(2),
      r.vatInput.toFixed(2),
      r.net.toFixed(2),
      r.position,
    ]);
    const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vat201-calculation.csv";
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

        // No date filter to ensure all VAT entries are included

        const { data: txs, error } = await supabase
          .from('transactions')
          .select('id, transaction_date, company_id, description, status, transaction_type, vat_rate, vat_inclusive, total_amount, vat_amount, base_amount')
          .eq('company_id', profile.company_id)
          .in('status', ['approved','posted','pending'])
          .order('transaction_date', { ascending: false });

        if (error) throw error;

        const byMonth: Record<string, { out: number; in: number }> = {};
        const details: Record<string, VatDetail[]> = {};

        for (const t of (txs || []) as any[]) {
          const type = String(t.transaction_type || '').toLowerCase();
          const isIncome = ['income','sales','receipt'].includes(type);
          const isPurchase = ['expense','purchase','bill','product_purchase'].includes(type);
          const rate = Number(t.vat_rate || 0);
          const total = Number(t.total_amount || 0);
          const base = Number(t.base_amount || 0);
          const inclusive = Boolean(t.vat_inclusive);
          let vat = Number(t.vat_amount || 0);
          let out = 0;
          let inn = 0;
          if (isIncome) {
            if (vat === 0 && rate > 0) {
              if (inclusive) {
                const net = base > 0 ? base : total / (1 + rate / 100);
                vat = total - net;
              } else {
                vat = total - (base > 0 ? base : total);
              }
            }
            out = Math.max(0, vat);
          } else if (isPurchase) {
            if (vat === 0 && rate > 0) {
              if (inclusive) {
                const net = base > 0 ? base : total / (1 + rate / 100);
                vat = total - net;
              } else {
                vat = total - (base > 0 ? base : total);
              }
            }
            inn = Math.max(0, vat);
          }
          const ym = String(t.transaction_date || '').slice(0, 7);
          const periodKey = formatMonth(ym);
          if (!byMonth[ym]) byMonth[ym] = { out: 0, in: 0 };
          byMonth[ym].out += out;
          byMonth[ym].in += inn;
          if (!details[periodKey]) details[periodKey] = [];
          if (out > 0) details[periodKey].push({ date: String(t.transaction_date || ''), description: t.description || '', type: 'Output VAT', amount: out });
          if (inn > 0) details[periodKey].push({ date: String(t.transaction_date || ''), description: t.description || '', type: 'Input VAT', amount: inn });
        }

        const result: Vat201Row[] = Object.keys(byMonth)
          .sort()
          .map((ym) => {
            const out = byMonth[ym].out;
            const inn = byMonth[ym].in;
            const net = inn - out;
            const position = (net > 0 ? "VAT Receivable" : net < 0 ? "VAT Payable" : "Neutral") as Position;
            return {
              period: formatMonth(ym),
              vatOutput: out,
              vatInput: inn,
              net,
              position,
            };
          })
          .reverse();

        setRows(result);
        setDetailsByMonth(details);
      } catch (e) {
        setRows([]);
        setDetailsByMonth({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const togglePeriod = (p: string) => {
    setExpanded(prev => ({ ...prev, [p]: !prev[p] }));
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>VAT201 Calculation</span>
          <Button variant="outline" onClick={exportCsv}>Export</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-6 text-muted-foreground">Loading VAT201…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">VAT Output</TableHead>
                <TableHead className="text-right">VAT Input</TableHead>
                <TableHead className="text-right">Net (Input - Output)</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <>
                  <TableRow key={row.period}>
                    <TableCell className="font-medium">{row.period}</TableCell>
                    <TableCell className="text-right">R {row.vatOutput.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">R {row.vatInput.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold">R {row.net.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{row.position}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" onClick={() => togglePeriod(row.period)}>{expanded[row.period] ? 'Hide' : 'Details'}</Button></TableCell>
                  </TableRow>
                  {expanded[row.period] && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">VAT Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(detailsByMonth[row.period] || []).map((d, i) => (
                              <TableRow key={i}>
                                <TableCell>{d.date}</TableCell>
                                <TableCell className="font-medium">{d.description}</TableCell>
                                <TableCell>{d.type}</TableCell>
                                <TableCell className="text-right">R {d.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
