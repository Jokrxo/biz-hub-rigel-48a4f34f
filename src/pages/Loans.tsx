import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  BarChart3, 
  Plus, 
  Menu, 
  LayoutDashboard, 
  List, 
  History, 
  FileText, 
  User, 
  TrendingUp, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign,
  Calendar,
  Percent,
  Search,
  Filter,
  Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { useToast } from "@/hooks/use-toast";
import { TransactionFormEnhanced } from "@/components/Transactions/TransactionFormEnhanced";
import { transactionsApi } from "@/lib/transactions-api";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";

type Loan = { id: string; company_id: string; reference: string; loan_type: "short" | "long"; principal: number; interest_rate: number; start_date: string; term_months: number; monthly_repayment: number | null; status: string; outstanding_balance: number };
type LoanPayment = { id: string; loan_id: string; payment_date: string; amount: number; principal_component: number; interest_component: number };

// --- Metric Card Component ---
function MetricCard({ title, value, icon: Icon, color, trend }: { title: string; value: string; icon: any; color: string; trend?: string }) {
  return (
    <Card className="border-none shadow-md overflow-hidden relative">
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10`} />
      <CardContent className="p-6 relative">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
            {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Loans() {
  const [tab, setTab] = useState("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Operation completed successfully");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  
  // Dialog States
  const [addLoanOpen, setAddLoanOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionPrefill, setTransactionPrefill] = useState<any>(null);
  const [interestQuickOpen, setInterestQuickOpen] = useState(false);
  const [repaymentQuickOpen, setRepaymentQuickOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [directorsLoanOpen, setDirectorsLoanOpen] = useState(false);
  const [clearLoansOpen, setClearLoansOpen] = useState(false);
  const [isClearingLoans, setIsClearingLoans] = useState(false);

  // Action States
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [actionBankId, setActionBankId] = useState<string>("");
  const [actionAmount, setActionAmount] = useState<string>("");
  const [actionDate, setActionDate] = useState<string>(new Date().toISOString().slice(0,10));
  
  // Data States
  const [loanAccounts, setLoanAccounts] = useState<Array<{ id: string; account_name: string; account_code: string }>>([]);
  const [banks, setBanks] = useState<Array<{ id: string; account_name: string }>>([]);
  
  // Director Loan Form
  const [directorLoanDirection, setDirectorLoanDirection] = useState<'to_director' | 'from_director'>('from_director');
  const [directorPrincipal, setDirectorPrincipal] = useState<string>('');
  const [directorInterestRate, setDirectorInterestRate] = useState<string>('0');
  const [directorTermMonths, setDirectorTermMonths] = useState<string>('12');
  const [directorLoanAccountId, setDirectorLoanAccountId] = useState<string>('');
  const [directorBankAccountId, setDirectorBankAccountId] = useState<string>('');
  const [directorDate, setDirectorDate] = useState<string>(new Date().toISOString().slice(0,10));
  
  // Standard Loan Form
  const [loanForm, setLoanForm] = useState({
    reference: "",
    principal: "",
    interestRatePercent: "",
    termValue: "",
    termUnit: "months",
    classification: "short",
    loanAccountId: "",
    bankAccountId: "",
    startDate: new Date().toISOString().slice(0,10)
  });

  const generateUniqueLoanRef = () => {
    const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const rand = Math.random().toString(36).slice(2,8);
    return `LN-${today}-${rand}`;
  };

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
      const loanCandidates = (accts || []).filter((a: any) => (String(a.account_name || '').toLowerCase().includes('loan')));
      setLoanAccounts(loanCandidates as any);
      const { data: bankList } = await supabase
        .from("bank_accounts" as any)
        .select("id, account_name")
        .eq("company_id", companyId)
        .order("account_name");
      const banksSafe = Array.isArray(bankList)
        ? (bankList as any[]).filter((b: any) => b && typeof b.id === 'string' && typeof b.account_name === 'string')
        : [];
      setBanks(banksSafe as any);
    };
    loadAux();
  }, [companyId]);

  useEffect(() => {
    if (addLoanOpen) {
      const ref = generateUniqueLoanRef();
      setLoanForm(prev => ({ ...prev, reference: ref }));
    } else {
      setLoanForm(prev => ({ ...prev, reference: "" }));
    }
  }, [addLoanOpen]);

  const resolveBankAccountId = async (): Promise<string> => {
    if (loanForm.bankAccountId && loanForm.bankAccountId.trim() !== "") return loanForm.bankAccountId;
    if (banks.length > 0) return banks[0].id;
    if (!companyId) return "";
    const { data: bankList } = await supabase.from("bank_accounts" as any).select("id, account_name").eq("company_id", companyId).order("account_name");
    if (Array.isArray(bankList) && bankList.length > 0) {
      const banksSafe = (bankList as any[]).filter((b: any) => b && typeof b.id === 'string' && typeof b.account_name === 'string');
      setBanks(banksSafe as any);
      return String((banksSafe[0] as any).id);
    }
    const { data: created } = await supabase.from("bank_accounts" as any).insert({ company_id: companyId, account_name: "Default Bank Account" }).select("id").single();
    const newId = (created as any)?.id || "";
    if (newId) setBanks([{ id: newId, account_name: "Default Bank Account" }]);
    return newId;
  };

  const createDirectorsLoan = useCallback(async () => {
    try {
      const principal = Number(directorPrincipal || '0');
      if (!principal || principal <= 0) { toast({ title: 'Principal required', variant: 'destructive' }); return; }
      if (!directorBankAccountId) { toast({ title: 'Select bank', variant: 'destructive' }); return; }

      setIsSubmitting(true);
      setProgress(10);
      setProgressText("Initializing Director Loan...");

      const ref = `DIR-${generateUniqueLoanRef()}`;
      const shortOrLong: 'short' | 'long' = Number(directorTermMonths || '0') >= 12 ? 'long' : 'short';
      const { error: loanErr } = await supabase
        .from('loans' as any)
        .insert({ company_id: companyId, reference: ref, loan_type: shortOrLong, principal, interest_rate: Number(directorInterestRate || '0') / 100, start_date: directorDate, term_months: Number(directorTermMonths || '0'), monthly_repayment: null, status: 'active', outstanding_balance: principal });
      if (loanErr) throw loanErr;
      
      setProgress(40);
      setProgressText("Processing Transaction...");

      if (directorLoanDirection === 'from_director') {
        let loanAssetId = directorLoanAccountId;
        try {
          const { data: accts } = await supabase.from('chart_of_accounts' as any).select('id, account_name, account_type, account_code, is_active').eq('company_id', companyId).eq('is_active', true);
          const list = (accts || []).map((a: any) => ({ id: String(a.id), name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
          const isLong = shortOrLong === 'long';
          const desiredName = isLong ? 'Director Loan Receivable - Non-current' : 'Director Loan Receivable - Current';
          const desiredCode = isLong ? '1450' : '1250';
          const found = list.find(a => a.type === 'asset' && (a.name.includes('director') && a.name.includes('loan')) && (isLong ? a.name.includes('non') : a.name.includes('current')));
          loanAssetId = found?.id || '';
          if (!loanAssetId) {
            const { data: created } = await supabase.from('chart_of_accounts' as any).insert({ company_id: companyId, account_code: desiredCode, account_name: desiredName, account_type: 'asset', is_active: true }).select('id').single();
            loanAssetId = (created as any)?.id || '';
          }
        } catch {}
        await transactionsApi.postLoanAdvanced({ date: directorDate, amount: principal, reference: ref, bankAccountId: directorBankAccountId, loanLedgerAccountId: loanAssetId || undefined });
      } else {
        await transactionsApi.postLoanReceived({ date: directorDate, amount: principal, reference: ref, bankAccountId: directorBankAccountId, loanType: shortOrLong, loanLedgerAccountId: directorLoanAccountId || undefined });
      }

      setProgress(80);
      setProgressText("Updating Financials...");

      try {
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('user_id', user?.id || '').maybeSingle();
        if (profile?.company_id) await supabase.rpc('refresh_afs_cache', { _company_id: profile.company_id });
      } catch {}
      
      setProgress(100);
      setProgressText("Finalizing...");
      await new Promise(r => setTimeout(r, 500));

      setSuccessMessage('Director loan recorded successfully');
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsSubmitting(false);
        setDirectorsLoanOpen(false);
      }, 2000);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to create director loan', variant: 'destructive' });
      setIsSubmitting(false);
    }
  }, [companyId, directorPrincipal, directorLoanAccountId, directorBankAccountId, directorTermMonths, directorInterestRate, directorDate, directorLoanDirection, user?.id, toast]);

  const openInterestPayment = async (loan: Loan) => {
    const today = new Date().toISOString().slice(0, 10);
    const bankId = await resolveBankAccountId();
    if (!bankId) {
      toast({ title: 'Bank Required', description: 'Unable to resolve bank account', variant: 'destructive' });
      return;
    }
    const rate = Number(loan.interest_rate || 0);
    const bal = Number(loan.outstanding_balance || 0);
    const monthlyInterest = bal * (rate / 12);
    const amountStr = monthlyInterest > 0 ? monthlyInterest.toFixed(2) : '';
    setActionLoan(loan);
    setActionBankId(bankId);
    setActionAmount(amountStr);
    setActionDate(today);
    setInterestQuickOpen(true);
  };

  const openLoanRepayment = async (loan: Loan) => {
    const today = new Date().toISOString().slice(0, 10);
    const bankId = await resolveBankAccountId();
    if (!bankId) {
      toast({ title: 'Bank Required', description: 'Unable to resolve bank account', variant: 'destructive' });
      return;
    }
    const rateDecimal = Number(loan.interest_rate || 0);
    const termMonths = Number(loan.term_months || 0);
    const monthlyRate = rateDecimal / 12;
    const principalAmount = Number(loan.principal || 0);
    const fallbackPayment = (monthlyRate === 0 || termMonths <= 0)
      ? (termMonths > 0 ? (principalAmount / termMonths) : principalAmount)
      : (principalAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
    const amount = loan.monthly_repayment && loan.monthly_repayment > 0 ? loan.monthly_repayment : fallbackPayment;
    setActionLoan(loan);
    setActionBankId(bankId);
    setActionAmount(String(Number(amount).toFixed(2)));
    setActionDate(today);
    setRepaymentQuickOpen(true);
  };

  return (
    <>
      <SEO title="Loans | Rigel Business" description="Manage company loans" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Loan Management</h1>
              <p className="text-muted-foreground">Track company loans, director loans, and repayment schedules</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setActionsOpen(true)} className="shadow-md">
                <Menu className="h-4 w-4 mr-2" />
                Quick Actions
              </Button>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <div className="border-b pb-px overflow-x-auto">
              <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 rounded-none">
                <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="list" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Loan List
                </TabsTrigger>
                <TabsTrigger value="payments" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Payment History
                </TabsTrigger>
                <TabsTrigger value="director" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Director Loans
                </TabsTrigger>
                <TabsTrigger value="reports" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LoansDashboard key={refreshKey} companyId={companyId} />
            </TabsContent>
            <TabsContent value="list" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LoanList key={refreshKey} companyId={companyId} onOpenInterest={openInterestPayment} onOpenRepayment={openLoanRepayment} />
            </TabsContent>
            <TabsContent value="payments" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LoanPayments key={refreshKey} companyId={companyId} />
            </TabsContent>
            <TabsContent value="reports" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <LoanReports key={refreshKey} companyId={companyId} />
            </TabsContent>
            <TabsContent value="director" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <DirectorLoansList companyId={companyId} />
            </TabsContent>
          </Tabs>

          {/* Quick Actions Sheet */}
          <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Quick Actions</DialogTitle>
                <DialogDescription>Manage loans and repayments efficiently.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">New Records</h4>
                  <Button className="w-full justify-start" onClick={() => { setActionsOpen(false); setAddLoanOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Loan
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => { setActionsOpen(false); setDirectorsLoanOpen(true); }}>
                    <User className="h-4 w-4 mr-2" />
                    Record Director's Loan
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Management</h4>
                  <Button className="w-full justify-start" variant="ghost" onClick={() => { setActionsOpen(false); setTab('director'); }}>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    View Director Loans
                  </Button>
                  <Button className="w-full justify-start" variant="ghost" onClick={() => { setActionsOpen(false); setTutorialOpen(true); }}>
                    <FileText className="h-4 w-4 mr-2" />
                    Help & Documentation
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dialogs */}
          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Loans Module Guide</DialogTitle>
                <DialogDescription>Learn how to manage your company loans.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-1">Loan Management</h4>
                  <p>Create and track loans from external providers. The system calculates amortization schedules and tracks outstanding balances.</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-1">Director Loans</h4>
                  <p>Specialized tracking for loans between the company and its directors. Supports both loans to and from directors.</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold text-foreground mb-1">Payments & Interest</h4>
                  <p>Record interest payments and capital repayments. The system automatically splits repayments between principal and interest components.</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Loan Dialog */}
          <Dialog open={addLoanOpen} onOpenChange={setAddLoanOpen}>
            <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Add New Loan</DialogTitle>
                <DialogDescription>Enter the details of the new loan agreement.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reference</Label>
                    <Input value={loanForm.reference} disabled readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" value={loanForm.startDate} onChange={(e) => setLoanForm(prev => ({ ...prev, startDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Principal Amount (R)</Label>
                  <Input type="number" value={loanForm.principal} onChange={(e) => setLoanForm(prev => ({ ...prev, principal: e.target.value }))} placeholder="0.00" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input type="number" value={loanForm.interestRatePercent} onChange={(e) => setLoanForm(prev => ({ ...prev, interestRatePercent: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Term Length</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={loanForm.termValue} onChange={(e) => setLoanForm(prev => ({ ...prev, termValue: e.target.value }))} placeholder="36" />
                      <Select value={loanForm.termUnit} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, termUnit: v }))}>
                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="months">Months</SelectItem>
                          <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Classification</Label>
                  <Select value={loanForm.classification} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, classification: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short-term (Current Liability)</SelectItem>
                      <SelectItem value="long">Long-term (Non-current Liability)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Loan Account</Label>
                  <Select value={loanForm.loanAccountId} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, loanAccountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select ledger account" /></SelectTrigger>
                    <SelectContent>
                      {loanAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.account_code} — {acc.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select value={loanForm.bankAccountId} onValueChange={(v: any) => setLoanForm(prev => ({ ...prev, bankAccountId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select bank for deposit" /></SelectTrigger>
                    <SelectContent>
                      {banks.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setAddLoanOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    try {
                      const principal = parseFloat(loanForm.principal || "0");
                      const ratePct = parseFloat(loanForm.interestRatePercent || "0");
                      const termVal = parseInt(loanForm.termValue || "0", 10);
                      if (!companyId) throw new Error("Company not loaded");
                      if (!loanForm.loanAccountId) throw new Error("Select loan account");
                      if (!loanForm.bankAccountId) throw new Error("Select bank");
                      if (!(principal > 0)) throw new Error("Enter principal amount");
                      
                      const termMonths = loanForm.termUnit === 'years' ? termVal * 12 : termVal;
                      const monthlyRate = (ratePct / 100) / 12;
                      const monthlyRepayment = monthlyRate === 0 ? (principal / termMonths) : (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
                      const ref = (loanForm.reference && loanForm.reference.trim() !== "") ? loanForm.reference.trim() : generateUniqueLoanRef();
                      const loanType = loanForm.classification || (termMonths >= 12 ? 'long' : 'short');
                      
                      const { error } = await supabase.from('loans' as any).insert({
                        company_id: companyId, reference: ref, loan_type: loanType, principal: principal, interest_rate: ratePct / 100, start_date: loanForm.startDate, term_months: termMonths, monthly_repayment: monthlyRepayment, status: 'active', outstanding_balance: principal
                      });
                      if (error) throw error;

                      await transactionsApi.postLoanReceived({
                        date: loanForm.startDate, amount: principal, reference: ref, bankAccountId: loanForm.bankAccountId, loanType: loanType as any, loanLedgerAccountId: loanForm.loanAccountId,
                      });
                      
                      setSuccessMessage('Loan recorded successfully');
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setAddLoanOpen(false);
                        setTab('list');
                      }, 2000);
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Create Loan</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Director Loan Dialog */}
          <Dialog open={directorsLoanOpen} onOpenChange={setDirectorsLoanOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Record Director Loan</DialogTitle>
                <DialogDescription>Record a loan between the company and a director.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select value={directorLoanDirection} onValueChange={(v: any) => setDirectorLoanDirection(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="from_director">Loan to director (Asset)</SelectItem>
                      <SelectItem value="to_director">Loan from director (Liability)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={directorDate} onChange={e => setDirectorDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" value={directorPrincipal} onChange={e => setDirectorPrincipal(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input type="number" value={directorInterestRate} onChange={e => setDirectorInterestRate(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Term (Months)</Label>
                    <Input type="number" value={directorTermMonths} onChange={e => setDirectorTermMonths(e.target.value)} placeholder="12" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Loan Account (Optional)</Label>
                  <Select value={directorLoanAccountId} onValueChange={(v: any) => setDirectorLoanAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Auto-select" /></SelectTrigger>
                    <SelectContent>
                      {loanAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.account_code} • {acc.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bank Account</Label>
                  <Select value={directorBankAccountId} onValueChange={(v: any) => setDirectorBankAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                    <SelectContent>
                      {banks.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDirectorsLoanOpen(false)}>Cancel</Button>
                <Button onClick={createDirectorsLoan}>Record Loan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Interest Payment Dialog */}
          <Dialog open={interestQuickOpen} onOpenChange={setInterestQuickOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Record Interest Payment</DialogTitle>
                <DialogDescription>Record an interest payment for {actionLoan?.reference}</DialogDescription>
              </DialogHeader>
              {actionLoan && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Date</Label>
                      <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (R)</Label>
                      <Input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {banks.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setInterestQuickOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    if (!actionBankId) throw new Error('Select bank');
                    await transactionsApi.postLoanInterest({ loanId: actionLoan!.id, date: actionDate, bankAccountId: actionBankId });
                    setSuccessMessage('Interest recorded successfully');
                    setIsSuccess(true);
                    setTimeout(() => {
                      setIsSuccess(false);
                      setInterestQuickOpen(false);
                    }, 2000);
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  }
                }}>Record Payment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Repayment Dialog */}
          <Dialog open={repaymentQuickOpen} onOpenChange={setRepaymentQuickOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Record Repayment</DialogTitle>
                <DialogDescription>Record a capital repayment for {actionLoan?.reference}</DialogDescription>
              </DialogHeader>
              {actionLoan && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Payment Date</Label>
                      <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount (R)</Label>
                      <Input type="number" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {banks.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setRepaymentQuickOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  try {
                    const amountNum = parseFloat(actionAmount || '0');
                    if (!(amountNum > 0)) throw new Error('Enter amount');
                    if (!actionBankId) throw new Error('Select bank');
                    await transactionsApi.postLoanRepayment({ loanId: actionLoan!.id, date: actionDate, bankAccountId: actionBankId, amountOverride: amountNum });
                    setSuccessMessage('Repayment recorded successfully');
                    setIsSuccess(true);
                    setTimeout(() => {
                      setIsSuccess(false);
                      setRepaymentQuickOpen(false);
                    }, 2000);
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  }
                }}>Record Repayment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Success Dialog */}
          <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
            <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
              <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
                <Check className="h-12 w-12 text-green-600" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center text-2xl text-green-700">Success!</DialogTitle>
              </DialogHeader>
              <div className="text-center space-y-2">
                <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
                <p className="text-muted-foreground">The operation has been completed successfully.</p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {isSubmitting && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-500">
            <div className="bg-background border shadow-xl rounded-xl flex flex-col items-center gap-8 p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
              <LoadingSpinner size="lg" className="scale-125" />
              <div className="w-full space-y-4">
                <Progress value={progress} className="h-2 w-full" />
                <div className="text-center space-y-2">
                  <div className="text-xl font-semibold text-primary animate-pulse">
                    {progressText}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Please wait while we update your financial records...
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </>
  );
}

function LoansDashboard({ companyId }: { companyId: string }) {
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, interest: 0, outstanding: 0 });

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      const { data: loans } = await supabase.from("loans" as any).select("id, status, outstanding_balance").eq("company_id", companyId);
      const { data: pays } = await supabase.from("loan_payments" as any).select("interest_component");
      const total = (loans || []).length;
      const active = (loans || []).filter((l: any) => l.status === 'active').length;
      const completed = (loans || []).filter((l: any) => l.status !== 'active').length;
      const outstanding = (loans || []).reduce((s: number, l: any) => s + (l.outstanding_balance || 0), 0);
      const interest = (pays || []).reduce((s: number, p: any) => s + (p.interest_component || 0), 0);
      setStats({ total, active, completed, interest, outstanding });
    };
    load();
  }, [companyId]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Active Loans" 
          value={`${stats.active}`} 
          icon={Wallet} 
          color="from-blue-500 to-blue-600" 
          trend={`${stats.total} total loans`}
        />
        <MetricCard 
          title="Outstanding Balance" 
          value={`R ${stats.outstanding.toLocaleString()}`} 
          icon={BarChart3} 
          color="from-purple-500 to-purple-600" 
        />
        <MetricCard 
          title="Interest Paid" 
          value={`R ${stats.interest.toLocaleString()}`} 
          icon={Percent} 
          color="from-orange-500 to-orange-600" 
        />
        <MetricCard 
          title="Loans Closed" 
          value={`${stats.completed}`} 
          icon={History} 
          color="from-emerald-500 to-emerald-600" 
        />
      </div>
      <DirectorAssetLoansCard companyId={companyId} />
    </div>
  );
}

function DirectorAssetLoansCard({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Array<{ ref: string; amount: number; date: string }>>([]);
  
  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      const { data: txs } = await supabase
        .from('transactions')
        .select('id, reference_number, transaction_date, total_amount, status')
        .eq('company_id', companyId)
        .like('reference_number', 'DIR-%')
        .in('status', ['approved','posted']);
      const list = (txs || []) as any[];
      if (list.length === 0) { setItems([]); return; }
      const { data: leds } = await supabase
        .from('ledger_entries')
        .select('transaction_id, account_id, debit')
        .in('transaction_id', list.map(t => t.id));
      
      const { data: accts } = await supabase.from('chart_of_accounts').select('id, account_type, account_name');
      const typeById = new Map<string,string>((accts || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
      const nameById = new Map<string,string>((accts || []).map((a: any) => [String(a.id), String(a.account_name || '').toLowerCase()]));
      
      const assetTxIds = new Set<string>();
      (leds || []).forEach((l: any) => {
        const type = typeById.get(String(l.account_id)) || '';
        const name = nameById.get(String(l.account_id)) || '';
        if (name.includes('loan') && type === 'asset' && l.debit > 0) assetTxIds.add(String(l.transaction_id));
      });
      
      const filtered = list.filter(t => assetTxIds.has(String(t.id))).map(t => ({ ref: String(t.reference_number || ''), amount: Number(t.total_amount || 0), date: String(t.transaction_date || '') }));
      setItems(filtered);
    };
    load();
  }, [companyId]);

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Director Loans (Assets)</CardTitle>
        <CardDescription>Loans provided to directors (Company Assets)</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No director asset loans recorded</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 5).map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{it.ref}</TableCell>
                  <TableCell>{it.date}</TableCell>
                  <TableCell className="text-right">R {it.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LoanList({ companyId, onOpenInterest, onOpenRepayment }: { companyId: string; onOpenInterest: (loan: Loan) => void; onOpenRepayment: (loan: Loan) => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const load = useCallback(async () => {
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

  const filtered = useMemo(() => {
    return items.filter((l) => {
      if (String(l.reference || '').startsWith('DIR-')) return false;
      const matchesSearch = l.reference.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || l.loan_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [items, search, filterType]);

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Active Loans</CardTitle>
            <CardDescription>Manage your commercial loans and repayment schedules</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search reference..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="short">Short-term</SelectItem>
                <SelectItem value="long">Long-term</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading loans...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="rounded-full bg-muted w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No loans found</h3>
            <p className="text-sm text-muted-foreground mt-1">Add a new loan to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.reference}</TableCell>
                  <TableCell>
                    <div className="text-sm">{new Date(l.start_date).toLocaleDateString()}</div>
                    <div className="text-xs text-muted-foreground">{(l.interest_rate * 100).toFixed(2)}% • {l.term_months}m</div>
                  </TableCell>
                  <TableCell>R {l.principal.toFixed(2)}</TableCell>
                  <TableCell className="font-mono font-medium">R {l.outstanding_balance.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onOpenInterest(l)}>Interest</Button>
                      <Button size="sm" onClick={() => onOpenRepayment(l)}>Repay</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function LoanPayments({ companyId }: { companyId: string }) {
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("loan_payments" as any)
        .select(`*, loans!inner(reference, loan_type)`)
        .eq("loans.company_id", companyId)
        .order("payment_date", { ascending: false });
      setPayments((data || []) as any);
      setLoading(false);
    };
    if (companyId) load();
  }, [companyId]);

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>Recent loan repayments and interest postings</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No payment history found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Loan Ref</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.payment_date).toLocaleDateString()}</TableCell>
                  <TableCell>{(p as any).loans?.reference}</TableCell>
                  <TableCell className="font-medium">R {p.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">R {p.principal_component.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">R {p.interest_component.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DirectorLoansList({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Loan[]>([]);
  const [banks, setBanks] = useState<Array<{ id: string; account_name: string }>>([]);
  const [actionLoan, setActionLoan] = useState<Loan | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [bankId, setBankId] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Operation completed successfully");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  useEffect(() => {
    if (companyId) {
      supabase.from("loans" as any).select("*").eq("company_id", companyId).like("reference", "DIR-%").order("start_date", { ascending: false })
        .then(({ data }) => setItems((data || []) as any));
      supabase.from("bank_accounts" as any).select("id, account_name").eq("company_id", companyId)
        .then(({ data }) => setBanks(((data || []) as any[]).filter(b => b && typeof b.id === 'string')));
    }
  }, [companyId]);

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Director Loans</CardTitle>
          <CardDescription>Loans associated with company directors</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No director loans found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.reference}</TableCell>
                    <TableCell>R {l.principal.toFixed(2)}</TableCell>
                    <TableCell>R {l.outstanding_balance.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => {
                          const bId = banks[0]?.id || '';
                          if (!bId) { toast({ title: 'No Bank', variant: 'destructive' }); return; }
                          const rate = Number(l.interest_rate || 0);
                          const bal = Number(l.outstanding_balance || 0);
                          const monthly = bal * (rate / 12);
                          setActionLoan(l); setBankId(bId); setAmount(monthly > 0 ? monthly.toFixed(2) : ''); setDate(new Date().toISOString().slice(0,10)); setInterestOpen(true);
                        }}>Interest Rec.</Button>
                        <Button size="sm" onClick={() => {
                          const bId = banks[0]?.id || '';
                          if (!bId) { toast({ title: 'No Bank', variant: 'destructive' }); return; }
                          setActionLoan(l); setBankId(bId); setAmount(''); setDate(new Date().toISOString().slice(0,10)); setPaymentOpen(true);
                        }}>Payment Rec.</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Interest Received Dialog */}
      <Dialog open={interestOpen} onOpenChange={setInterestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Interest Received</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              try {
                await transactionsApi.postDirectorLoanInterestReceived({ loanId: actionLoan!.id, date, bankAccountId: bankId });
                toast({ title: 'Success' }); setInterestOpen(false);
              } catch (e: any) { toast({ title: 'Error', description: e.message }); }
            }}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Received Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment Received</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              try {
                const val = parseFloat(amount);
                if (!(val > 0)) throw new Error('Invalid amount');
                setIsSubmitting(true);
                setProgress(30);
                setProgressText("Processing Payment...");
                await transactionsApi.postDirectorLoanPaymentReceived({ loanId: actionLoan!.id, date, bankAccountId: bankId, amountOverride: val });
                setProgress(100);
                await new Promise(r => setTimeout(r, 500));
                setSuccessMessage('Payment received successfully');
                setIsSuccess(true);
                setTimeout(() => {
                  setIsSuccess(false);
                  setPaymentOpen(false);
                  setIsSubmitting(false);
                }, 2000);
              } catch (e: any) { 
                toast({ title: 'Error', description: e.message }); 
                setIsSubmitting(false);
              }
            }}>Post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Success Dialog */}
      <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
        <DialogContent className="sm:max-w-[425px] flex flex-col items-center justify-center min-h-[300px]">
          <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-6 animate-in zoom-in-50 duration-300">
            <Check className="h-12 w-12 text-green-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-green-700">Success!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-gray-900">{successMessage}</p>
            <p className="text-muted-foreground">The operation has been completed successfully.</p>
          </div>
        </DialogContent>
      </Dialog>

      {isSubmitting && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-500">
          <div className="bg-background border shadow-xl rounded-xl flex flex-col items-center gap-8 p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-300">
            <LoadingSpinner size="lg" className="scale-125" />
            <div className="w-full space-y-4">
              <Progress value={progress} className="h-2 w-full" />
              <div className="text-center space-y-2">
                <div className="text-xl font-semibold text-primary animate-pulse">
                  {progressText}
                </div>
                <div className="text-sm text-muted-foreground">
                  Please wait while we update your financial records...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LoanReports({ companyId }: { companyId: string }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);

  useEffect(() => {
    if (companyId) {
      supabase.from("loans" as any).select("*").eq("company_id", companyId).then(({ data }) => setLoans((data || []) as any));
      supabase.from("loan_payments" as any).select("*").then(({ data }) => setPayments((data || []) as any));
    }
  }, [companyId]);

  const totals = {
    interest: payments.reduce((s, p) => s + (p.interest_component || 0), 0),
    exposure: loans.reduce((s, l) => s + (l.outstanding_balance || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard title="Total Interest Paid" value={`R ${totals.interest.toFixed(2)}`} icon={Percent} color="from-orange-500 to-orange-600" />
        <MetricCard title="Total Exposure" value={`R ${totals.exposure.toFixed(2)}`} icon={TrendingUp} color="from-red-500 to-red-600" />
      </div>
      <Card>
        <CardHeader><CardTitle>Summary Report</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.slice(0, 10).map(l => (
                <TableRow key={l.id}>
                  <TableCell>{l.reference}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{l.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">R {l.outstanding_balance.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
