import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

export const TaxOverview = () => {
  const [vatDue, setVatDue] = useState<number>(0);
  const [nextFiling, setNextFiling] = useState<string>("—");
  const [series, setSeries] = useState<Array<{ month: string; vatOutput: number; vatInput: number }>>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.company_id) return;

      // Pull VAT related entries for company to compute net VAT due = VAT Output - VAT Input
      const { data, error } = await supabase
        .from("transaction_entries")
        .select(`
          debit, credit,
          transactions!inner(company_id, transaction_date, status),
          chart_of_accounts!inner(account_name, account_type)
        `)
        .eq('transactions.company_id', profile.company_id)
        .in('transactions.status', ['pending','approved','posted']);
      if (error) return;

      let output = 0;
      let input = 0;
      const monthMap = new Map<string, { vatOutput: number; vatInput: number }>();
      for (const e of (data || []) as any[]) {
        const name = String(e.chart_of_accounts?.account_name || '').toLowerCase();
        if (!name.includes('vat') && !name.includes('tax')) continue;
        const debit = Number(e.debit || 0);
        const credit = Number(e.credit || 0);
        const dt = e.transactions?.transaction_date ? new Date(e.transactions.transaction_date) : null;
        const key = dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` : '';
        const label = dt ? dt.toLocaleString('en-ZA', { month: 'short' }) : '';
        const out = Math.max(0, credit - debit);
        const inn = Math.max(0, debit - credit);
        output += out;
        input += inn;
        if (key) {
          const prev = monthMap.get(key) || { vatOutput: 0, vatInput: 0 };
          monthMap.set(key, { vatOutput: prev.vatOutput + out, vatInput: prev.vatInput + inn });
        }
      }

      if (!data || data.length === 0) {
        const { data: txs } = await supabase
          .from('transactions')
          .select('transaction_date, company_id, vat_rate, vat_amount, status, transaction_type')
          .eq('company_id', profile.company_id)
          .in('status', ['pending','approved','posted']);
        for (const t of (txs || []) as any[]) {
          const rate = Number(t.vat_rate || 0);
          const vat = Number(t.vat_amount || 0);
          if (rate <= 0 || vat <= 0) continue;
          const type = String(t.transaction_type || '').toLowerCase();
          const isIncome = type === 'income' || type === 'sales' || type === 'receipt';
          const isPurchase = type === 'expense' || type === 'purchase' || type === 'bill' || type === 'product_purchase';
          const dt = t.transaction_date ? new Date(t.transaction_date) : null;
          const key = dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` : '';
          if (isIncome) {
            output += vat;
            if (key) {
              const prev = monthMap.get(key) || { vatOutput: 0, vatInput: 0 };
              monthMap.set(key, { vatOutput: prev.vatOutput + vat, vatInput: prev.vatInput });
            }
          } else if (isPurchase) {
            input += vat;
            if (key) {
              const prev = monthMap.get(key) || { vatOutput: 0, vatInput: 0 };
              monthMap.set(key, { vatOutput: prev.vatOutput, vatInput: prev.vatInput + vat });
            }
          }
        }
      }
      setVatDue(Math.max(0, output - input));

      // Simple next filing date: last day of current month + 25 days (placeholder)
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 25);
      setNextFiling(next.toLocaleDateString('en-ZA'));

      const sorted = Array.from(monthMap.entries()).sort(([a],[b]) => a.localeCompare(b));
      const formatted = sorted.map(([key, vals]) => ({ month: key, vatOutput: vals.vatOutput, vatInput: vals.vatInput }));
      setSeries(formatted);
    };
    load();
  }, []);

  const stats = [
    { title: "Current VAT Due", value: `R ${vatDue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, period: "Live from ledger", icon: DollarSign, color: "text-primary" },
    { title: "Next Filing Date", value: nextFiling, period: "Estimated", icon: Calendar, color: "text-accent" },
    { title: "Submitted Returns", value: "—", period: "Coming soon", icon: FileText, color: "text-primary" },
    { title: "Pending Action", value: vatDue > 0 ? "Payable" : "—", period: vatDue > 0 ? "Review & file" : "—", icon: AlertCircle, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-professional">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.period}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="card-professional">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">VAT Output vs VAT Input</CardTitle>
        </CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <div className="py-6 text-muted-foreground">No VAT activity yet</div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`]} />
                  <Legend />
                  <Line type="monotone" dataKey="vatOutput" name="VAT Output" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="vatInput" name="VAT Input" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
