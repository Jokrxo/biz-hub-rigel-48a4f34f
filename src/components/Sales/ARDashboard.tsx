import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";

interface InvoiceRow {
  id: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount_due: number;
  currency?: string | null;
  status: string;
}

type StatusScope = 'sent_overdue' | 'include_draft';

type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd91p';
type AgingRow = { name: string; due: number } & Record<AgingBucket, number>;

const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f59e0b", "#06b6d4", "#64748b", "#84cc16", "#f43f5e", "#0ea5e9"];

export const ARDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [statusScope, setStatusScope] = useState<StatusScope>('include_draft');

  useEffect(() => { loadData(); }, [periodStart, periodEnd, customerFilter, statusScope]);
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (periodEnd !== today) setPeriodEnd(today);
  }, [periodEnd]);
  useEffect(() => {
    const channel = supabase
      .channel('ar-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: companyProfile, error: profErr } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (profErr) throw profErr;
      if (!companyProfile?.company_id) throw new Error("Company not found");

      const { data, error } = await supabase
        .from("invoices")
        .select("id, customer_name, invoice_number, invoice_date, due_date, total_amount, status")
        .eq("company_id", companyProfile.company_id)
        .gte("invoice_date", periodStart)
        .lte("invoice_date", periodEnd)
        .order("invoice_date", { ascending: false });

      if (error) throw error;

      let rowsRaw: any[] = data || [];
      rowsRaw = rowsRaw.filter(r => {
        if (statusScope === 'sent_overdue') {
          return r.status === 'sent' || r.status === 'overdue';
        }
        return r.status !== 'paid' && r.status !== 'cancelled';
      });

      let rows: InvoiceRow[] = rowsRaw.map((r: any) => ({
        id: r.id,
        customer_name: r.customer_name,
        invoice_number: r.invoice_number,
        invoice_date: r.invoice_date,
        due_date: r.due_date,
        amount_due: r.status === 'paid' ? 0 : Number(r.total_amount || 0),
        status: r.status,
        currency: null,
      }));
      if (customerFilter !== "all") rows = rows.filter(r => r.customer_name === customerFilter);
      setInvoices(rows);
    } catch (e: any) {
      console.error("AR load error:", e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const customers = useMemo(() => {
    const uniq = new Map<string, string>();
    invoices.forEach(r => { if (r.customer_name) uniq.set(r.customer_name, r.customer_name); });
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
  }, [invoices]);

  // Hoisted function to avoid "Cannot access before initialization" runtime
  function diffDays(from?: string | null, to?: string | null) {
    if (!from || !to) return 0;
    const a = new Date(from).getTime();
    const b = new Date(to).getTime();
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  }

  const kpis = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    const unpaidTotal = invoices.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const overdue = invoices.filter(r => r.amount_due > 0 && r.due_date && r.due_date < now);
    const overdueTotal = overdue.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    // Under 30 days overdue (1–30)
    const overdueUnder30 = overdue.filter(r => {
      const d = r.due_date ? diffDays(r.due_date, now) : 0;
      return d > 0 && d <= 30;
    });
    // 31+ days overdue
    const overdue30 = overdue.filter(r => r.due_date ? diffDays(r.due_date, now) >= 31 : false);
    // 90+ days overdue
    const overdue90 = overdue.filter(r => r.due_date ? diffDays(r.due_date, now) >= 90 : false);

    const overdueUnder30Total = overdueUnder30.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const overdue30Total = overdue30.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const overdue90Total = overdue90.reduce((sum, r) => sum + (r.amount_due || 0), 0);

    return { unpaidTotal, overdueTotal, overdueUnder30Total, overdue30Total, overdue90Total };
  }, [invoices]);

  // diffDays hoisted above

  const top10Data = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number }>();
    invoices.forEach(r => {
      const key = r.customer_name || 'Unknown';
      const curr = totals.get(key) || { name: key, amount: 0 };
      curr.amount += r.amount_due || 0;
      totals.set(key, curr);
    });
    return Array.from(totals.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(r => ({ name: r.name, amount: r.amount }));
  }, [invoices]);

  const donutData = useMemo(() => {
    const total = invoices.reduce((sum, r) => sum + (r.amount_due || 0), 0) || 1;
    const buckets = new Map<string, { name: string; value: number }>();
    invoices.forEach(r => {
      const key = r.customer_name || 'Unknown';
      const curr = buckets.get(key) || { name: key, value: 0 };
      curr.value += r.amount_due || 0;
      buckets.set(key, curr);
    });
    return Array.from(buckets.values()).map(b => ({ name: b.name, value: b.value, pct: (b.value / total) * 100 }));
  }, [invoices]);

  const agingSummary = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    const rows = new Map<string, AgingRow>();
    invoices.forEach(r => {
      const key = r.customer_name || 'Unknown';
      const isOverdue = r.amount_due > 0 && r.due_date && r.due_date < now;
      const days = r.due_date ? diffDays(r.due_date, now) : 0;
      const bucket = !isOverdue ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd91p';
      const curr: AgingRow = rows.get(key) || { name: key, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91p: 0, due: 0 };
      const typedBucket: AgingBucket = bucket as AgingBucket;
      curr[typedBucket] += r.amount_due || 0;
      curr.due += r.amount_due || 0;
      rows.set(key, curr);
    });
    return Array.from(rows.entries()).map(([id, r]) => ({ customer_id: id, ...r }));
  }, [invoices]);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-900 shadow-sm">
        <CardHeader>
          <CardTitle>AR Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-56">
            <Label htmlFor="periodStart">Start</Label>
            <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="flex-1 min-w-56">
            <Label htmlFor="periodEnd">End</Label>
            <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} disabled />
          </div>
          <div className="min-w-56">
            <Label>Customer</Label>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Customer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-56">
            <Label>Statuses</Label>
            <Select value={statusScope} onValueChange={(v) => setStatusScope(v as StatusScope)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sent_overdue">Sent & Overdue</SelectItem>
                <SelectItem value="include_draft">Include Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="self-end flex gap-2">
            <Button onClick={loadData} disabled={loading}>Refresh</Button>
            <Button variant="outline" onClick={() => {
              setPeriodStart(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
              setPeriodEnd(new Date().toISOString().split('T')[0]);
              setCustomerFilter('all');
              setStatusScope('include_draft');
            }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {invoices.length === 0 ? (
        <Card className="shadow-md">
          <CardHeader><CardTitle>No invoices match your filters</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Try adjusting status or widening the date range. End date is fixed to today.</p>
          </CardContent>
        </Card>
      ) : (
       <>
         <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-md bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unpaid invoices amount (in home currency)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">R {kpis.unpaidTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-rose-50 to-white dark:from-rose-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">R {kpis.overdueTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue 1–30 days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">R {kpis.overdueUnder30Total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-amber-100 to-white dark:from-amber-900 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue 31+ days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-700">R {kpis.overdue30Total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue 90+ days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-700 dark:text-slate-200">R {kpis.overdue90Total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md">
          <CardHeader><CardTitle>Unpaid invoices amount (Top 10 Customers)</CardTitle></CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Data} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, "Amount"]} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader><CardTitle>Unpaid invoices percentage by customer</CardTitle></CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, _n, p: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, p?.payload?.name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader><CardTitle>AR Aging Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Customer</th>
                  <th className="p-2">Current</th>
                  <th className="p-2">1-30</th>
                  <th className="p-2">31-60</th>
                  <th className="p-2">61-90</th>
                  <th className="p-2">91+</th>
                  <th className="p-2">Amount due</th>
                </tr>
              </thead>
              <tbody>
                {agingSummary.map(row => (
                  <tr key={row.customer_id} className="border-t">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">R {row.current.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">R {row.d1_30.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">R {row.d31_60.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">R {row.d61_90.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">R {row.d91p.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                    <td className="p-2 font-semibold">R {row.due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader><CardTitle>Unpaid invoices</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Customer</th>
                  <th className="p-2">Invoice No.</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Due Date</th>
                  <th className="p-2">Amount due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-2">{inv.customer_name}</td>
                    <td className="p-2">{inv.invoice_number}</td>
                    <td className="p-2">{inv.invoice_date}</td>
                    <td className="p-2">{inv.due_date || '-'}</td>
                    <td className="p-2 font-mono">R {inv.amount_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
};

export default ARDashboard;