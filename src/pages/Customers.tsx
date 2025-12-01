import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Mail, Phone, Info, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";
import { exportCustomerStatementToPDF } from "@/lib/export-utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementViewOpen, setStatementViewOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [monthsPreset, setMonthsPreset] = useState<string>("12");
  const [useCustomRange, setUseCustomRange] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statementEntries, setStatementEntries] = useState<any[]>([]);
  const [statementOpeningBalance, setStatementOpeningBalance] = useState<number>(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    openingBalance: "",
    openingDate: new Date().toISOString().split('T')[0]
  });

  const loadCustomers = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_customers_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user?.id]);

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isAccountant) {
      toast({ title: "Permission denied", variant: "destructive" });
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .single();

      const { data: insertedCustomer, error } = await supabase.from("customers").insert({
        company_id: profile!.company_id,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        address: formData.address || null,
      }).select('id').single();

      if (error) throw error;

      // Opening balance posting: Dr AR (1200), Cr Opening Equity (3900)
      try {
        const openingAmt = Math.max(0, Number(formData.openingBalance || 0));
        if (openingAmt > 0 && insertedCustomer?.id) {
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_code, account_name, account_type')
            .eq('company_id', profile!.company_id)
            .eq('is_active', true);
          const findAcc = (type: string, codes: string[], names: string[]) => {
            const list = (accounts || []).map((a: any) => ({ id: String(a.id), code: String(a.account_code || ''), name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase() }));
            const byType = list.filter(a => a.type === type.toLowerCase());
            const byCode = byType.find(a => codes.includes(a.code));
            if (byCode) return byCode.id;
            const byName = byType.find(a => names.some(n => a.name.includes(n)));
            return byName?.id || null;
          };
          let arId = findAcc('asset', ['1200'], ['receiv','debtors','accounts receiv']);
          let eqId = findAcc('equity', ['3900'], ['opening balance']);
          if (!arId) {
            const { data: created } = await supabase
              .from('chart_of_accounts')
              .insert({ company_id: profile!.company_id, account_code: '1200', account_name: 'Accounts Receivable', account_type: 'asset', is_active: true })
              .select('id')
              .single();
            arId = (created as any)?.id || arId;
          }
          if (!eqId) {
            const { data: created } = await supabase
              .from('chart_of_accounts')
              .insert({ company_id: profile!.company_id, account_code: '3900', account_name: 'Opening Balance Equity', account_type: 'equity', is_active: true })
              .select('id')
              .single();
            eqId = (created as any)?.id || eqId;
          }
          if (arId && eqId) {
            const { data: { user } } = await supabase.auth.getUser();
            const txDate = String(formData.openingDate || new Date().toISOString().slice(0,10));
            const { data: tx } = await supabase
              .from('transactions')
              .insert({
                company_id: profile!.company_id,
                user_id: user?.id || '',
                transaction_date: txDate,
                description: `Opening balance for ${formData.name}`,
                reference_number: `OB-${insertedCustomer.id}`,
                total_amount: openingAmt,
                transaction_type: 'journal',
                status: 'pending'
              })
              .select('id')
              .single();
            const rows = [
              { transaction_id: (tx as any).id, account_id: arId, debit: openingAmt, credit: 0, description: 'Opening balance', status: 'approved' },
              { transaction_id: (tx as any).id, account_id: eqId, debit: 0, credit: openingAmt, description: 'Opening balance', status: 'approved' },
            ];
            await supabase.from('transaction_entries').insert(rows);
            const ledgerRows = rows.map(r => ({ company_id: profile!.company_id, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: txDate, is_reversed: false, transaction_id: (tx as any).id, description: r.description }));
            await supabase.from('ledger_entries').insert(ledgerRows as any);
            await supabase.from('transactions').update({ status: 'posted' }).eq('id', (tx as any).id);
          }
        }
      } catch {}

      toast({ title: "Success", description: "Customer added successfully" });
      setDialogOpen(false);
      setFormData({ name: "", email: "", phone: "", address: "", openingBalance: "", openingDate: new Date().toISOString().split('T')[0] });
      loadCustomers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const canEdit = isAdmin || isAccountant;

  const downloadStatement = async (customer: Customer, start: string, end: string) => {
    try {
      const data = await buildStatementData(customer, start, end);
      const periodLabel = `${new Date(start).toLocaleDateString('en-ZA')} – ${new Date(end).toLocaleDateString('en-ZA')}`;
      exportCustomerStatementToPDF(data.entries, customer.name, periodLabel, data.openingBalance, `statement_${customer.name.replace(/\s+/g,'_')}` , { email: customer.email || undefined, phone: customer.phone || undefined, address: customer.address || undefined });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openStatementDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setStatementOpen(true);
    setMonthsPreset("12");
    setUseCustomRange(false);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const exportStatement = async () => {
    if (!selectedCustomer) return;
    let start = startDate;
    let end = endDate;
    if (!useCustomRange) {
      const endDt = new Date();
      const months = parseInt(monthsPreset || "12");
      const startDt = new Date();
      startDt.setMonth(startDt.getMonth() - months);
      start = startDt.toISOString().split('T')[0];
      end = endDt.toISOString().split('T')[0];
    }
    await downloadStatement(selectedCustomer, start, end);
    setStatementOpen(false);
  };

  const buildStatementData = async (customer: Customer, start: string, end: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user?.id)
      .single();
    if (!profile?.company_id) throw new Error("Company not found");

    const { data: periodInv } = await supabase
      .from("invoices")
      .select("invoice_number, invoice_date, total_amount")
      .eq("company_id", profile.company_id)
      .eq("customer_name", customer.name)
      .gte("invoice_date", start)
      .lte("invoice_date", end)
      .order("invoice_date", { ascending: true });
    const { data: priorInv } = await supabase
      .from("invoices")
      .select("invoice_number, invoice_date, total_amount")
      .eq("company_id", profile.company_id)
      .eq("customer_name", customer.name)
      .lt("invoice_date", start);
    const nameLower = String(customer.name || '').toLowerCase();
    const periodInvNumbers = (periodInv || []).map((i: any) => String(i.invoice_number));
    const priorInvNumbers = (priorInv || []).map((i: any) => String(i.invoice_number));
    const allNumbers = Array.from(new Set([ ...periodInvNumbers, ...priorInvNumbers ]));
    // Locate AR (1200)
    const { data: arAcc } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('account_code', '1200')
      .maybeSingle();
    const arId = (arAcc as any)?.id;

    const openingInvoicesTotal = (priorInv || []).reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);
    let openingPaymentsTotal = 0;
    if (arId) {
      const { data: arCreditsPrior } = await supabase
        .from('transaction_entries')
        .select('credit, description, transactions!inner (transaction_date, status, description, reference_number)')
        .eq('account_id', arId)
        .lt('transactions.transaction_date', start)
        .eq('transactions.status', 'posted');
      openingPaymentsTotal = (arCreditsPrior || [])
        .filter((e: any) => {
          const tx = e.transactions as any;
          const ref = String(tx?.reference_number || '');
          const txDesc = String(tx?.description || '').toLowerCase();
          const entryDesc = String(e.description || '').toLowerCase();
          return priorInvNumbers.includes(ref) || txDesc.includes(nameLower) || entryDesc.includes(nameLower);
        })
        .reduce((s: number, e: any) => s + Number(e.credit || 0), 0);
    }
    let openingJournalTotal = 0;
    try {
      if (arId) {
        const { data: arEntries } = await supabase
          .from('transaction_entries')
          .select('debit, credit, description, transactions!inner (transaction_date, description, reference_number)')
          .eq('account_id', arId)
          .lt('transactions.transaction_date', start);
        openingJournalTotal = (arEntries || [])
          .filter((e: any) => {
            const tx = e.transactions as any;
            const ref = String(tx?.reference_number || '');
            const txDesc = String(tx?.description || '').toLowerCase();
            const entryDesc = String(e.description || '').toLowerCase();
            return ref === `OB-${customer.id}` || txDesc.includes(nameLower) || entryDesc.includes(nameLower);
          })
          .reduce((s: number, e: any) => s + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
      }
    } catch {}
    const openingBalance = openingInvoicesTotal - openingPaymentsTotal + openingJournalTotal;

    // Payments during period from AR credits
    let paymentsPeriodCredits: any[] = [];
    if (arId) {
      const { data: arCreditsPeriod } = await supabase
        .from('transaction_entries')
        .select('credit, description, transactions!inner (transaction_date, description, reference_number, status)')
        .eq('account_id', arId)
        .gte('transactions.transaction_date', start)
        .lte('transactions.transaction_date', end)
        .eq('transactions.status', 'posted');
      paymentsPeriodCredits = (arCreditsPeriod || [])
        .filter((e: any) => {
          if (!(Number(e.credit || 0) > 0)) return false;
          const tx = e.transactions as any;
          const ref = String(tx?.reference_number || '');
          const txDesc = String(tx?.description || '').toLowerCase();
          const entryDesc = String(e.description || '').toLowerCase();
          return allNumbers.includes(ref) || txDesc.includes(nameLower) || entryDesc.includes(nameLower);
        })
        .map((e: any) => ({
          date: (e.transactions as any).transaction_date,
          description: (e.transactions as any).description || e.description || 'Payment',
          reference: (e.transactions as any).reference_number || null,
          dr: 0,
          cr: Number(e.credit || 0)
        }));
    }

    // Fallback: posted receipts in transactions table for this customer (credit)
    let paymentsPeriodReceipts: any[] = [];
    try {
      const { data: txReceipts } = await supabase
        .from('transactions')
        .select('transaction_date,total_amount,description,reference_number,status,transaction_type')
        .eq('company_id', profile.company_id)
        .eq('transaction_type', 'receipt')
        .eq('status', 'posted')
        .gte('transaction_date', start)
        .lte('transaction_date', end);
      const filtered = (txReceipts || []).filter((t: any) => {
        const ref = String(t.reference_number || '');
        const desc = String(t.description || '').toLowerCase();
        return allNumbers.includes(ref) || desc.includes(nameLower);
      });
      paymentsPeriodReceipts = filtered.map((t: any) => ({
        date: t.transaction_date,
        description: t.description || 'Payment',
        reference: t.reference_number || null,
        dr: 0,
        cr: Number(t.total_amount || 0)
      }));
      // Deduplicate against AR credits by date and amount
      const creditKeys = new Set(paymentsPeriodCredits.map(p => `${String(p.date)}|${Number(p.cr).toFixed(2)}`));
      paymentsPeriodReceipts = paymentsPeriodReceipts.filter(p => !creditKeys.has(`${String(p.date)}|${Number(p.cr).toFixed(2)}`));
    } catch {}

    // Opening balance journals during period (explicit row if posted within range)
    let openingDebitsPeriod: any[] = [];
    if (arId) {
      const { data: arDebitsPeriod } = await supabase
        .from('transaction_entries')
        .select('debit, description, transactions!inner (transaction_date, description, reference_number, status)')
        .eq('account_id', arId)
        .gte('transactions.transaction_date', start)
        .lte('transactions.transaction_date', end)
        .eq('transactions.status', 'posted');
      openingDebitsPeriod = (arDebitsPeriod || [])
        .filter((e: any) => {
          if (!(Number(e.debit || 0) > 0)) return false;
          const tx = e.transactions as any;
          const ref = String(tx?.reference_number || '');
          const txDesc = String(tx?.description || '').toLowerCase();
          const entryDesc = String(e.description || '').toLowerCase();
          const isOb = ref === `OB-${customer.id}` || txDesc.includes(`opening balance for ${nameLower}`) || entryDesc.includes('opening balance');
          const mentionsName = txDesc.includes(nameLower) || entryDesc.includes(nameLower);
          return isOb && mentionsName;
        })
        .map((e: any) => ({
          date: (e.transactions as any).transaction_date,
          description: (e.transactions as any).description || e.description || 'Opening balance',
          reference: (e.transactions as any).reference_number || null,
          dr: Number(e.debit || 0),
          cr: 0
        }));
    }

    const entries = [
      // Opening balance row so it shows in viewer/PDF
      { date: start, description: 'Opening balance', reference: null, dr: openingBalance > 0 ? openingBalance : 0, cr: openingBalance < 0 ? Math.abs(openingBalance) : 0 },
      ...openingDebitsPeriod,
      ...((periodInv || []).map((r: any) => ({ date: r.invoice_date, description: `Invoice ${r.invoice_number}`, reference: r.invoice_number, dr: Number(r.total_amount || 0), cr: 0 }))),
      ...paymentsPeriodCredits,
      ...paymentsPeriodReceipts
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { openingBalance, entries };
  };

  const openStatementViewer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    const s = start.toISOString().split('T')[0];
    const e = end.toISOString().split('T')[0];
    setStartDate(s);
    setEndDate(e);
    const data = await buildStatementData(customer, s, e);
    setStatementOpeningBalance(data.openingBalance);
    setStatementEntries(data.entries);
    setStatementViewOpen(true);
  };

  const refreshStatementViewer = async () => {
    if (!selectedCustomer) return;
    const s = startDate;
    const e = endDate;
    const data = await buildStatementData(selectedCustomer, s, e);
    setStatementOpeningBalance(data.openingBalance);
    setStatementEntries(data.entries);
  };

  const loadBankAccounts = async () => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user?.id)
      .single();
    if (!profile?.company_id) return;
    const { data: bankList } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, account_number')
      .eq('company_id', profile.company_id);
    setBankAccounts(bankList || []);
  };

  const openPayment = async (customer: Customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setSelectedBankId('');
    await loadBankAccounts();
    setPaymentOpen(true);
  };

  const postCustomerPayment = async () => {
    try {
      const amt = Number(paymentAmount || 0);
      if (!paymentCustomer || !selectedBankId || !amt || amt <= 0) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', authUser.id)
        .single();
      if (!profile?.company_id) throw new Error('Company not found');
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('id, account_code, account_name, account_type')
        .eq('company_id', profile.company_id)
        .eq('is_active', true);
      const list = (accounts || []).map((a: any) => ({ id: String(a.id), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || ''), name: String(a.account_name || '').toLowerCase() }));
      const pick = (type: string, codes: string[], names: string[]) => {
        const byType = list.filter(a => a.type === type.toLowerCase());
        const byCode = byType.find(a => codes.includes(a.code));
        if (byCode) return byCode.id;
        const byName = byType.find(a => names.some(n => a.name.includes(n)));
        return byName?.id || null;
      };
      let bankLedgerId = pick('asset', ['1100'], ['bank','cash']);
      let arId = pick('asset', ['1200'], ['receiv','debtors']);
      if (!bankLedgerId) {
        const { data: created } = await supabase
          .from('chart_of_accounts')
          .insert({ company_id: profile.company_id, account_code: '1100', account_name: 'Bank', account_type: 'asset', is_active: true })
          .select('id')
          .single();
        bankLedgerId = (created as any)?.id || bankLedgerId;
      }
      if (!arId) {
        const { data: created } = await supabase
          .from('chart_of_accounts')
          .insert({ company_id: profile.company_id, account_code: '1200', account_name: 'Accounts Receivable', account_type: 'asset', is_active: true })
          .select('id')
          .single();
        arId = (created as any)?.id || arId;
      }
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          company_id: profile.company_id,
          user_id: authUser.id,
          transaction_date: paymentDate,
          description: `Customer payment from ${paymentCustomer.name}`,
          reference_number: null,
          total_amount: amt,
          transaction_type: 'receipt',
          status: 'pending',
          bank_account_id: selectedBankId,
        })
        .select('id')
        .single();
      if (txErr) throw txErr;
      const rows = [
        { transaction_id: (tx as any).id, account_id: bankLedgerId as string, debit: amt, credit: 0, description: 'Customer payment', status: 'approved' },
        { transaction_id: (tx as any).id, account_id: arId as string, debit: 0, credit: amt, description: 'Customer payment', status: 'approved' },
      ];
      const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
      if (teErr) throw teErr;
      const ledgerRows = rows.map(r => ({ company_id: profile.company_id, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: paymentDate, is_reversed: false, transaction_id: (tx as any).id, description: r.description }));
      const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
      if (leErr) throw leErr;
      await supabase.from('transactions').update({ status: 'posted' }).eq('id', (tx as any).id);
      try { await supabase.rpc('update_bank_balance', { _bank_account_id: selectedBankId, _amount: amt, _operation: 'add' }); } catch {}
      toast({ title: 'Success', description: 'Payment posted' });
      setPaymentOpen(false);
      setPaymentCustomer(null);
      setPaymentAmount('');
      setSelectedBankId('');
      await refreshStatementViewer();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to post payment', variant: 'destructive' });
    }
  };

  return (
    <>
      <SEO title="Customers | Rigel Business" description="Manage customer information" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Customers</h1>
              <p className="text-muted-foreground mt-1">Manage your customer database</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
              {canEdit && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Customer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Customer</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Label>Customer Name</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Address</Label>
                        <Input
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Opening Balance</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.openingBalance}
                            onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label>Opening Balance Date</Label>
                          <Input
                            type="date"
                            value={formData.openingDate}
                            onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full bg-gradient-primary">Add Customer</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                All Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No customers yet</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          {customer.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{customer.address || "-"}</TableCell>
                        <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openStatementDialog(customer)}>
                              <FileDown className="h-4 w-4 mr-2" /> Statement PDF
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => openStatementViewer(customer)}>
                              View Statement
                            </Button>
                            {canEdit && (
                              <Button className="bg-gradient-primary" size="sm" onClick={() => openPayment(customer)}>
                                Receive Payment
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
          </Card>

          <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Statement Options</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quick period</Label>
                    <Select value={monthsPreset} onValueChange={setMonthsPreset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">Last 3 months</SelectItem>
                        <SelectItem value="6">Last 6 months</SelectItem>
                        <SelectItem value="12">Last 12 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={useCustomRange} onCheckedChange={setUseCustomRange} />
                    <Label>Use custom date range</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!useCustomRange} />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!useCustomRange} />
                  </div>
                </div>
              </div>
              <div className="pt-4">
                <Button onClick={exportStatement} className="w-full bg-gradient-primary">Export PDF</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Customers Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>To issue an invoice, first add the customer here.</p>
                <p>Capture the customer’s basic information so invoices and statements reflect correct details.</p>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={statementViewOpen} onOpenChange={setStatementViewOpen}>
            <DialogContent className="sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Customer Statement</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-sm">Opening balance: {statementOpeningBalance.toFixed(2)}</div>
                  <Button variant="outline" onClick={refreshStatementViewer}>Refresh</Button>
                </div>
                <div className="border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Dr</TableHead>
                        <TableHead>Cr</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        let running = statementOpeningBalance;
                        return statementEntries.map((e, idx) => {
                          running = running + Number(e.dr || 0) - Number(e.cr || 0);
                          return (
                            <TableRow key={idx}>
                              <TableCell>{new Date(e.date).toLocaleDateString('en-ZA')}</TableCell>
                              <TableCell>{e.description}</TableCell>
                              <TableCell>{e.reference || '-'}</TableCell>
                              <TableCell>{Number(e.dr || 0).toFixed(2)}</TableCell>
                              <TableCell>{Number(e.cr || 0).toFixed(2)}</TableCell>
                              <TableCell>{running.toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Receive Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Customer</Label>
                  <Input readOnly value={paymentCustomer?.name || ''} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Bank</Label>
                  <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.bank_name} ({b.account_number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="pt-4">
                <Button className="w-full bg-gradient-primary" onClick={postCustomerPayment}>Post Payment</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
import React from "react";
