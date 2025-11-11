import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";

interface InvoiceRow {
  id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount_due: number;
  currency?: string | null;
  status: string;
}

const COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#f59e0b", "#06b6d4", "#64748b", "#84cc16", "#f43f5e", "#0ea5e9"];

export const ARDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [periodStart, setPeriodStart] = useState("2024-10-01");
  const [periodEnd, setPeriodEnd] = useState("2025-10-02");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  useEffect(() => { loadData(); }, [periodStart, periodEnd, customerFilter]);

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

      // Attempt to load invoices from Sales module; adapt table name if needed
      // Expected columns: id, customer_id, customer_name, invoice_number, issue_date, due_date, amount_due, status
      const { data, error } = await supabase
        .from("invoices")
        .select("id, customer_id, customer_name, invoice_number, issue_date, due_date, amount_due, status")
        .eq("company_id", companyProfile.company_id)
        .gte("issue_date", periodStart)
        .lte("issue_date", periodEnd)
        .in("status", ["unpaid", "overdue"]) // unpaid scope
        .order("issue_date", { ascending: false });

      if (error) throw error;
      let rows: any[] = data || [];
      if (customerFilter !== "all") rows = rows.filter(r => r.customer_id === customerFilter);
      setInvoices(rows as InvoiceRow[]);
    } catch (e: any) {
      console.error("AR load error:", e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const customers = useMemo(() => {
    const uniq = new Map<string, string>();
    invoices.forEach(r => { if (r.customer_id && r.customer_name) uniq.set(r.customer_id, r.customer_name); });
    return Array.from(uniq.entries()).map(([id, name]) => ({ id, name }));
  }, [invoices]);

  // KPI calculations
  const kpis = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    const unpaidTotal = invoices.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const overdue = invoices.filter(r => r.due_date < now);
    const overdueTotal = overdue.reduce((sum, r) => sum + (r.amount_due || 0), 0);

    const overdue30 = overdue.filter(r => diffDays(r.due_date, now) >= 30);
    const overdue90 = overdue.filter(r => diffDays(r.due_date, now) >= 90);

    const overdue30Total = overdue30.reduce((sum, r) => sum + (r.amount_due || 0), 0);
    const overdue90Total = overdue90.reduce((sum, r) => sum + (r.amount_due || 0), 0);

    return { unpaidTotal, overdueTotal, overdue30Total, overdue90Total };
  }, [invoices]);

  const diffDays = (from: string, to: string) => {
    const a = new Date(from).getTime();
    const b = new Date(to).getTime();
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  };

  // Top 10 customers by unpaid amount
  const top10Data = useMemo(() => {
    const totals = new Map<string, { name: string; amount: number }>();
    invoices.forEach(r => {
      const curr = totals.get(r.customer_id) || { name: r.customer_name, amount: 0 };
      curr.amount += r.amount_due || 0;
      totals.set(r.customer_id, curr);
    });
    return Array.from(totals.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(r => ({ name: r.name, amount: r.amount }));
  }, [invoices]);

  // Donut chart: unpaid percentage by customer
  const donutData = useMemo(() => {
    const total = invoices.reduce((sum, r) => sum + (r.amount_due || 0), 0) || 1;
    const buckets = new Map<string, { name: string; value: number }>();
    invoices.forEach(r => {
      const curr = buckets.get(r.customer_id) || { name: r.customer_name, value: 0 };
      curr.value += r.amount_due || 0;
      buckets.set(r.customer_id, curr);
    });
    return Array.from(buckets.values()).map(b => ({ name: b.name, value: b.value, pct: (b.value / total) * 100 }));
  }, [invoices]);

  // Aging summary table data
  const agingSummary = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    const rows = new Map<string, { name: string; current: number; d1_30: number; d31_60: number; d61_90: number; d91p: number; due: number }>();
    invoices.forEach(r => {
      const isOverdue = r.due_date < now;
      const days = diffDays(r.due_date, now);
      const bucket = !isOverdue ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd91p';
      const curr = rows.get(r.customer_id) || { name: r.customer_name, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91p: 0, due: 0 };
      curr[bucket as keyof typeof curr] += r.amount_due || 0;
      curr.due += r.amount_due || 0;
      rows.set(r.customer_id, curr);
    });
    return Array.from(rows.entries()).map(([id, r]) => ({ customer_id: id, ...r }));
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Filters */}
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
            <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
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
          <div className="self-end">
            <Button onClick={loadData} disabled={loading}>Refresh</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-md bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Unpaid invoices amount (in home currency)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">R {kpis.unpaidTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-rose-50 to-white dark:from-rose-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue amount</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">R {kpis.overdueTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-amber-50 to-white dark:from-amber-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue 30+ days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-amber-600">R {kpis.overdue30Total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
        <Card className="shadow-md bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue 90+ days</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-slate-700 dark:text-slate-200">R {kpis.overdue90Total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div></CardContent></Card>
      </div>

      {/* Charts */}
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

      {/* Tables */}
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
                    <td className="p-2">{inv.issue_date}</td>
                    <td className="p-2">{inv.due_date}</td>
                    <td className="p-2 font-mono">R {inv.amount_due.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ARDashboard;