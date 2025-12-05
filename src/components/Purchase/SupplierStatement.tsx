import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface Row {
  date: string;
  type: "PO" | "Payment";
  reference: string;
  description: string;
  debit: number; // increase liability
  credit: number; // reduce liability
}

export const SupplierStatement = ({ supplierId, supplierName, open, onOpenChange }: { supplierId: string; supplierName: string; open: boolean; onOpenChange: (v: boolean) => void }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  async function loadStatement() {
    if (!supplierId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRows([]); setOpeningBalance(0); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      const companyId = (profile as any)?.company_id;
      if (!companyId) { setRows([]); setOpeningBalance(0); return; }

      const { data: posAll } = await supabase
        .from('purchase_orders')
        .select('po_number, po_date, total_amount, supplier_id')
        .eq('company_id', companyId)
        .eq('supplier_id', supplierId);
      const poNumbers = (posAll || []).map((p: any) => String(p.po_number || '')).filter(Boolean);
      const { data: paysAll } = poNumbers.length > 0 ? await supabase
        .from('transactions')
        .select('reference_number, transaction_date, total_amount, transaction_type, status')
        .in('reference_number', poNumbers)
        .eq('company_id', companyId)
        .eq('transaction_type', 'payment') : { data: [] } as any;

      const openingPO = (posAll || []).filter((p: any) => p.po_date < startDate).reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
      const openingPay = (paysAll || []).filter((t: any) => t.transaction_date < startDate && t.status !== 'rejected').reduce((s: number, t: any) => s + Number(t.total_amount || 0), 0);
      setOpeningBalance(openingPO - openingPay);

      const posInRange = (posAll || []).filter((p: any) => p.po_date >= startDate && p.po_date <= endDate).map((p: any) => ({
        date: p.po_date,
        type: 'PO' as const,
        reference: String(p.po_number || ''),
        description: `Purchase Order ${p.po_number}`,
        debit: Number(p.total_amount || 0),
        credit: 0,
      }));
      const paysInRange = (paysAll || []).filter((t: any) => t.transaction_date >= startDate && t.transaction_date <= endDate && t.status !== 'rejected').map((t: any) => ({
        date: t.transaction_date,
        type: 'Payment' as const,
        reference: String(t.reference_number || ''),
        description: 'Payment',
        debit: 0,
        credit: Number(t.total_amount || 0),
      }));
      const combined = [...posInRange, ...paysInRange].sort((a, b) => a.date.localeCompare(b.date));
      setRows(combined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadStatement();
  }, [open, supplierId, startDate, endDate]);

  const closingBalance = useMemo(() => {
    const movement = rows.reduce((s, r) => s + r.debit - r.credit, 0);
    return openingBalance + movement;
  }, [rows, openingBalance]);

  function downloadCSV() {
    const header = ['Date','Type','Reference','Description','Debit','Credit'];
    const lines = rows.map(r => [r.date, r.type, r.reference, r.description, r.debit.toFixed(2), r.credit.toFixed(2)]);
    const csv = [header, ...lines].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Supplier_Statement_${supplierName}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Supplier Statement • {supplierName}</DialogTitle>
        </DialogHeader>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Statement Period</CardTitle>
              <div className="flex items-center gap-2">
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                <Button variant="outline" onClick={loadStatement} disabled={loading}>Refresh</Button>
                <Button onClick={downloadCSV} disabled={loading}>Download CSV</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm mb-2">Opening Balance: <span className="font-mono">R {openingBalance.toFixed(2)}</span></div>
            {loading ? (
              <div className="py-6 text-muted-foreground">Loading statement…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.reference}</TableCell>
                      <TableCell className="text-muted-foreground">{r.description}</TableCell>
                      <TableCell className="text-right">R {r.debit.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R {r.credit.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-medium">Closing Balance</TableCell>
                    <TableCell colSpan={2} className="text-right font-mono">R {closingBalance.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

