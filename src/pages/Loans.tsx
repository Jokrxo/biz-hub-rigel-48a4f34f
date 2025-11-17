import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, BarChart3, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";

// Utility: monthly interest from outstanding balance and annual rate (%)
const calculateMonthlyInterest = (outstanding: number, annualRatePercent: number) => {
  const monthlyRate = (annualRatePercent / 100) / 12;
  return +(outstanding * monthlyRate).toFixed(2);
};

type Loan = { id: string; company_id: string; reference: string; loan_type: "short" | "long"; principal: number; interest_rate: number; start_date: string; term_months: number; monthly_repayment: number | null; status: string; outstanding_balance: number };
type LoanPayment = { id: string; loan_id: string; payment_date: string; amount: number; principal_component: number; interest_component: number };

export default function Loans() {
  const [tab, setTab] = useState("dashboard");
  const { isAdmin, isAccountant } = useRoles();
  const canEdit = isAdmin || isAccountant;
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    const loadCompany = async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user?.id).maybeSingle();
      if (profile?.company_id) setCompanyId(profile.company_id);
    };
    loadCompany();
  }, [user?.id]);

  return (
    <>
      <SEO title="Loans | ApexAccounts" description="Manage company loans" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Loans</h1>
              <p className="text-muted-foreground mt-1">Dashboard, List, Payments, Reports</p>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="list">Loan List</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <LoansDashboard companyId={companyId} />
            </TabsContent>
            <TabsContent value="list">
              <LoanList companyId={companyId} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="payments">
              <LoanPayments companyId={companyId} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="reports">
              <LoanReports companyId={companyId} />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function LoansDashboard({ companyId }: { companyId: string }) {
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, interest: 0, outstanding: 0 });
  const [calculatingInterest, setCalculatingInterest] = useState(false);
  const { toast } = useToast();

  const calculateMonthlyInterest = async () => {
    setCalculatingInterest(true);
    try {
      const { data, error } = await supabase.rpc('post_monthly_loan_interest', {
        _company_id: companyId,
        _posting_date: new Date().toISOString().split('T')[0]
      });

      if (error) throw error;

      const processedLoans = Array.isArray(data) ? data.length : 0;
      if (processedLoans > 0) {
        toast({
          title: "Interest Calculated",
          description: `Monthly interest calculated for ${processedLoans} active loan(s) and posted to ledger.`,
          variant: "default"
        });
      } else {
        toast({
          title: "No Active Loans",
          description: "No active loans with outstanding balance found.",
          variant: "default"
        });
      }
    } catch (error: any) {
      toast({
        title: "Interest Calculation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setCalculatingInterest(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: loans } = await supabase.from("loans" as any).select("id, status, outstanding_balance").eq("company_id", companyId);
      const { data: pays } = await supabase.from("loan_payments" as any).select("interest_component");
      const total = (loans || []).length;
      const active = (loans || []).filter((l: any) => l.status === 'active').length;
      const completed = (loans || []).filter((l: any) => l.status !== 'active').length;
      const outstanding = (loans || []).reduce((s: number, l: any) => s + (l.outstanding_balance || 0), 0);
      const interest = (pays || []).reduce((s: number, p: any) => s + (p.interest_component || 0), 0);
      setStats({ total, active, completed, interest, outstanding });
    };
    if (companyId) load();
  }, [companyId, calculatingInterest]);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Loan Overview</div>
        <Button 
          onClick={calculateMonthlyInterest} 
          disabled={calculatingInterest}
          className="bg-gradient-primary"
        >
          {calculatingInterest ? "Calculating..." : "Calculate Monthly Interest"}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Loans" value={`${stats.total}`} />
        <StatCard title="Active Loans" value={`${stats.active}`} />
        <StatCard title="Completed Loans" value={`${stats.completed}`} />
        <StatCard title="Total Interest" value={`R ${stats.interest.toFixed(2)}`} />
        <StatCard title="Outstanding Balance" value={`R ${stats.outstanding.toFixed(2)}`} />
      </div>
    </div>
  );
}

