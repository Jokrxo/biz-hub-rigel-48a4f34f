import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { Users, FileText, Calculator, Plus, Check, BarChart, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useRoles } from "@/hooks/use-roles";
import { buildPayslipPDF, type PayslipForPDF } from "@/lib/payslip-export";
import { addLogoToPDF, fetchLogoDataUrl } from "@/lib/invoice-export";

type Employee = { id: string; first_name: string; last_name: string; email: string | null; id_number: string | null; start_date: string | null; active: boolean };
type PayItem = { id: string; code: string; name: string; type: "earning" | "deduction" | "employer"; taxable: boolean };
type PayRun = { id: string; company_id: string; period_start: string; period_end: string; status: string };
type PayRunLine = { id: string; pay_run_id: string; employee_id: string; gross: number; net: number; paye: number; uif_emp: number; uif_er: number; sdl_er: number };

export default function Payroll() {
  const [tab, setTab] = useState("runs");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();
  const canEdit = isAdmin || isAccountant;
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    const loadCompany = async () => {
      if (!hasSupabaseEnv) { setCompanyId(""); return; }
      const { data: profile } = await supabase
        .from("profiles" as any)
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if ((profile as any)?.company_id) setCompanyId((profile as any).company_id);
    };
    loadCompany();
  }, [user?.id]);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_payroll_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  return (
    <>
      <SEO title="Payroll | ApexAccounts" description="Manage payroll runs and employees" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Payroll</h1>
              <p className="text-muted-foreground mt-1">Employees, pay items, pay runs, and postings</p>
            </div>
            <Button variant="outline" onClick={() => setTutorialOpen(true)}>
              <Info className="h-4 w-4 mr-2" />
              Help & Tutorial
            </Button>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="runs">Pay Runs</TabsTrigger>
              <TabsTrigger value="employees">Employees</TabsTrigger>
              <TabsTrigger value="items">Pay Items</TabsTrigger>
              <TabsTrigger value="setup">Setup</TabsTrigger>
              <TabsTrigger value="periods">Periods</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="payslip">Payslip</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="help">Help</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <PayrollDashboard companyId={companyId} />
            </TabsContent>

            <TabsContent value="employees">
              <EmployeesTab companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="items">
              <PayItemsTab companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="runs">
              <PayRunsTab companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="setup">
              <PayrollSetup companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="periods">
              <PayrollPeriods companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="process">
              <PayrollProcess companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="payslip">
              <PayslipPreview companyId={companyId} />
            </TabsContent>

            <TabsContent value="reports">
              <PayrollReports companyId={companyId} />
            </TabsContent>

            <TabsContent value="help">
              <Card>
                <CardHeader><CardTitle>Payroll Manual</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div>1. Setup: Open Setup and configure UIF%, SDL%, tax brackets, pension rules, overtime rules, allowances.</div>
                    <div>2. Periods: Create the payroll period for the current month and keep status open.</div>
                    <div>3. Employees: Add employees with master data including banking, tax number, UI F coverage, salary type, pension, medical aid.</div>
                    <div>4. Process: Select a period, choose an employee, capture time & attendance, overtime, bonuses and commission, then submit to create a line.</div>
                    <div>5. Pay Runs: Open the run, review totals; Finalize to post entries, Pay to post net wages, Remit to post PAYE/UIF/SDL.</div>
                    <div>6. Payslip: Select the run and employee to preview; use Download Payslip or Send to email.</div>
                    <div>7. Reports: Use the Reports tab for monthly payroll totals and statutory summaries.</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Payroll Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Use this module to process payroll: manage employees, setup pay items, run pay periods, and generate payslips.</p>
                <p>Review reports for monthly totals and statutory summaries.</p>
              </div>
              <DialogFooter>
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function PayrollDashboard({ companyId }: { companyId: string }) {
  const [totals, setTotals] = useState<{ employees: number; gross: number; paye: number; uif: number; sdl: number; overtime: number; net: number }>({ employees: 0, gross: 0, paye: 0, uif: 0, sdl: 0, overtime: 0, net: 0 });
  useEffect(() => {
    const load = async () => {
      const { count: empCount } = await supabase.from("employees" as any).select("id", { count: "exact", head: true } as any).eq("company_id", companyId);
      const { data: lines } = await supabase
        .from("pay_run_lines" as any)
        .select("gross, net, paye, uif_emp, uif_er, sdl_er, details")
        .in(
          "pay_run_id",
          (await supabase.from("pay_runs" as any).select("id").eq("company_id", companyId)).data?.map((r: any) => r.id) || []
        );
      const gross = (lines || []).reduce((s, l: any) => s + (l.gross || 0), 0);
      const net = (lines || []).reduce((s, l: any) => s + (l.net || 0), 0);
      const paye = (lines || []).reduce((s, l: any) => s + (l.paye || 0), 0);
      const uif = (lines || []).reduce((s, l: any) => s + (l.uif_emp || 0) + (l.uif_er || 0), 0);
      const sdl = (lines || []).reduce((s, l: any) => s + (l.sdl_er || 0), 0);
      const overtime = (lines || []).reduce((s, l: any) => s + ((l.details?.overtime_amount) || 0), 0);
      setTotals({ employees: empCount || 0, gross, paye, uif, sdl, overtime, net });
    };
    if (companyId) load();
  }, [companyId]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Employees" value={`${totals.employees}`} />
      <StatCard title="This Month Payroll Cost" value={`R ${totals.gross.toFixed(2)}`} />
      <StatCard title="PAYE" value={`R ${totals.paye.toFixed(2)}`} />
      <StatCard title="UIF" value={`R ${totals.uif.toFixed(2)}`} />
      <StatCard title="SDL" value={`R ${totals.sdl.toFixed(2)}`} />
      <StatCard title="Total Overtime" value={`R ${totals.overtime.toFixed(2)}`} />
      <StatCard title="Net Pay" value={`R ${totals.net.toFixed(2)}`} />
    </div>
  );
}

function PayrollSetup({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>({ tax_brackets: null, pension_rules: null, uif_percent: 1, sdl_percent: 1, overtime_rules: null, allowances: null });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("payroll_settings" as any).select("*").eq("company_id", companyId).maybeSingle();
      if (data) setSettings(data);
      setLoading(false);
    };
    if (companyId) load();
  }, [companyId]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { company_id: companyId, tax_brackets: settings.tax_brackets, pension_rules: settings.pension_rules, uif_percent: settings.uif_percent, sdl_percent: settings.sdl_percent, overtime_rules: settings.overtime_rules, allowances: settings.allowances };
    const { data: existingData } = await supabase.from("payroll_settings" as any).select("id").eq("company_id", companyId).maybeSingle();
    const { error } = existingData ? await supabase.from("payroll_settings" as any).update(payload as any).eq("id", (existingData as any).id) : await supabase.from("payroll_settings" as any).insert(payload as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Saved", description: "Setup saved" });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Payroll Setup</CardTitle></CardHeader>
      <CardContent>
        {loading ? (<div className="py-8 text-center text-muted-foreground">Loading…</div>) : (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>UIF %</Label>
                <Input type="number" step="0.01" value={settings.uif_percent || 1} onChange={e => setSettings({ ...settings, uif_percent: parseFloat(e.target.value) })} />
              </div>
              <div>
                <Label>SDL %</Label>
                <Input type="number" step="0.01" value={settings.sdl_percent || 1} onChange={e => setSettings({ ...settings, sdl_percent: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Tax Brackets (JSON)</Label>
              <Input value={settings.tax_brackets ? JSON.stringify(settings.tax_brackets) : ""} onChange={e => setSettings({ ...settings, tax_brackets: e.target.value ? JSON.parse(e.target.value) : null })} />
            </div>
            <div>
              <Label>Pension Rules (JSON)</Label>
              <Input value={settings.pension_rules ? JSON.stringify(settings.pension_rules) : ""} onChange={e => setSettings({ ...settings, pension_rules: e.target.value ? JSON.parse(e.target.value) : null })} />
            </div>
            <div>
              <Label>Overtime Rules (JSON)</Label>
              <Input value={settings.overtime_rules ? JSON.stringify(settings.overtime_rules) : ""} onChange={e => setSettings({ ...settings, overtime_rules: e.target.value ? JSON.parse(e.target.value) : null })} />
            </div>
            <div>
              <Label>Allowances Setup (JSON)</Label>
              <Input value={settings.allowances ? JSON.stringify(settings.allowances) : ""} onChange={e => setSettings({ ...settings, allowances: e.target.value ? JSON.parse(e.target.value) : null })} />
            </div>
            {canEdit && <Button type="submit" className="bg-gradient-primary">Save</Button>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function PayrollPeriods({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<any[]>([]);
  const [form, setForm] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const load = async () => {
    const { data } = await supabase.from("payroll_periods" as any).select("*").eq("company_id", companyId).order("start_date", { ascending: false });
    setPeriods(data || []);
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(form.year, form.month - 1, 1);
    const end = new Date(form.year, form.month, 0);
    const payload = { company_id: companyId, year: form.year, month: form.month, name: `${form.year}-${String(form.month).padStart(2, '0')}`, start_date: start.toISOString().split('T')[0], end_date: end.toISOString().split('T')[0], status: 'open' };
    const { error } = await supabase.from("payroll_periods" as any).insert(payload as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Success", description: "Period created" });
    load();
  };
  const close = async (id: string) => {
    const { error } = await supabase.from("payroll_periods" as any).update({ status: 'closed' } as any).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    load();
  };
  return (
    <Card>
      <CardHeader><CardTitle>Payroll Periods</CardTitle></CardHeader>
      <CardContent>
        {canEdit && (
          <form onSubmit={create} className="flex items-end gap-3 mb-4">
            <div className="w-32">
              <Label>Year</Label>
              <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value || '0') })} />
            </div>
            <div className="w-32">
              <Label>Month</Label>
              <Input type="number" value={form.month} onChange={e => setForm({ ...form, month: parseInt(e.target.value || '0') })} />
            </div>
            <Button type="submit" className="bg-gradient-primary">Create</Button>
          </form>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(periods || []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{new Date(p.start_date).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(p.end_date).toLocaleDateString()}</TableCell>
                <TableCell className="capitalize">{p.status}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {canEdit && p.status !== 'closed' && <Button size="sm" variant="outline" onClick={() => close(p.id)}>Close</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayrollProcess({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState<string>("");
  const [periods, setPeriods] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ employee_id: "", hours: "", overtime_hours: "", bonuses: "", commission: "" });
  const [run, setRun] = useState<any>(null);
  useEffect(() => {
    const load = async () => {
      const { data: ps } = await supabase.from("payroll_periods" as any).select("*").eq("company_id", companyId).order("start_date", { ascending: false });
      setPeriods((ps || []) as any);
      const { data: emps } = await supabase.from("employees" as any).select("*").eq("company_id", companyId).order("first_name", { ascending: true });
      setEmployees((emps || []) as any);
    };
    if (companyId) load();
  }, [companyId]);
  const ensureRun = async (): Promise<any> => {
    const p = periods.find((x: any) => x.id === period);
    if (!p) { toast({ title: "Error", description: "Select a period", variant: "destructive" }); return null; }
    const { data: existing } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).eq("period_start", p.start_date).eq("period_end", p.end_date).maybeSingle();
    if (existing) { setRun(existing); return existing; }
    const { data, error } = await supabase.from("pay_runs" as any).insert({ company_id: companyId, period_start: p.start_date, period_end: p.end_date, status: 'draft' } as any).select("*").single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    setRun(data); return data;
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await ensureRun();
    if (!r) return;
    const hours = parseFloat(form.hours || "0");
    const overtimeHours = parseFloat(form.overtime_hours || "0");
    const bonuses = parseFloat(form.bonuses || "0");
    const commission = parseFloat(form.commission || "0");
    const baseRate = 0;
    const gross = bonuses + commission;
    const details = { hours, overtime_hours: overtimeHours, overtime_amount: 0, bonuses, commission };
    const calc = { paye: +(gross * 0.18).toFixed(2), uif_emp: +(gross * 0.01).toFixed(2), uif_er: +(gross * 0.01).toFixed(2), sdl_er: +(gross * 0.01).toFixed(2) };
    const net = +(gross - calc.paye - calc.uif_emp).toFixed(2);
    const payload = { pay_run_id: (r as any).id, employee_id: form.employee_id, gross, net, paye: calc.paye, uif_emp: calc.uif_emp, uif_er: calc.uif_er, sdl_er: calc.sdl_er, details };
    const { error } = await supabase.from("pay_run_lines" as any).insert(payload as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Success", description: "Captured payroll for employee" });
    setForm({ employee_id: "", hours: "", overtime_hours: "", bonuses: "", commission: "" });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Process Payroll</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Period</Label>
              <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>
                  {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={(v: any) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time & Attendance (hrs)</Label>
              <Input type="number" step="0.01" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} />
            </div>
            <div>
              <Label>Overtime (hrs)</Label>
              <Input type="number" step="0.01" value={form.overtime_hours} onChange={e => setForm({ ...form, overtime_hours: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Bonuses</Label>
              <Input type="number" step="0.01" value={form.bonuses} onChange={e => setForm({ ...form, bonuses: e.target.value })} />
            </div>
            <div>
              <Label>Commission</Label>
              <Input type="number" step="0.01" value={form.commission} onChange={e => setForm({ ...form, commission: e.target.value })} />
            </div>
          </div>
          {canEdit && <Button type="submit" className="bg-gradient-primary">Capture</Button>}
        </form>
      </CardContent>
    </Card>
  );
}

function PayslipPreview({ companyId }: { companyId: string }) {
  const [run, setRun] = useState<any>(null);
  const [line, setLine] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data: rs } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).order("period_start", { ascending: false });
      setRuns(rs || []);
    };
    if (companyId) load();
  }, [companyId]);
  const pickRun = async (id: string) => {
    setRun(runs.find(r => r.id === id));
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", id);
    setLines(data || []);
  };
  useEffect(() => {
    const loadEmployees = async () => {
      const { data } = await supabase.from('employees').select('*').eq('company_id', companyId);
      setEmployees((data || []) as any);
    };
    if (companyId) loadEmployees();
  }, [companyId]);
  const download = async () => {
    if (!run || !line) return;
    const emp = employees.find(e => e.id === line.employee_id);
    const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : line.employee_id;
    const slip: PayslipForPDF = {
      period_start: run.period_start,
      period_end: run.period_end,
      employee_name,
      gross: line.gross,
      net: line.net,
      paye: line.paye,
      uif_emp: line.uif_emp,
      uif_er: line.uif_er,
      sdl_er: line.sdl_er,
      details: line.details || null,
    };
    const { data: company } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .limit(1)
      .maybeSingle();
    const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
    const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
    if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
    const periodName = `${new Date(run.period_start).toLocaleDateString('en-ZA')} - ${new Date(run.period_end).toLocaleDateString('en-ZA')}`;
    doc.save(`payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`);
  };
  return (
    <Card>
      <CardHeader><CardTitle>Payslip Preview</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Select onValueChange={pickRun}>
            <SelectTrigger><SelectValue placeholder="Select run" /></SelectTrigger>
            <SelectContent>
              {runs.map(r => <SelectItem key={r.id} value={r.id}>{new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(id: any) => setLine(lines.find(l => l.id === id))}>
            <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.employee_id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!line ? (
          <div className="py-8 text-center text-muted-foreground">Select a run and employee</div>
        ) : (
          <div className="border rounded-md p-6 space-y-2">
            <div className="text-xl font-semibold">Payslip</div>
            <div className="grid grid-cols-2">
              <div>Gross: R {line.gross.toFixed(2)}</div>
              <div>Net: R {line.net.toFixed(2)}</div>
              <div>PAYE: R {line.paye.toFixed(2)}</div>
              <div>UIF (Emp+Er): R {(line.uif_emp + line.uif_er).toFixed(2)}</div>
              <div>SDL: R {line.sdl_er.toFixed(2)}</div>
            </div>
            <div>Earnings vs Deductions</div>
            <div className="pt-2">
              <Button variant="outline" onClick={download}>Download Payslip</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PayrollReports({ companyId }: { companyId: string }) {
  const [month, setMonth] = useState<string>("");
  const [runs, setRuns] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data: rs } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).order("period_start", { ascending: false });
      setRuns(rs || []);
    };
    if (companyId) load();
  }, [companyId]);
  const pick = async (id: string) => {
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", id);
    setLines(data || []);
  };
  const totals = {
    gross: lines.reduce((s, l: any) => s + (l.gross || 0), 0),
    net: lines.reduce((s, l: any) => s + (l.net || 0), 0),
    paye: lines.reduce((s, l: any) => s + (l.paye || 0), 0),
    uif: lines.reduce((s, l: any) => s + (l.uif_emp || 0) + (l.uif_er || 0), 0),
    sdl: lines.reduce((s, l: any) => s + (l.sdl_er || 0), 0),
  };
  return (
    <Card>
      <CardHeader><CardTitle>Payroll Reports</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select onValueChange={pick}>
            <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
            <SelectContent>
              {runs.map(r => <SelectItem key={r.id} value={r.id}>{new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="Monthly Payroll" value={`R ${totals.gross.toFixed(2)}`} />
          <StatCard title="PAYE Report" value={`R ${totals.paye.toFixed(2)}`} />
          <StatCard title="UIF Report" value={`R ${totals.uif.toFixed(2)}`} />
          <StatCard title="SDL Report" value={`R ${totals.sdl.toFixed(2)}`} />
          <StatCard title="Net Pay" value={`R ${totals.net.toFixed(2)}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeesTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", id_number: "", start_date: "" });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("company_id", companyId)
        .order("first_name", { ascending: true });
      if (error) throw error;
      setEmployees((data || []) as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
    const { error } = await supabase.from("employees" as any).insert({
      company_id: companyId,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      id_number: form.id_number || null,
      start_date: form.start_date || null,
      active: true,
    } as any);
      if (error) throw error;
      toast({ title: "Success", description: "Employee created" });
      setDialogOpen(false);
      setForm({ first_name: "", last_name: "", email: "", id_number: "", start_date: "" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Employees</CardTitle>
        {canEdit && <Button onClick={() => setDialogOpen(true)} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />New</Button>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No employees</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.first_name} {e.last_name}</TableCell>
                  <TableCell>{e.email || "-"}</TableCell>
                  <TableCell>{e.id_number || "-"}</TableCell>
                  <TableCell>{e.start_date ? new Date(e.start_date).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>{e.active ? "Active" : "Inactive"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name</Label>
                <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>ID Number</Label>
                <Input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
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

function PayItemsTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<PayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{ code: string; name: string; type: "earning" | "deduction" | "employer"; taxable: boolean }>({ code: "", name: "", type: "earning", taxable: true });

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pay_items" as any)
        .select("id, code, name, type, taxable")
        .eq("company_id", companyId)
        .order("code", { ascending: true });
      if (error) throw error;
      setItems((data || []) as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("pay_items" as any).insert({
        company_id: companyId,
        code: form.code,
        name: form.name,
        type: form.type,
        taxable: form.taxable,
      } as any);
      if (error) throw error;
      toast({ title: "Success", description: "Pay item created" });
      setDialogOpen(false);
      setForm({ code: "", name: "", type: "earning", taxable: true });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Pay Items</CardTitle>
        {canEdit && <Button onClick={() => setDialogOpen(true)} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />New</Button>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No pay items</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Taxable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id}>
                  <TableCell>{i.code}</TableCell>
                  <TableCell>{i.name}</TableCell>
                  <TableCell className="capitalize">{i.type}</TableCell>
                  <TableCell>{i.taxable ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Pay Item</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
              </div>
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Earning</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Label className="w-full">Taxable</Label>
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, taxable: !form.taxable })}>{form.taxable ? "Yes" : "No"}</Button>
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

function PayRunsTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PayRun | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [lines, setLines] = useState<PayRunLine[]>([]);
  const [form, setForm] = useState({ period_start: new Date().toISOString().split("T")[0], period_end: new Date().toISOString().split("T")[0] });
  const [addLine, setAddLine] = useState<{ employee_id: string; gross: string }>({ employee_id: "", gross: "" });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState<string>("");
  const [sendMessage, setSendMessage] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [selectedLine, setSelectedLine] = useState<PayRunLine | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pay_runs" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      setRuns((data || []) as any);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    const { data } = await supabase.from("employees" as any).select("*").eq("company_id", companyId).order("first_name", { ascending: true });
    setEmployees((data || []) as any);
  };

  const loadLines = async (runId: string) => {
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", runId);
    setLines((data || []) as any);
  };

  useEffect(() => { if (companyId) { loadRuns(); loadEmployees(); } }, [companyId]);

  const createRun = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from("pay_runs" as any)
        .insert({ company_id: companyId, period_start: form.period_start, period_end: form.period_end, status: "draft" } as any)
        .select("*")
        .single();
      if (error) throw error;
      toast({ title: "Success", description: "Pay run created" });
      setSelectedRun(data as any);
      loadRuns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const calcLine = (gross: number) => {
    const uifCap = 17712;
    const uifBase = Math.min(gross, uifCap);
    const uifEmp = +(uifBase * 0.01).toFixed(2);
    const uifEr = +(uifBase * 0.01).toFixed(2);
    const sdlEr = +(gross * 0.01).toFixed(2);
    const paye = +(gross * 0.18).toFixed(2);
    const net = +(gross - paye - uifEmp).toFixed(2);
    return { paye, uif_emp: uifEmp, uif_er: uifEr, sdl_er: sdlEr, net };
  };

  const addEmployeeToRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRun) return;
    const gross = parseFloat(addLine.gross || "0");
    if (!addLine.employee_id || gross <= 0) { toast({ title: "Error", description: "Select employee and enter gross", variant: "destructive" }); return; }
    const c = calcLine(gross);
    const payload = { pay_run_id: selectedRun.id, employee_id: addLine.employee_id, gross, net: c.net, paye: c.paye, uif_emp: c.uif_emp, uif_er: c.uif_er, sdl_er: c.sdl_er };
    const { error } = await supabase.from("pay_run_lines" as any).insert(payload as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setAddLine({ employee_id: "", gross: "" });
    loadLines(selectedRun.id);
  };

  const totals = useMemo(() => {
    const g = lines.reduce((s, l) => s + (l.gross || 0), 0);
    const n = lines.reduce((s, l) => s + (l.net || 0), 0);
    const p = lines.reduce((s, l) => s + (l.paye || 0), 0);
    const uemp = lines.reduce((s, l) => s + (l.uif_emp || 0), 0);
    const uer = lines.reduce((s, l) => s + (l.uif_er || 0), 0);
    const sdl = lines.reduce((s, l) => s + (l.sdl_er || 0), 0);
    return { gross: g, net: n, paye: p, uif_emp: uemp, uif_er: uer, sdl_er: sdl };
  }, [lines]);

  const selectRun = async (run: PayRun) => {
    setSelectedRun(run);
    await loadLines(run.id);
  };

  const finalizeRun = async () => {
    if (!selectedRun) return;
    const { error } = await supabase.rpc("post_pay_run_finalize", { _pay_run_id: selectedRun.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Success", description: "Pay run finalized and posted" });
    loadRuns();
  };

  const payNetWages = async () => {
    if (!selectedRun) return;
    const { error } = await supabase.rpc("post_pay_run_pay", { _pay_run_id: selectedRun.id, _amount: totals.net });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Success", description: "Net wages paid" });
    loadRuns();
  };

  const remitStatutory = async () => {
    const errs: string[] = [];
    const calls = [
      supabase.rpc("post_statutory_remit", { _company_id: companyId, _type: "paye", _amount: totals.paye, _reference: `${selectedRun?.period_end}` }),
      supabase.rpc("post_statutory_remit", { _company_id: companyId, _type: "uif", _amount: +(totals.uif_emp + totals.uif_er).toFixed(2), _reference: `${selectedRun?.period_end}` }),
      supabase.rpc("post_statutory_remit", { _company_id: companyId, _type: "sdl", _amount: totals.sdl_er, _reference: `${selectedRun?.period_end}` }),
    ];
    const results = await Promise.all(calls);
    results.forEach((r: any) => { if (r.error) errs.push(r.error.message); });
    if (errs.length) { toast({ title: "Error", description: errs.join("; "), variant: "destructive" }); return; }
    toast({ title: "Success", description: "Statutory remittances posted" });
  };

  const downloadLinePayslip = async (l: PayRunLine) => {
    const run = selectedRun;
    if (!run) return;
    const emp = employees.find(e => e.id === l.employee_id);
    const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : l.employee_id;
    const slip: PayslipForPDF = {
      period_start: run.period_start,
      period_end: run.period_end,
      employee_name,
      gross: l.gross,
      net: l.net,
      paye: l.paye,
      uif_emp: l.uif_emp,
      uif_er: l.uif_er,
      sdl_er: l.sdl_er,
      details: null,
    };
    const { data: company } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .limit(1)
      .maybeSingle();
    const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
    const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
    if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
    const periodName = `${new Date(run.period_start).toLocaleDateString('en-ZA')} - ${new Date(run.period_end).toLocaleDateString('en-ZA')}`;
    doc.save(`payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`);
  };

  const openSendDialog = (l: PayRunLine) => {
    setSelectedLine(l);
    const emp = employees.find(e => e.id === l.employee_id);
    const email = emp?.email || "";
    setSendEmail(email);
    const msg = `Hello,\n\nPlease find your payslip.\nNet Pay: R ${l.net.toFixed(2)}.`;
    setSendMessage(msg);
    setSendDialogOpen(true);
  };

  const handleSendPayslip = async () => {
    if (!selectedLine || !selectedRun) return;
    if (!sendEmail) { toast({ title: 'Error', description: 'Please enter recipient email', variant: 'destructive' }); return; }
    setSending(true);
    try {
      const emp = employees.find(e => e.id === selectedLine.employee_id);
      const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : selectedLine.employee_id;
      const slip: PayslipForPDF = {
        period_start: selectedRun.period_start,
        period_end: selectedRun.period_end,
        employee_name,
        gross: selectedLine.gross,
        net: selectedLine.net,
        paye: selectedLine.paye,
        uif_emp: selectedLine.uif_emp,
        uif_er: selectedLine.uif_er,
        sdl_er: selectedLine.sdl_er,
        details: null,
      };
      const { data: company } = await supabase
        .from('companies')
        .select('name,email,phone,address,tax_number,vat_number,logo_url')
        .limit(1)
        .maybeSingle();
      const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
      const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      const blob = doc.output('blob');
      const periodName = `${new Date(selectedRun.period_start).toLocaleDateString('en-ZA')} - ${new Date(selectedRun.period_end).toLocaleDateString('en-ZA')}`;
      const fileName = `payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`;
      const path = `payslips/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from('quotes')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true });
      let publicUrl = '';
      if (!uploadErr) {
        const { data } = supabase.storage.from('quotes').getPublicUrl(path);
        publicUrl = data?.publicUrl || '';
      }
      const subject = encodeURIComponent(`Payslip ${periodName}`);
      const bodyLines = [sendMessage, publicUrl ? `\nDownload: ${publicUrl}` : ''].join('\n');
      const body = encodeURIComponent(bodyLines);
      window.location.href = `mailto:${sendEmail}?subject=${subject}&body=${body}`;
      toast({ title: 'Success', description: 'Email compose opened with payslip link' });
      setSendDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to prepare payslip email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" />Pay Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {canEdit && (
            <form onSubmit={createRun} className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} />
                </div>
                <div>
                  <Label>End</Label>
                  <Input type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="bg-gradient-primary">Create Run</Button>
            </form>
          )}
          {loading ? (
            <div className="py-6 text-center text-muted-foreground">Loading…</div>
          ) : runs.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">No pay runs</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => selectRun(r)}>Open</Button>
                        {canEdit && r.status === "draft" && <Button size="sm" className="bg-gradient-primary" onClick={finalizeRun}><Check className="h-3 w-3 mr-1" />Finalize</Button>}
                        {canEdit && r.status !== "paid" && <Button size="sm" variant="outline" onClick={payNetWages}>Pay</Button>}
                        {canEdit && <Button size="sm" variant="outline" onClick={remitStatutory}>Remit</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Run Details</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedRun ? (
            <div className="py-10 text-center text-muted-foreground">Select a pay run</div>
          ) : (
            <>
              <div className="flex items-end gap-3 mb-4">
                <div className="w-64">
                  <Label>Employee</Label>
                  <Select value={addLine.employee_id} onValueChange={(v: any) => setAddLine({ ...addLine, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-40">
                  <Label>Gross (R)</Label>
                  <Input type="number" step="0.01" value={addLine.gross} onChange={e => setAddLine({ ...addLine, gross: e.target.value })} />
                </div>
                <Button onClick={addEmployeeToRun} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />Add</Button>
              </div>

              {lines.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground">No employees in this run</div>
              ) : (
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">PAYE</TableHead>
                    <TableHead className="text-right">UIF Emp</TableHead>
                    <TableHead className="text-right">UIF Er</TableHead>
                    <TableHead className="text-right">SDL Er</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map(l => {
                    const emp = employees.find(e => e.id === l.employee_id);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>{emp ? `${emp.first_name} ${emp.last_name}` : l.employee_id}</TableCell>
                        <TableCell className="text-right">R {l.gross.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R {l.paye.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R {l.uif_emp.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R {l.uif_er.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R {l.sdl_er.toFixed(2)}</TableCell>
                        <TableCell className="text-right">R {l.net.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => downloadLinePayslip(l)}>Download</Button>
                          <Button size="sm" variant="outline" onClick={() => openSendDialog(l)} className="ml-2">Send</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                    <TableRow>
                      <TableCell className="font-semibold">Totals</TableCell>
                      <TableCell className="text-right font-semibold">R {totals.gross.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R {totals.paye.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R {totals.uif_emp.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R {totals.uif_er.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R {totals.sdl_er.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">R {totals.net.toFixed(2)}</TableCell>
                    </TableRow>
            </TableBody>
          </Table>
        )}
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send payslip</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input type="email" placeholder="Recipient email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} />
              <Textarea rows={6} value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSendPayslip} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}