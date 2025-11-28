import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { CreditCard, BarChart3 } from "lucide-react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { TransactionFormEnhanced } from "@/components/Transactions/TransactionFormEnhanced";

type Loan = { id: string; company_id: string; reference: string; loan_type: "short" | "long"; principal: number; interest_rate: number; start_date: string; term_months: number; monthly_repayment: number | null; status: string; outstanding_balance: number };
type LoanPayment = { id: string; loan_id: string; payment_date: string; amount: number; principal_component: number; interest_component: number };

export default function Loans() {
  const [tab, setTab] = useState("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string>("");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionPrefill, setTransactionPrefill] = useState<any>(null);
  const [loanAccounts, setLoanAccounts] = useState<Array<{ id: string; account_name: string; account_code: string }>>([]);
  const [banks, setBanks] = useState<Array<{ id: string; account_name: string }>>([]);
  const [loanForm, setLoanForm] = useState({
    reference: "",
    principal: "",
    interestRatePercent: "",
    termValue: "",
    termUnit: "months", // months | years
    classification: "short", // short | long
    loanAccountId: "",
    bankAccountId: ""
  });

  useEffect(() => {
    const loadCompany = async () => {
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user?.id).maybeSingle();
      if (profile?.company_id) setCompanyId(profile.company_id);
    };
    loadCompany();
  }, [user?.id]);

  useEffect(() => {
    const loadAux = async () => {
      if (!companyId) return;
      const { data: accts } = await supabase
        .from("chart_of_accounts" as any)
        .select("id, account_name, account_code, account_type")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("account_code");
      const onlyLoans = (accts || []).filter((a: any) => (String(a.account_type || '').toLowerCase() === 'liability') && (String(a.account_name || '').toLowerCase().includes('loan')));
      setLoanAccounts(onlyLoans as any);
      const { data: bankList } = await supabase
        .from("bank_accounts" as any)
        .select("id, account_name")
        .eq("company_id", companyId)
        .order("account_name");
      setBanks(bankList || []);
    };
    loadAux();
  }, [companyId]);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_loans_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  const openInterestPayment = (loan: Loan) => {
    const today = new Date().toISOString().slice(0, 10);
    const ref = `INT-${loan.reference}-${today.replace(/-/g, '')}`;
    const defaultBankId = banks.length === 1 ? banks[0].id : "";
    setTransactionPrefill({
      date: today,
      description: `Loan interest ${loan.reference}`,
      reference: ref,
      bankAccountId: defaultBankId,
      element: 'loan_interest',
      loanId: loan.id,
      loanTermType: loan.loan_type,
      amount: ''
    });
    setTransactionOpen(true);
  };

  const openLoanRepayment = (loan: Loan) => {
    const today = new Date().toISOString().slice(0, 10);
    const ref = `PMT-${loan.reference}-${today.replace(/-/g, '')}`;
    const defaultBankId = banks.length === 1 ? banks[0].id : "";
    const rateDecimal = Number(loan.interest_rate || 0);
    const termMonths = Number(loan.term_months || 0);
    const monthlyRate = rateDecimal / 12;
    const principalAmount = Number(loan.principal || 0);
    const fallbackPayment = (monthlyRate === 0 || termMonths <= 0)
      ? (termMonths > 0 ? (principalAmount / termMonths) : principalAmount)
      : (principalAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    const amount = loan.monthly_repayment && loan.monthly_repayment > 0 ? loan.monthly_repayment : fallbackPayment;
    setTransactionPrefill({
      date: today,
      description: `Loan repayment ${loan.reference}`,
      reference: ref,
      bankAccountId: defaultBankId,
      element: 'loan_repayment',
      loanId: loan.id,
      loanTermType: loan.loan_type,
      amount: String(Number(amount).toFixed(2)),
      installmentNumber: '1'
    });
    setTransactionOpen(true);
  };

  return (
    <>
      <SEO title="Loans | Rigel Business" description="Manage company loans" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Loans</h1>
              <p className="text-muted-foreground mt-1">Dashboard, List, Payments, Reports</p>
            </div>
            <div className="flex items-center gap-2">
              <Button className="bg-gradient-primary" onClick={() => setAddLoanOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Loan
              </Button>
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="list">Loan List</TabsTrigger>
              <TabsTrigger value="payments">Payment History</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <LoansDashboard companyId={companyId} />
            </TabsContent>
            <TabsContent value="list">
              <LoanList companyId={companyId} onOpenInterest={openInterestPayment} onOpenRepayment={openLoanRepayment} />
            </TabsContent>
            <TabsContent value="payments">
              <LoanPayments companyId={companyId} />
            </TabsContent>
            <TabsContent value="reports">
              <LoanReports companyId={companyId} />
            </TabsContent>
          </Tabs>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Loans Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>This module is for viewing loan information, payments, and reports.</p>
                <p>Use the tabs to review loan lists, payment history, and analytics.</p>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add New Loan Dialog */}
          <Dialog open={addLoanOpen} onOpenChange={setAddLoanOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Add New Loan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Reference</label>
                    <Input value={loanForm.reference} onChange={(e) => setLoanForm(prev => ({ ...prev, reference: e.target.value }))} placeholder="LN-2025-001" />
                  </div>
                  <div>
                    <label className="text-sm">Principal Amount</label>
                    <Input inputMode="decimal" value={loanForm.principal} onChange={(e) => setLoanForm(prev => ({ ...prev, principal: e.target.value }))} placeholder="100000" />
                  </div>
                  <div>
                    <label className="text-sm">Interest Rate (%)</label>
                    <Input inputMode="decimal" value={loanForm.interestRatePercent} onChange={(e) => setLoanForm(prev => ({ ...prev, interestRatePercent: e.target.value }))} placeholder="12" />
                  </div>
                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-2">
                    <label className="text-sm">Term</label>
                    <Input inputMode="numeric" value={loanForm.termValue} onChange={(e) => setLoanForm(prev => ({ ...prev, termValue: e.target.value }))} placeholder="36" />
                  </div>
                  <div>
                    <label className="text-sm">Unit</label>
                    <Select value={loanForm.termUnit} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, termUnit: v }))}>
                      <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="months">Months</SelectItem>
                        <SelectItem value="years">Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm">Loan Classification</label>
                  <Select value={loanForm.classification} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, classification: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short-term</SelectItem>
                      <SelectItem value="long">Long-term</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  <div>
                    <label className="text-sm">Loan Account</label>
                    <Select value={loanForm.loanAccountId} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, loanAccountId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select loan ledger" /></SelectTrigger>
                      <SelectContent>
                        {loanAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.account_code} — {acc.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">Bank</label>
                    <Select value={loanForm.bankAccountId} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, bankAccountId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {banks.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setAddLoanOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      const principal = parseFloat(loanForm.principal || "0");
                      const ratePct = parseFloat(loanForm.interestRatePercent || "0");
                      const termVal = parseInt(loanForm.termValue || "0", 10);
                      if (!companyId) throw new Error("Company not loaded");
                      if (!loanForm.loanAccountId) throw new Error("Select loan account");
                      if (!loanForm.bankAccountId) throw new Error("Select bank");
                      if (!(principal > 0)) throw new Error("Enter principal amount");
                      if (!(ratePct >= 0)) throw new Error("Enter interest rate");
                      if (!(termVal > 0)) throw new Error("Enter term length");
                      const termMonths = loanForm.termUnit === 'years' ? termVal * 12 : termVal;
                      const monthlyRate = (ratePct / 100) / 12;
                      const monthlyRepayment = monthlyRate === 0 ? (principal / termMonths) : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
                      const startDate = new Date().toISOString().slice(0, 10);
                      const baseRef = (loanForm.reference && loanForm.reference.trim() !== "") ? loanForm.reference.trim() : `LN-${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
                      let ref = baseRef;
                      try {
                        const { data: exists } = await supabase
                          .from('loans' as any)
                          .select('id')
                          .eq('company_id', companyId)
                          .eq('reference', ref)
                          .maybeSingle();
                        if (exists) {
                          const { data: similar } = await supabase
                            .from('loans' as any)
                            .select('reference')
                            .eq('company_id', companyId)
                            .like('reference', `${baseRef}%`);
                          const taken = new Set<string>((similar || []).map((r: any) => String(r.reference)));
                          let i = 1;
                          while (taken.has(`${baseRef}-${String(i).padStart(3,'0')}`)) i++;
                          ref = `${baseRef}-${String(i).padStart(3,'0')}`;
                        }
                      } catch {}
                      const loanType = loanForm.classification || (termMonths >= 12 ? 'long' : 'short');
                      {
                        let errorOccured: any = null;
                        for (let attempt = 0; attempt < 3; attempt++) {
                          const { error } = await supabase
                            .from('loans' as any)
                            .insert({
                              company_id: companyId,
                              reference: ref,
                              loan_type: loanType,
                              principal: principal,
                              interest_rate: ratePct / 100,
                              start_date: startDate,
                              term_months: termMonths,
                              monthly_repayment: monthlyRepayment,
                              status: 'active',
                              outstanding_balance: principal
                            });
                          if (!error) { errorOccured = null; break; }
                          const msg = String(error.message || '').toLowerCase();
                          if (msg.includes('duplicate key') || msg.includes('unique')) {
                            const suffix = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
                            ref = `${baseRef}-${suffix}`;
                            continue;
                          } else {
                            errorOccured = error;
                            break;
                          }
                        }
                        if (errorOccured) throw errorOccured;
                      }
                      const description = `Loan received ${ref}`;
                      setTransactionPrefill({
                        date: startDate,
                        description,
                        reference: ref,
                        bankAccountId: loanForm.bankAccountId,
                        element: 'loan_received',
                        amount: String(principal),
                        loanTermType: loanType,
                        creditAccount: loanForm.loanAccountId,
                        interestRate: String(ratePct),
                        loanTerm: String(termMonths)
                      });
                      setAddLoanOpen(false);
                      setTransactionOpen(true);
                    } catch (e: any) {
                      const msg = e?.message || 'Failed to add loan';
                      toast({ title: 'Error', description: msg, variant: 'destructive' });
                    }
                  }}>Post</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <TransactionFormEnhanced
            open={transactionOpen}
            onOpenChange={setTransactionOpen}
            onSuccess={() => {
              setTransactionOpen(false);
              setTab('list');
            }}
            prefill={transactionPrefill}
          />
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
  const { toast } = useToast();

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
  }, [companyId]);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Loan Overview</div>
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

function LoanList({ companyId, onOpenInterest, onOpenRepayment }: { companyId: string; onOpenInterest: (loan: Loan) => void; onOpenRepayment: (loan: Loan) => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>("start_date");

  const load = React.useCallback(async () => {
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
  }, [companyId, toast]);
  useEffect(() => { if (companyId) load(); }, [companyId, load]);

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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {derived.map((l) => {
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
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => onOpenInterest(l)}>Interest Payment</Button>
                      <Button className="bg-gradient-primary" size="sm" onClick={() => onOpenRepayment(l)}>Payment</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LoanPayments({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = React.useCallback(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("loan_payments" as any)
          .select(`
            *,
            loans!inner(reference, loan_type)
          `)
          .eq("loans.company_id", companyId)
          .order("payment_date", { ascending: false });
        
        if (error) throw error;
        setPayments((data || []) as any);
      } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
  }, [companyId, toast]);
  useEffect(() => { if (companyId) loadPayments(); }, [companyId, loadPayments]);

  return (
    <Card>
      <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading payment history...</div>
        ) : payments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No payments recorded</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Loan Reference</TableHead>
                <TableHead>Loan Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                  <TableCell>{(payment as any).loans?.reference || 'N/A'}</TableCell>
                  <TableCell className="capitalize">{(payment as any).loans?.loan_type || 'N/A'}</TableCell>
                  <TableCell>R {payment.amount.toFixed(2)}</TableCell>
                  <TableCell>R {payment.principal_component.toFixed(2)}</TableCell>
                  <TableCell>R {payment.interest_component.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LoanReports({ companyId }: { companyId: string }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const loadReports = React.useCallback(async () => {
      const { data: lns } = await supabase.from("loans" as any).select("*").eq("company_id", companyId);
      const { data: pays } = await supabase.from("loan_payments" as any).select("*");
      setLoans((lns || []) as any);
      setPayments((pays || []) as any);
  }, [companyId]);
  useEffect(() => { if (companyId) loadReports(); }, [companyId, loadReports]);
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
import React from "react";