function LoanList({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("start_date");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ reference: "", loan_type: "short", principal: "", interest_rate: "", start_date: "", term_months: "", monthly_repayment: "" });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("loans" as any).select("*").eq("company_id", companyId).order("start_date", { ascending: false });
      if (error) throw error;
      setItems((data || []) as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const derived = useMemo(() => {
    const filtered = items.filter((l) => {
      const matchesSearch = l.reference.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || l.loan_type === filterType;
      return matchesSearch && matchesType;
    }).sort((a, b) => {
      if (sortKey === 'start_date') return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      if (sortKey === 'principal') return (b.principal || 0) - (a.principal || 0);
      return 0;
    });
    return filtered;
  }, [items, search, filterType, sortKey]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const principal = parseFloat(form.principal || "0");
      const rate = parseFloat(form.interest_rate || "0");
      const term = parseInt(form.term_months || "0");
      const monthly = form.monthly_repayment ? parseFloat(form.monthly_repayment) : null;
      const { error } = await supabase.from("loans" as any).insert({
        company_id: companyId,
        reference: form.reference,
        loan_type: form.loan_type,
        principal,
        interest_rate: rate,
        start_date: form.start_date,
        term_months: term,
        monthly_repayment: monthly,
        status: 'active',
        outstanding_balance: principal,
      } as any);
      if (error) throw error;
      toast({ title: "Success", description: "Loan added" });
      setDialogOpen(false);
      setForm({ reference: "", loan_type: "short", principal: "", interest_rate: "", start_date: "", term_months: "", monthly_repayment: "" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Loan List</CardTitle>
        <div className="flex items-center gap-2">
          <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="short">Short-term</SelectItem>
              <SelectItem value="long">Long-term</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v: any) => setSortKey(v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="start_date">Start Date</SelectItem>
              <SelectItem value="principal">Principal</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && <Button onClick={() => setDialogOpen(true)} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Loan</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : derived.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No loans</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Rate %</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Term (months)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Outstanding</TableHead>
                <TableHead>Monthly Interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {derived.map((l) => {
                const monthlyInterest = calculateMonthlyInterest(l.outstanding_balance, l.interest_rate * 100);
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.reference}</TableCell>
                    <TableCell className="capitalize">{l.loan_type}</TableCell>
                    <TableCell>R {l.principal.toFixed(2)}</TableCell>
                    <TableCell>{(l.interest_rate * 100).toFixed(2)}</TableCell>
                    <TableCell>{new Date(l.start_date).toLocaleDateString()}</TableCell>
                    <TableCell>{l.term_months}</TableCell>
                    <TableCell className="capitalize">{l.status}</TableCell>
                    <TableCell>R {l.outstanding_balance.toFixed(2)}</TableCell>
                    <TableCell>R {monthlyInterest.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Loan</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reference</Label>
                <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} required />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.loan_type} onValueChange={(v: any) => setForm({ ...form, loan_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short-term</SelectItem>
                    <SelectItem value="long">Long-term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Principal (R)</Label>
                <Input type="number" step="0.01" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} required />
              </div>
              <div>
                <Label>Interest Rate (decimal)</Label>
                <Input type="number" step="0.0001" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} required />
              </div>
              <div>
                <Label>Monthly Repayment (optional)</Label>
                <Input type="number" step="0.01" value={form.monthly_repayment} onChange={(e) => setForm({ ...form, monthly_repayment: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
              </div>
              <div>
                <Label>Term (months)</Label>
                <Input type="number" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: e.target.value })} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function LoanPayments({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("loans" as any).select("*").eq("company_id", companyId).order("start_date", { ascending: false });
      setLoans((data || []) as any);
    };
    if (companyId) load();
  }, [companyId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) { toast({ title: "Error", description: "Select a loan", variant: "destructive" }); return; }
      const amt = parseFloat(amount || "0");
      const monthlyRate = loan.interest_rate / 12;
      const interest_component = +(Math.min(loan.outstanding_balance, loan.outstanding_balance) * monthlyRate).toFixed(2);
      const principal_component = +(amt - interest_component).toFixed(2);
      if (principal_component < 0) { toast({ title: "Error", description: "Amount too small", variant: "destructive" }); return; }
      const newOutstanding = +(loan.outstanding_balance - principal_component).toFixed(2);
      const { error: payErr } = await supabase.from("loan_payments" as any).insert({ loan_id: loan.id, payment_date: date, amount: amt, principal_component, interest_component } as any);
      if (payErr) throw payErr;
      const status = newOutstanding <= 0 ? 'completed' : loan.status;
      const { error: updErr } = await supabase.from("loans" as any).update({ outstanding_balance: Math.max(newOutstanding, 0), status } as any).eq("id", loan.id);
      if (updErr) throw updErr;
      toast({ title: "Success", description: "Payment recorded" });
      setAmount("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Loan Payments</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-4 gap-3">
          <div>
            <Label>Loan</Label>
            <Select value={loanId} onValueChange={(v: any) => setLoanId(v)}>
              <SelectTrigger><SelectValue placeholder="Select loan" /></SelectTrigger>
              <SelectContent>
                {loans.map(l => <SelectItem key={l.id} value={l.id}>{l.reference}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Amount (R)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex items-end">
            {canEdit && <Button type="submit" className="bg-gradient-primary">Record Payment</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LoanReports({ companyId }: { companyId: string }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data: lns } = await supabase.from("loans" as any).select("*").eq("company_id", companyId);
      const { data: pays } = await supabase.from("loan_payments" as any).select("*");
      setLoans((lns || []) as any);
      setPayments((pays || []) as any);
    };
    if (companyId) load();
  }, [companyId]);
  const totals = {
    active: loans.filter(l => l.status === 'active').length,
    completed: loans.filter(l => l.status !== 'active').length,
    interest: payments.reduce((s, p) => s + (p.interest_component || 0), 0),
    exposure: loans.reduce((s, l) => s + (l.outstanding_balance || 0), 0),
  };
  return (
    <Card>
      <CardHeader><CardTitle>Loan Reports</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard title="Active Loans" value={`${totals.active}`} />
          <StatCard title="Paid Loans" value={`${totals.completed}`} />
          <StatCard title="Interest Report" value={`R ${totals.interest.toFixed(2)}`} />
          <StatCard title="Total Exposure" value={`R ${totals.exposure.toFixed(2)}`} />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map(l => (
              <TableRow key={l.id}>
                <TableCell>{l.reference}</TableCell>
                <TableCell className="capitalize">{l.loan_type}</TableCell>
                <TableCell className="capitalize">{l.status}</TableCell>
                <TableCell>R {l.outstanding_balance.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}