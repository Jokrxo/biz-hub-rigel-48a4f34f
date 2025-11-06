import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Calendar, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const TaxOverview = () => {
  const [vatDue, setVatDue] = useState<number>(0);
  const [nextFiling, setNextFiling] = useState<string>("—");

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
        .select(`debit, credit, transactions(company_id), chart_of_accounts(account_name, account_type)`)
        .order("created_at", { ascending: false });
      if (error) return;

      let output = 0; // credits on VAT Output
      let input = 0;  // debits on VAT Input
      for (const e of (data || []) as any[]) {
        if (e.transactions?.company_id !== profile.company_id) continue;
        const name = (e.chart_of_accounts?.account_name || '').toLowerCase();
        if (!name.includes('vat') && !name.includes('tax')) continue;
        const debit = Number(e.debit || 0);
        const credit = Number(e.credit || 0);
        // Heuristic: treat credits as Output VAT, debits as Input VAT
        output += Math.max(0, credit - debit);
        input += Math.max(0, debit - credit);
      }
      setVatDue(Math.max(0, output - input));

      // Simple next filing date: last day of current month + 25 days (placeholder)
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 25);
      setNextFiling(next.toLocaleDateString('en-ZA'));
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
    </div>
  );
};
