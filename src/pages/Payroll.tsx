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
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TransactionFormEnhanced } from "@/components/Transactions/TransactionFormEnhanced";
import React, { useEffect, useMemo, useState, useCallback, FormEvent } from "react";
import { Users, FileText, Calculator, Plus, Check, BarChart, Info, ArrowRight, Trash2, Wallet, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, MoreHorizontal, LayoutDashboard, Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { useRoles } from "@/hooks/use-roles";
import { buildPayslipPDF, type PayslipForPDF } from "@/lib/payslip-export";
import { addLogoToPDF, fetchLogoDataUrl } from "@/lib/invoice-export";
import { getCompanyTaxSettings } from "@/lib/payroll/services/taxService";
import * as XLSX from "xlsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { MetricCard } from "@/components/ui/MetricCard";

type Employee = { id: string; first_name: string; last_name: string; email: string | null; id_number: string | null; start_date: string | null; salary_type: string | null; bank_name: string | null; bank_branch_code: string | null; bank_account_number: string | null; bank_account_type: string | null; active: boolean };
type PayItem = { id: string; code: string; name: string; type: "earning" | "deduction" | "employer"; taxable: boolean };
type PayRun = { id: string; company_id: string; period_start: string; period_end: string; status: string };
type PayRunLine = { id: string; pay_run_id: string; employee_id: string; gross: number; net: number; paye: number; uif_emp: number; uif_er: number; sdl_er: number };

async function getEmployees(companyId: string): Promise<Employee[]> {
  const { data } = await supabase
    .from("employees" as any)
    .select("*")
    .eq("company_id", companyId)
    .order("first_name", { ascending: true });
  return (data || []) as any;
}

async function postEarnings(payload: { pay_run_id: string; employee_id: string; type: string; hours?: number | null; rate?: number | null; amount?: number | null; }): Promise<void> {
  const { data: line } = await supabase
    .from("pay_run_lines" as any)
    .select("*")
    .eq("pay_run_id", payload.pay_run_id)
    .eq("employee_id", payload.employee_id)
    .maybeSingle();
  const calc = (payload.amount ?? ((payload.hours || 0) * (payload.rate || 0))) || 0;
  const details = (line as any)?.details || { earnings: [], deductions: [], employer: [] };
  details.earnings = Array.isArray(details.earnings) ? details.earnings : [];
  details.earnings.push({ name: payload.type, amount: calc });
  await supabase
    .from("pay_run_lines" as any)
    .update({ details } as any)
    .eq("id", (line as any)?.id);
}

async function deleteEarnings(pay_run_id: string, employee_id: string, type: string): Promise<void> {
  const { data: line } = await supabase
    .from("pay_run_lines" as any)
    .select("*")
    .eq("pay_run_id", pay_run_id)
    .eq("employee_id", employee_id)
    .maybeSingle();
  if (!line) return;
  const details = (line as any)?.details || { earnings: [], deductions: [], employer: [] };
  details.earnings = (Array.isArray(details.earnings) ? details.earnings : []).filter((e: any) => String(e?.name || "") !== String(type));
  await supabase
    .from("pay_run_lines" as any)
    .update({ details } as any)
    .eq("id", (line as any)?.id);
}

async function postDeductions(payload: { pay_run_id: string; employee_id: string; type: string; amount: number; }): Promise<void> {
  const { data: line } = await supabase
    .from("pay_run_lines" as any)
    .select("*")
    .eq("pay_run_id", payload.pay_run_id)
    .eq("employee_id", payload.employee_id)
    .maybeSingle();
  const details = (line as any)?.details || { earnings: [], deductions: [], employer: [] };
  details.deductions = Array.isArray(details.deductions) ? details.deductions : [];
  details.deductions.push({ name: payload.type, amount: payload.amount || 0 });
  await supabase
    .from("pay_run_lines" as any)
    .update({ details } as any)
    .eq("id", (line as any)?.id);
}

async function deleteDeductions(pay_run_id: string, employee_id: string, type: string): Promise<void> {
  const { data: line } = await supabase
    .from("pay_run_lines" as any)
    .select("*")
    .eq("pay_run_id", pay_run_id)
    .eq("employee_id", employee_id)
    .maybeSingle();
  if (!line) return;
  const details = (line as any)?.details || { earnings: [], deductions: [], employer: [] };
  details.deductions = (Array.isArray(details.deductions) ? details.deductions : []).filter((d: any) => String(d?.name || "") !== String(type));
  await supabase
    .from("pay_run_lines" as any)
    .update({ details } as any)
    .eq("id", (line as any)?.id);
}

async function postPayrollProcess(args: { company_id: string; employee_id: string; period_start: string; period_end: string; pay_run_id: string; }): Promise<{ gross: number; net: number; }> {
  const { data: line } = await supabase
    .from("pay_run_lines" as any)
    .select("gross, net")
    .eq("pay_run_id", args.pay_run_id)
    .eq("employee_id", args.employee_id)
    .maybeSingle();
  const gross = Number((line as any)?.gross || 0);
  const net = Number((line as any)?.net || 0);
  return { gross, net };
}

async function loadLines(pay_run_id: string): Promise<any[]> {
  const { data } = await supabase
    .from("pay_run_lines" as any)
    .select("*")
    .eq("pay_run_id", pay_run_id);
  return (data || []) as any[];
}

async function postPayrollPayslip(runId: string, employeeId: string): Promise<any> {
  const { data } = await supabase
    .from("pay_run_lines" as any)
    .select("*")
    .eq("pay_run_id", runId)
    .eq("employee_id", employeeId)
    .maybeSingle();
  return data || {};
}

async function getReportsEmp201(companyId: string, start: string, end: string): Promise<any> {
  const { data } = await supabase
    .from("pay_run_lines" as any)
    .select("paye,uif_emp,uif_er,sdl_er")
    .in("pay_run_id", (await supabase.from("pay_runs" as any).select("id").eq("company_id", companyId).gte("period_start", start).lte("period_end", end)).data?.map((r: any) => r.id) || []);
  const totals = (data || []).reduce((s: any, r: any) => ({ paye: s.paye + (r.paye || 0), uif_emp: s.uif_emp + (r.uif_emp || 0), uif_er: s.uif_er + (r.uif_er || 0), sdl_er: s.sdl_er + (r.sdl_er || 0) }), { paye: 0, uif_emp: 0, uif_er: 0, sdl_er: 0 });
  return totals;
}

async function getReportsEmp501(companyId: string, start: string, end: string): Promise<any> {
  return await getReportsEmp201(companyId, start, end);
}

async function getReportsIrp5(companyId: string, employeeId: string, start: string, end: string): Promise<any> {
  const { data } = await supabase
    .from("pay_run_lines" as any)
    .select("gross,net,paye,uif_emp,uif_er,sdl_er")
    .in("pay_run_id", (await supabase.from("pay_runs" as any).select("id").eq("company_id", companyId).gte("period_start", start).lte("period_end", end)).data?.map((r: any) => r.id) || [])
    .eq("employee_id", employeeId);
  return { items: data || [] };
}

export default function Payroll() {
  const [tab, setTab] = useState("dashboard");
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isAccountant } = useRoles();
  const canEdit = isAdmin || isAccountant;
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string>("");
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

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
      <SEO title="Payroll | Rigel Business" description="Manage payroll runs and employees" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header with Quick Actions */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">Payroll Management</h1>
              <p className="text-muted-foreground mt-1">Manage employees, pay runs, and tax submissions efficiently</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Tutorial
              </Button>
              <Sheet open={isQuickActionsOpen} onOpenChange={setIsQuickActionsOpen}>
                <SheetTrigger asChild>
                  <Button className="bg-gradient-primary shadow-lg hover:shadow-xl transition-all">
                    <Plus className="h-4 w-4 mr-2" /> Quick Actions
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Payroll Actions</SheetTitle>
                    <SheetDescription>Quick access to common payroll tasks</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setTab("run"); setIsQuickActionsOpen(false); }}>
                      <Calculator className="h-5 w-5 mr-3 text-primary" />
                      Run Payroll
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setTab("employees"); setIsQuickActionsOpen(false); }}>
                      <Users className="h-5 w-5 mr-3 text-blue-500" />
                      Add Employee
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setTab("items"); setIsQuickActionsOpen(false); }}>
                      <FileText className="h-5 w-5 mr-3 text-green-500" />
                      Manage Pay Items
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setTab("history"); setIsQuickActionsOpen(false); }}>
                      <BarChart className="h-5 w-5 mr-3 text-purple-500" />
                      View History
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <div className="border-b pb-px overflow-x-auto">
              <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 rounded-none">
                <TabsTrigger 
                  value="dashboard"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="employees"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Employees
                </TabsTrigger>
                <TabsTrigger 
                  value="run"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  Run Payroll
                </TabsTrigger>
                <TabsTrigger 
                  value="posting"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  Posting & Payment
                </TabsTrigger>
                <TabsTrigger 
                  value="items"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Pay Items
                </TabsTrigger>
                <TabsTrigger 
                  value="history"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <BarChart className="h-4 w-4" />
                  Reports
                </TabsTrigger>
                <TabsTrigger 
                  value="tax"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Landmark className="h-4 w-4" />
                  Tax Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="animate-in fade-in-50 duration-500">
              <PayrollDashboard companyId={companyId} setTab={setTab} />
            </TabsContent>

            <TabsContent value="run">
              <RunPayrollWizard companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="employees">
              <EmployeesSimple companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="posting">
              <PayrollPostingModule companyId={companyId} />
            </TabsContent>

            <TabsContent value="items">
              <PayItemsSimple companyId={companyId} canEdit={canEdit} />
            </TabsContent>

            <TabsContent value="history">
              <PayrollReports companyId={companyId} />
            </TabsContent>

            <TabsContent value="tax">
              <PayrollTaxSettings companyId={companyId} canEdit={canEdit} />
            </TabsContent>
          </Tabs>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Payroll Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Simple 5-step workflow aligned with South African payroll:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Add Employees (Monthly/Hourly/Weekly, salary amount, bank details)</li>
                  <li>Pay Items auto-setup: Basic Salary, Allowance, Overtime, PAYE, UIF (Emp/Er), SDL (Er)</li>
                  <li>Select Payroll Period (create if not present)</li>
                  <li>Run Payroll: enter allowances, overtime, bonuses, extra deductions; calculations apply automatically</li>
                  <li>Generate Payslip and Post to Ledger (expenses and statutory payables)</li>
                </ol>
                <p>No manual PAYE/UIF/SDL calculations are needed — the system applies SARS brackets and statutory rates.</p>
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

function PayrollTaxSettings({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<{ brackets: { up_to: number | null; rate: number; base: number }[]; rebates: { primary: number }; uif_cap: number; sdl_rate: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      try {
        const c = await getCompanyTaxSettings(companyId);
        setCfg(c);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId]);

  const updateBracket = (idx: number, field: 'up_to' | 'rate' | 'base', value: string) => {
    if (!cfg) return;
    const next = { ...cfg, brackets: cfg.brackets.map((b, i) => i === idx ? { ...b, [field]: field === 'up_to' ? (value === '' ? null : Number(value)) : Number(value) } : b) };
    setCfg(next);
  };

  const addBracket = () => {
    if (!cfg) return;
    const next = { ...cfg, brackets: [...cfg.brackets, { up_to: null, rate: 0.00, base: 0 }] };
    setCfg(next);
  };

  const removeBracket = (idx: number) => {
    if (!cfg) return;
    const next = { ...cfg, brackets: cfg.brackets.filter((_, i) => i !== idx) };
    setCfg(next);
  };

  const save = async () => {
    if (!cfg || !companyId) return;
    try {
      setLoading(true);
      await supabase.from('payroll_settings' as any).upsert({ company_id: companyId, tax_config: cfg } as any);
      toast({ title: 'Saved', description: 'Payroll tax settings updated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Tax Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Configure SARS brackets, primary rebate, UIF cap, and SDL rate. These values drive PAYE, UIF and SDL calculations.</p>
        {loading && <div className="text-sm">Loading…</div>}
        {cfg && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Tax Brackets (annual)</div>
                {canEdit && <Button variant="outline" size="sm" onClick={addBracket}><Plus className="h-4 w-4 mr-2" />Add Bracket</Button>}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Up To (ZAR)</TableHead>
                    <TableHead>Rate (%)</TableHead>
                    <TableHead>Base (ZAR)</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cfg.brackets.map((b, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="w-40">
                        <Input
                          placeholder="e.g. 237100 or blank"
                          value={b.up_to === null ? '' : String(b.up_to)}
                          onChange={(e) => updateBracket(idx, 'up_to', e.target.value)}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell className="w-24">
                        <Input
                          placeholder="e.g. 18"
                          value={String(Math.round(b.rate * 10000) / 100)}
                          onChange={(e) => updateBracket(idx, 'rate', String(Number(e.target.value) / 100))}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell className="w-36">
                        <Input
                          placeholder="e.g. 0"
                          value={String(b.base)}
                          onChange={(e) => updateBracket(idx, 'base', e.target.value)}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell className="w-20 text-right">
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => removeBracket(idx)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Primary Rebate (annual)</Label>
                <Input
                  value={String(cfg.rebates?.primary ?? 0)}
                  onChange={(e) => setCfg({ ...cfg, rebates: { primary: Number(e.target.value) } })}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>UIF Cap (monthly)</Label>
                <Input
                  value={String(cfg.uif_cap ?? 17712)}
                  onChange={(e) => setCfg({ ...cfg, uif_cap: Number(e.target.value) })}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label>SDL Rate (%)</Label>
                <Input
                  value={String((cfg.sdl_rate ?? 0.01) * 100)}
                  onChange={(e) => setCfg({ ...cfg, sdl_rate: Number(e.target.value) / 100 })}
                  disabled={!canEdit}
                />
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={save} disabled={loading}><Check className="h-4 w-4 mr-2" />Save Settings</Button>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              PAYE is calculated by annualising the taxable income, applying the bracket formula (`base + rate * excess`), subtracting the annual rebate, and de-annualising to the period. UIF is 1% employee + 1% employer on gross up to the cap. SDL is employer at the configured rate.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EarningsTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>("");
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [type, setType] = useState<string>("basic_salary");
  const [hours, setHours] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [line, setLine] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: rs } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).order("period_start", { ascending: false });
      setRuns(rs || []);
      const emps = await getEmployees(companyId);
      setEmployees(emps as any);
    };
    if (companyId) load();
  }, [companyId]);

  const pickRun = async (id: string) => {
    setSelectedRun(id);
    setLine(null);
  };
  const pickEmp = async (id: string) => {
    setSelectedEmp(id);
    if (!selectedRun) return;
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", selectedRun).eq("employee_id", id).maybeSingle();
    setLine(data || null);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRun || !selectedEmp) { toast({ title: "Error", description: "Select run and employee", variant: "destructive" }); return; }
    await postEarnings({ pay_run_id: selectedRun, employee_id: selectedEmp, type: type as any, hours: hours ? parseFloat(hours) : null, rate: rate ? parseFloat(rate) : null, amount: amount ? parseFloat(amount) : null } as any);
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", selectedRun).eq("employee_id", selectedEmp).maybeSingle();
    setLine(data || null);
    toast({ title: "Success", description: "Earning captured" });
    setHours(""); setRate(""); setAmount("");
  };

  const remove = async (t: string) => {
    if (!selectedRun || !selectedEmp) return;
    await deleteEarnings(selectedRun, selectedEmp, t);
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", selectedRun).eq("employee_id", selectedEmp).maybeSingle();
    setLine(data || null);
  };

  const earnings = Array.isArray(line?.details?.earnings) ? line.details.earnings : [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Earnings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Pay Run</Label>
              <Select onValueChange={pickRun} value={selectedRun}>
                <SelectTrigger><SelectValue placeholder="Select run" /></SelectTrigger>
                <SelectContent>
                  {runs.map(r => <SelectItem key={r.id} value={r.id}>{new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select onValueChange={pickEmp} value={selectedEmp}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic_salary">Basic Salary</SelectItem>
                  <SelectItem value="overtime_1_5">Overtime (1.5x)</SelectItem>
                  <SelectItem value="overtime_2">Overtime (2x)</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="commission">Commission</SelectItem>
                  <SelectItem value="travel_allowance">Travel Allowance</SelectItem>
                  <SelectItem value="subsistence_allowance">Subsistence Allowance</SelectItem>
                  <SelectItem value="cellphone_allowance">Cellphone Allowance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Hours</Label>
              <Input type="number" step="0.01" value={hours} onChange={e => setHours(e.target.value)} />
            </div>
            <div>
              <Label>Rate</Label>
              <Input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} />
            </div>
            <div>
              <Label>Amount (optional)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          {canEdit && <Button type="submit" className="bg-gradient-primary">Add/Update</Button>}
        </form>

        <div className="mt-6">
          {!line ? (
            <div className="py-6 text-center text-muted-foreground">Select a run and employee</div>
          ) : earnings.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">No earnings</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="capitalize">{String(e.type).replace(/_/g, " ")}</TableCell>
                    <TableCell>R {(Number(e.amount || 0)).toFixed(2)}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => remove(e.type)}><Trash2 className="h-4 w-4 mr-2" />Remove</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeductionsTab({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedRun, setSelectedRun] = useState<string>("");
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [type, setType] = useState<string>("paye");
  const [amount, setAmount] = useState<string>("");
  const [line, setLine] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: rs } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).order("period_start", { ascending: false });
      setRuns(rs || []);
      const emps = await getEmployees(companyId);
      setEmployees(emps as any);
    };
    if (companyId) load();
  }, [companyId]);

  const pickRun = async (id: string) => { setSelectedRun(id); setLine(null); };
  const pickEmp = async (id: string) => {
    setSelectedEmp(id);
    if (!selectedRun) return;
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", selectedRun).eq("employee_id", id).maybeSingle();
    setLine(data || null);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRun || !selectedEmp) { toast({ title: "Error", description: "Select run and employee", variant: "destructive" }); return; }
    await postDeductions({ pay_run_id: selectedRun, employee_id: selectedEmp, type: type as any, amount: amount ? parseFloat(amount) : 0 } as any);
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", selectedRun).eq("employee_id", selectedEmp).maybeSingle();
    setLine(data || null);
    toast({ title: "Success", description: "Deduction captured" });
    setAmount("");
  };
  const remove = async (t: string) => {
    if (!selectedRun || !selectedEmp) return;
    await deleteDeductions(selectedRun, selectedEmp, t);
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", selectedRun).eq("employee_id", selectedEmp).maybeSingle();
    setLine(data || null);
  };
  const deductions = Array.isArray(line?.details?.deductions) ? line.details.deductions : [];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Deductions</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Pay Run</Label>
              <Select onValueChange={pickRun} value={selectedRun}>
                <SelectTrigger><SelectValue placeholder="Select run" /></SelectTrigger>
                <SelectContent>
                  {runs.map(r => <SelectItem key={r.id} value={r.id}>{new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employee</Label>
              <Select onValueChange={pickEmp} value={selectedEmp}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paye">PAYE</SelectItem>
                  <SelectItem value="uif_emp">UIF Employee</SelectItem>
                  <SelectItem value="medical_aid">Medical Aid</SelectItem>
                  <SelectItem value="pension_fund">Pension Fund</SelectItem>
                  <SelectItem value="retirement_annuity">Retirement Annuity</SelectItem>
                  <SelectItem value="union_fees">Union Fees</SelectItem>
                  <SelectItem value="garnishee">Garnishee</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          {canEdit && <Button type="submit" className="bg-gradient-primary">Add/Update</Button>}
        </form>

        <div className="mt-6">
          {!line ? (
            <div className="py-6 text-center text-muted-foreground">Select a run and employee</div>
          ) : deductions.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground">No deductions</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map((d: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="capitalize">{String(d.type).replace(/_/g, " ")}</TableCell>
                    <TableCell>R {(Number(d.amount || 0)).toFixed(2)}</TableCell>
                    <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => remove(d.type)}><Trash2 className="h-4 w-4 mr-2" />Remove</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SimplePayroll({ setTab, canEdit }: { setTab: (t: string) => void; canEdit: boolean }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Button className="justify-start" variant="outline" onClick={() => setTab("employees")}>
              <Users className="h-4 w-4 mr-2" /> Add Employee
            </Button>
            <Button className="justify-start" variant="outline" onClick={() => setTab("runs")}>
              <Calculator className="h-4 w-4 mr-2" /> Create Pay Run
            </Button>
            <Button className="justify-start" variant="outline" onClick={() => setTab("process")}>
              <FileText className="h-4 w-4 mr-2" /> Process Payroll
            </Button>
            <Button className="justify-start" variant="outline" onClick={() => setTab("payslip")}>
              <ArrowRight className="h-4 w-4 mr-2" /> Generate Payslips
            </Button>
            <Button className="justify-start" variant="outline" onClick={() => setTab("reports")}>
              <BarChart className="h-4 w-4 mr-2" /> View Reports
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Guided Workflow</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <p>Follow a simple, linear workflow similar to popular accounting apps.</p>
            <div className="flex gap-3">
              <Button onClick={() => setTab("employees")} className="bg-gradient-primary">
                <Users className="h-4 w-4 mr-2" /> Step 1: Employees
              </Button>
              <Button variant="outline" onClick={() => setTab("items")}>
                <Calculator className="h-4 w-4 mr-2" /> Step 2: Pay Items
              </Button>
              <Button variant="outline" onClick={() => setTab("periods")}>
                <FileText className="h-4 w-4 mr-2" /> Step 3: Select Period
              </Button>
              <Button variant="outline" onClick={() => setTab("process")}>
                <ArrowRight className="h-4 w-4 mr-2" /> Step 4: Run Payroll
              </Button>
              <Button variant="outline" onClick={() => setTab("payslip")}>
                <ArrowRight className="h-4 w-4 mr-2" /> Step 5: Payslip & Post
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
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

function PayrollDashboard({ companyId, setTab }: { companyId: string; setTab: (t: string) => void }) {
  const [totals, setTotals] = useState<{ employees: number; gross: number; paye: number; uif: number; sdl: number; overtime: number; net: number }>({ employees: 0, gross: 0, paye: 0, uif: 0, sdl: 0, overtime: 0, net: 0 });
  const [periodMode, setPeriodMode] = useState<'month' | 'year'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [trendData, setTrendData] = useState<Array<{ month: string; salary: number; uif: number; paye: number; sdl: number }>>([]);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    const h = () => setRefreshTick(v => v + 1);
    window.addEventListener('payroll-data-changed', h);
    return () => window.removeEventListener('payroll-data-changed', h);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: empRows, count: empCount } = await supabase
        .from("employees" as any)
        .select("id", { count: "exact" } as any)
        .eq("company_id", companyId);
      const { data: lines } = await supabase
        .from("pay_run_lines" as any)
        .select("gross, net, paye, uif_emp, uif_er, sdl_er, details")
        .in(
          "pay_run_id",
          (
            await supabase
              .from("pay_runs" as any)
              .select("id, period_start, period_end")
              .eq("company_id", companyId)
              .gte("period_start", new Date(selectedYear, periodMode === 'month' ? selectedMonth - 1 : 0, 1).toISOString().slice(0, 10))
              .lte("period_end", new Date(selectedYear, periodMode === 'month' ? selectedMonth : 12, 0).toISOString().slice(0, 10))
          ).data?.map((r: any) => r.id) || []
        );
      const gross = (lines || []).reduce((s, l: any) => s + (l.gross || 0), 0);
      const net = (lines || []).reduce((s, l: any) => s + (l.net || 0), 0);
      const paye = (lines || []).reduce((s, l: any) => s + (l.paye || 0), 0);
      const uif = (lines || []).reduce((s, l: any) => s + (l.uif_emp || 0) + (l.uif_er || 0), 0);
      const sdl = (lines || []).reduce((s, l: any) => s + (l.sdl_er || 0), 0);
      const overtime = (lines || []).reduce((s, l: any) => s + ((l.details?.overtime_amount) || 0), 0);
      const employeesTotal = (empCount ?? (empRows?.length || 0) ?? 0);
      setTotals({ employees: employeesTotal, gross, paye, uif, sdl, overtime, net });

      const needFallbackTotals = [gross, paye, uif, sdl, overtime].every(v => Number(v || 0) === 0);
      if (needFallbackTotals) {
        // Fallback logic kept as is...
        const monthsCount = periodMode === 'year' ? 12 : 6;
        const startBase = periodMode === 'year' ? 0 : (selectedMonth - monthsCount);
        const periodStart = new Date(selectedYear, startBase, 1).toISOString();
        const periodEnd = new Date(selectedYear, (periodMode === 'year' ? 12 : selectedMonth), 0, 23, 59, 59, 999).toISOString();
        const { data: accounts } = await supabase
          .from('chart_of_accounts' as any)
          .select('id, account_type, account_name, account_code')
          .eq('company_id', companyId)
          .eq('is_active', true);
        const typeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
        const nameById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_name || '').toLowerCase()]));
        const codeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_code || '')]));
        const { data: te } = await supabase
          .from('transaction_entries' as any)
          .select(`account_id, debit, credit, transactions!inner (transaction_date, company_id, status)`) 
          .eq('transactions.company_id', companyId)
          .eq('transactions.status', 'posted')
          .gte('transactions.transaction_date', periodStart)
          .lte('transactions.transaction_date', periodEnd);
        let g = 0, p = 0, u = 0, s = 0, ot = 0;
        (te || []).forEach((e: any) => {
          const id = String(e.account_id || '');
          const type = (typeById.get(id) || '').toLowerCase();
          const name = (nameById.get(id) || '').toLowerCase();
          const code = (codeById.get(id) || '');
          const debit = Number(e.debit || 0);
          const credit = Number(e.credit || 0);
          const naturalDebit = type === 'asset' || type === 'expense';
          const bal = naturalDebit ? (debit - credit) : (credit - debit);
          if (type.includes('expense') && (name.includes('salary') || name.includes('wage'))) g += Math.abs(bal);
          if (code.startsWith('2100') || name.includes('paye') || name.includes('pay as you earn')) p += Math.abs(bal);
          if (code.startsWith('2101') || name.includes('uif')) u += Math.abs(bal);
          if (code.startsWith('2102') || name.includes('sdl')) s += Math.abs(bal);
          if (name.includes('overtime')) ot += Math.abs(bal);
        });
        const netApprox = Math.max(0, g - p - (u / 2));
        setTotals({ employees: employeesTotal, gross: g, paye: p, uif: u, sdl: s, overtime: ot, net: netApprox });
      }

      // Trend data logic
      const monthsCount = periodMode === 'year' ? 12 : 6;
      const startBase = periodMode === 'year' ? 0 : (selectedMonth - monthsCount);
      const months: Array<{ start: Date; end: Date; label: string }> = [];
      for (let i = 0; i < monthsCount; i++) {
        const mIndex = (periodMode === 'year' ? i : startBase + i);
        const ms = new Date(selectedYear, mIndex, 1);
        const me = new Date(selectedYear, mIndex + 1, 0, 23, 59, 59, 999);
        const label = ms.toLocaleDateString('en-ZA', { month: 'short' });
        months.push({ start: ms, end: me, label });
      }
      const { data: runsRange } = await supabase
        .from('pay_runs' as any)
        .select('id, period_start, period_end')
        .eq('company_id', companyId)
        .gte('period_start', months[0].start.toISOString().slice(0,10))
        .lte('period_end', months[months.length - 1].end.toISOString().slice(0,10));
      const idByPeriod: Array<{ id: string; start: Date; end: Date }> = (runsRange || []).map((r: any) => ({ id: String(r.id), start: new Date(String(r.period_start)), end: new Date(String(r.period_end)) }));
      const bucketMap: Record<string, { salary: number; uif: number; paye: number; sdl: number }> = {};
      months.forEach(m => { bucketMap[m.label] = { salary: 0, uif: 0, paye: 0, sdl: 0 }; });
      for (const per of months) {
        const runIds = idByPeriod.filter(rr => rr.start >= per.start && rr.end <= per.end).map(rr => rr.id);
        if (runIds.length === 0) continue;
        const { data: lns } = await supabase
          .from('pay_run_lines' as any)
          .select('gross, paye, uif_emp, uif_er, sdl_er')
          .in('pay_run_id', runIds);
        const sGross = (lns || []).reduce((s, l: any) => s + Number(l.gross || 0), 0);
        const sPaye = (lns || []).reduce((s, l: any) => s + Number(l.paye || 0), 0);
        const sUif = (lns || []).reduce((s, l: any) => s + Number(l.uif_emp || 0) + Number(l.uif_er || 0), 0);
        const sSdl = (lns || []).reduce((s, l: any) => s + Number(l.sdl_er || 0), 0);
        bucketMap[per.label] = { salary: sGross, uif: sUif, paye: sPaye, sdl: sSdl };
      }
      const series = months.map(m => ({ month: m.label, ...bucketMap[m.label] }));
      setTrendData(series);
    };
    if (companyId) load();
  }, [companyId, selectedMonth, selectedYear, periodMode, refreshTick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
          <div className="font-medium text-sm text-muted-foreground">Period:</div>
          <Select value={periodMode} onValueChange={(v: any) => setPeriodMode(v)}>
            <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Select disabled={periodMode === 'year'} value={String(selectedMonth)} onValueChange={(v: any) => setSelectedMonth(parseInt(String(v)))}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }).map((_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{new Date(selectedYear, i, 1).toLocaleString('en-ZA', { month: 'long' })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="w-24 h-9" value={String(selectedYear)} onChange={(e) => setSelectedYear(parseInt(e.target.value || '0'))} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Total Employees" 
          value={totals.employees.toString()} 
          icon={<Users className="h-4 w-4" />}
          gradient="bg-blue-500/10"
          className="border-l-4 border-l-blue-500"
        />
        <MetricCard 
          title="Gross Pay" 
          value={`R ${totals.gross.toFixed(2)}`} 
          icon={<Wallet className="h-4 w-4" />}
          gradient="bg-green-500/10"
          className="border-l-4 border-l-green-500"
        />
        <MetricCard 
          title="Net Pay" 
          value={`R ${totals.net.toFixed(2)}`} 
          icon={<ArrowUpRight className="h-4 w-4" />}
          gradient="bg-emerald-500/10"
          className="border-l-4 border-l-emerald-500"
        />
        <MetricCard 
          title="PAYE Tax" 
          value={`R ${totals.paye.toFixed(2)}`} 
          icon={<Landmark className="h-4 w-4" />}
          gradient="bg-amber-500/10"
          className="border-l-4 border-l-amber-500"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <MetricCard 
          title="UIF Total" 
          value={`R ${totals.uif.toFixed(2)}`} 
          icon={<TrendingUp className="h-4 w-4" />}
          gradient="bg-purple-500/10"
          className="border-l-4 border-l-purple-500"
        />
        <MetricCard 
          title="SDL Total" 
          value={`R ${totals.sdl.toFixed(2)}`} 
          icon={<TrendingDown className="h-4 w-4" />}
          gradient="bg-pink-500/10"
          className="border-l-4 border-l-pink-500"
        />
         <MetricCard 
          title="Overtime" 
          value={`R ${totals.overtime.toFixed(2)}`} 
          icon={<Info className="h-4 w-4" />}
          gradient="bg-orange-500/10"
          className="border-l-4 border-l-orange-500"
        />
      </div>

      <Card className="shadow-sm border-muted">
        <CardHeader>
          <CardTitle>Payroll Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" dataKey="salary" stroke="#22c55e" name="Salary" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="uif" stroke="#ef4444" name="UIF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="paye" stroke="#f59e0b" name="PAYE" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sdl" stroke="#3b82f6" name="SDL" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
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
      if (data) { setSettings(data); setLoading(false); return; }
      const defaults = { company_id: companyId, tax_brackets: null, pension_rules: null, uif_percent: 1, sdl_percent: 1, overtime_rules: null, allowances: null } as any;
      await supabase.from("payroll_settings" as any).insert(defaults);
      setSettings(defaults);
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
  const load = useCallback(async () => {
    const { data } = await supabase.from("payroll_periods" as any).select("*").eq("company_id", companyId).order("start_date", { ascending: false });
    setPeriods(data || []);
  }, [companyId]);
  useEffect(() => { if (companyId) load(); }, [companyId, load]);
  const create = async (e: FormEvent) => {
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
  const [form, setForm] = useState({ employee_id: "", allowances: "", overtime: "", bonuses: "", travel_fixed: "", travel_reimb: "", medical_contrib: "", pension_contrib: "", extra_deductions: "" });
  const [defaults, setDefaults] = useState<any>({ basic: 0 });
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
  useEffect(() => {
    const loadDefaults = async () => {
      if (!form.employee_id) { setDefaults({ basic: 0 }); return; }
      const { data: basicItem } = await supabase
        .from("pay_items" as any)
        .select("id")
        .eq("company_id", companyId)
        .eq("name", "Basic Salary")
        .maybeSingle();
      const basicId = (basicItem as any)?.id;
      if (!basicId) { setDefaults({ basic: 0 }); return; }
      const { data: ep } = await supabase
        .from("employee_pay_items" as any)
        .select("amount")
        .eq("employee_id", form.employee_id)
        .eq("pay_item_id", basicId)
        .maybeSingle();
      const basic = ep ? Number((ep as any).amount || 0) : 0;
      setDefaults({ basic });
    };
    loadDefaults();
  }, [form.employee_id, companyId]);
  const ensureRun = async (): Promise<any> => {
    const p = periods.find((x: any) => x.id === period);
    if (!p) { toast({ title: "Error", description: "Select a period", variant: "destructive" }); return null; }
    const { data: existing } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).eq("period_start", p.start_date).eq("period_end", p.end_date).maybeSingle();
    if (existing) { setRun(existing); return existing; }
    const { data, error } = await supabase.from("pay_runs" as any).insert({ company_id: companyId, period_start: p.start_date, period_end: p.end_date, status: 'draft' } as any).select("*").single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    setRun(data); return data;
  };
  const computePAYE = (monthlyGross: number): number => {
    const annual = monthlyGross * 12;
    const brackets = [
      { upTo: 237100, base: 0, rate: 0.18, over: 0 },
      { upTo: 370500, base: 42678, rate: 0.26, over: 237100 },
      { upTo: 512800, base: 77362, rate: 0.31, over: 370500 },
      { upTo: 673000, base: 121475, rate: 0.36, over: 512800 },
      { upTo: 857900, base: 179147, rate: 0.39, over: 673000 },
      { upTo: 1817000, base: 251258, rate: 0.41, over: 857900 },
      { upTo: Infinity, base: 644489, rate: 0.45, over: 1817000 },
    ];
    let taxAnnual = 0;
    for (const b of brackets) {
      if (annual <= b.upTo) { taxAnnual = b.base + (annual - b.over) * b.rate; break; }
    }
    const rebateAnnual = 17235;
    const taxAfterRebate = Math.max(0, taxAnnual - rebateAnnual);
    return +(taxAfterRebate / 12).toFixed(2);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await ensureRun();
    if (!r) return;
    const allowances = parseFloat(form.allowances || "0");
    const overtime = parseFloat(form.overtime || "0");
    const bonuses = parseFloat(form.bonuses || "0");
    const travelFixed = parseFloat(form.travel_fixed || "0");
    const travelReimb = parseFloat(form.travel_reimb || "0");
    const extra = parseFloat(form.extra_deductions || "0");
    const medical = parseFloat(form.medical_contrib || "0");
    const pension = parseFloat(form.pension_contrib || "0");
    const basic = Number(defaults.basic || 0);
    const gross = +(basic + allowances + overtime + bonuses + travelFixed + travelReimb).toFixed(2);
    const taxableGross = +(gross - travelReimb).toFixed(2);
    const cap = 177.12;
    const uifEmpRaw = +(taxableGross * 0.01).toFixed(2);
    const uif_emp = Math.min(uifEmpRaw, cap);
    const uif_er = +(taxableGross * 0.01).toFixed(2);
    const sdl_er = +(taxableGross * 0.01).toFixed(2);
    const paye = computePAYE(taxableGross);
    const pensionCapPct = taxableGross * 0.275;
    const pensionCapMonthly = 350000 / 12;
    const pensionCapped = Math.min(pension, pensionCapPct, pensionCapMonthly);
    const medicalCapped = Math.max(0, medical);
    const net = +(gross - (paye + uif_emp + extra + pensionCapped + medicalCapped)).toFixed(2);
    const details = {
      earnings: [
        { name: "Basic Salary", amount: basic },
        { name: "Allowance", amount: allowances },
        { name: "Overtime", amount: overtime },
        { name: "Bonuses", amount: bonuses },
        { name: "Travel Allowance (Fixed)", amount: travelFixed },
        { name: "Travel Allowance (Reimbursive)", amount: travelReimb },
      ],
      deductions: [
        { name: "PAYE", amount: paye },
        { name: "UIF Employee", amount: uif_emp },
        { name: "Extra Deductions", amount: extra },
        { name: "Pension Employee", amount: pensionCapped },
        { name: "Medical Aid Employee", amount: medicalCapped },
      ],
      employer: [
        { name: "UIF Employer", amount: uif_er },
        { name: "SDL Employer", amount: sdl_er },
      ],
    };
    const payload = { pay_run_id: (r as any).id, employee_id: form.employee_id, gross, net, paye, uif_emp, uif_er, sdl_er, details } as any;
    const { error } = await supabase.from("pay_run_lines" as any).insert(payload as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Success", description: "Captured payroll for employee" });
    setForm({ employee_id: "", allowances: "", overtime: "", bonuses: "", travel_fixed: "", travel_reimb: "", medical_contrib: "", pension_contrib: "", extra_deductions: "" });
  };
  const processViaEngine = async () => {
    const p = periods.find((x: any) => x.id === period);
    if (!p) { toast({ title: "Error", description: "Select a period", variant: "destructive" }); return; }
    if (!form.employee_id) { toast({ title: "Error", description: "Select employee", variant: "destructive" }); return; }
    const r = await ensureRun();
    if (!r) return;
    const res = await postPayrollProcess({ company_id: companyId, employee_id: form.employee_id, period_start: (r as any).period_start, period_end: (r as any).period_end, pay_run_id: (r as any).id } as any);
    toast({ title: "Processed", description: `Gross R ${res.gross.toFixed(2)} | Net R ${res.net.toFixed(2)}` });
    await loadLines((r as any).id);
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
              <Label>Allowances</Label>
              <Input type="number" step="0.01" value={form.allowances} onChange={e => setForm({ ...form, allowances: e.target.value })} />
            </div>
            <div>
              <Label>Overtime</Label>
              <Input type="number" step="0.01" value={form.overtime} onChange={e => setForm({ ...form, overtime: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Bonuses</Label>
              <Input type="number" step="0.01" value={form.bonuses} onChange={e => setForm({ ...form, bonuses: e.target.value })} />
            </div>
            <div>
              <Label>Travel Allowance (Fixed)</Label>
              <Input type="number" step="0.01" value={form.travel_fixed} onChange={e => setForm({ ...form, travel_fixed: e.target.value })} />
            </div>
            <div>
              <Label>Travel Allowance (Reimbursive)</Label>
              <Input type="number" step="0.01" value={form.travel_reimb} onChange={e => setForm({ ...form, travel_reimb: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Medical Aid (Employee)</Label>
              <Input type="number" step="0.01" value={form.medical_contrib} onChange={e => setForm({ ...form, medical_contrib: e.target.value })} />
            </div>
            <div>
              <Label>Pension Fund (Employee)</Label>
              <Input type="number" step="0.01" value={form.pension_contrib} onChange={e => setForm({ ...form, pension_contrib: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Extra Deductions</Label>
              <Input type="number" step="0.01" value={form.extra_deductions} onChange={e => setForm({ ...form, extra_deductions: e.target.value })} />
            </div>
          </div>
          {canEdit && <Button type="submit" className="bg-gradient-primary">Capture</Button>}
          {canEdit && <Button type="button" className="ml-2" onClick={processViaEngine}>Process via Engine</Button>}
        </form>
      </CardContent>
    </Card>
  );
}

function PayslipPreview({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [run, setRun] = useState<any>(null);
  const [line, setLine] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonData, setJsonData] = useState<any>(null);
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
      .eq('id', companyId)
      .maybeSingle();
    const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
    const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
    if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
    const periodName = `${new Date(run.period_start).toLocaleDateString('en-ZA')} - ${new Date(run.period_end).toLocaleDateString('en-ZA')}`;
    doc.save(`payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`);
  };
  const viewJSON = async () => {
    if (!run || !line) return;
    const data = await postPayrollPayslip(run.id, line.employee_id);
    setJsonData(data);
    setJsonOpen(true);
  };
  const postToLedger = async () => {
    if (!run || !line) return;
    const paye = Number(line.paye || 0);
    const uifEmp = Number(line.uif_emp || 0);
    const uifEr = Number(line.uif_er || 0);
    const sdlEr = Number(line.sdl_er || 0);
    const gross = Number(line.gross || 0);
    const net = Number(line.net || 0);
    const postDate = new Date().toISOString().slice(0, 10);
    const ensureAccount = async (nm: string, tp: 'expense' | 'liability', code: string) => {
      const { data: found }: any = await supabase.from('chart_of_accounts' as any).select('id').eq('company_id', companyId).eq('account_name', nm).maybeSingle();
      if ((found as any)?.id) return (found as any).id as string;
      const { data }: any = await supabase.from('chart_of_accounts' as any).insert({ company_id: companyId, account_code: code, account_name: nm, account_type: tp, is_active: true } as any).select('id').single();
      return (data as any).id as string;
    };
    const salaryExp = await ensureAccount('Salary Expense', 'expense', '6000-SAL');
    const uifExp = await ensureAccount('Employer UIF Expense', 'expense', '6000-UIF-EXP');
    const sdlExp = await ensureAccount('Employer SDL Expense', 'expense', '6000-SDL-EXP');
    const netPayable = await ensureAccount('Net Salaries Payable', 'liability', '2100-NET');
    const payePayable = await ensureAccount('PAYE Payable', 'liability', '2100-PAYE');
    const uifPayable = await ensureAccount('UIF Payable', 'liability', '2100-UIF');
    const sdlPayable = await ensureAccount('SDL Payable', 'liability', '2100-SDL');
    const { data: { user } } = await supabase.auth.getUser();
    const basePayload: any = { company_id: companyId, user_id: user?.id || '', transaction_date: postDate, description: `Payroll posting ${new Date(run.period_start).toLocaleDateString()} - ${new Date(run.period_end).toLocaleDateString()}`, total_amount: gross, status: 'pending' };
    let txRes: any = null;
    let txErr: any = null;
    try {
      const res = await supabase
        .from('transactions' as any)
        .insert({ ...basePayload, transaction_type: 'payroll' } as any)
        .select('id')
        .single();
      txRes = res.data; txErr = res.error;
      if (txErr) throw txErr;
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      const retry = msg.includes('column') && msg.includes('does not exist');
      if (!retry) throw err;
      const res2 = await supabase
        .from('transactions' as any)
        .insert(basePayload as any)
        .select('id')
        .single();
      txRes = res2.data; txErr = res2.error;
    }
    if (txErr) { return; }
    const rows = [
      { transaction_id: (txRes as any).id, account_id: salaryExp, debit: gross, credit: 0, description: 'Salary Expense', status: 'approved' },
      { transaction_id: (txRes as any).id, account_id: uifExp, debit: uifEr, credit: 0, description: 'Employer UIF Expense', status: 'approved' },
      { transaction_id: (txRes as any).id, account_id: sdlExp, debit: sdlEr, credit: 0, description: 'Employer SDL Expense', status: 'approved' },
      { transaction_id: (txRes as any).id, account_id: netPayable, debit: 0, credit: net, description: 'Net Salaries Payable', status: 'approved' },
      { transaction_id: (txRes as any).id, account_id: payePayable, debit: 0, credit: paye, description: 'PAYE Payable', status: 'approved' },
      { transaction_id: (txRes as any).id, account_id: uifPayable, debit: 0, credit: uifEmp + uifEr, description: 'UIF Payable', status: 'approved' },
      { transaction_id: (txRes as any).id, account_id: sdlPayable, debit: 0, credit: sdlEr, description: 'SDL Payable', status: 'approved' },
    ];
    const { error: teErr } = await supabase.from('transaction_entries' as any).insert(rows as any);
    if (teErr) { return; }
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: (txRes as any).id, description: r.description }));
    await supabase.from('ledger_entries' as any).insert(ledgerRows as any);
    await supabase.from('transactions' as any).update({ status: 'posted' } as any).eq('id', (txRes as any).id);
    toast({ title: 'Success', description: 'Payroll posted to ledger' });
  };
  return (
    <>
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
            {runs.length && lines.length ? (
              <Button variant="outline" className="ml-2" onClick={async () => {
                if (!run) return;
                const { data: company } = await supabase
                  .from('companies')
                  .select('name,email,phone,address,tax_number,vat_number,logo_url')
                  .eq('id', companyId)
                  .maybeSingle();
                const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
                for (const l of lines) {
                  const emp = employees.find(e => e.id === l.employee_id);
                  const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : l.employee_id;
                  const slip: PayslipForPDF = { period_start: run.period_start, period_end: run.period_end, employee_name, gross: l.gross, net: l.net, paye: l.paye, uif_emp: l.uif_emp, uif_er: l.uif_er, sdl_er: l.sdl_er, details: null };
                  const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
                  if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
                  const blob = doc.output('blob');
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const periodName = `${new Date(run.period_start).toLocaleDateString('en-ZA')} - ${new Date(run.period_end).toLocaleDateString('en-ZA')}`;
                  a.href = url;
                  a.download = `payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }}>Download All</Button>
            ) : null}
            <Button variant="outline" className="ml-2" onClick={viewJSON}>View JSON</Button>
            <Button className="ml-2 bg-gradient-primary" onClick={postToLedger}>Post to Ledger</Button>
          </div>
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payslip JSON</DialogTitle></DialogHeader>
          <pre className="text-xs whitespace-pre-wrap">{jsonData ? JSON.stringify(jsonData, null, 2) : ""}</pre>
          <DialogFooter><Button variant="outline" onClick={() => setJsonOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PayrollReports({ companyId }: { companyId: string }) {
  const [month, setMonth] = useState<string>("");
  const [runs, setRuns] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [emp201, setEmp201] = useState<any>(null);
  const [emp501, setEmp501] = useState<any>(null);
  const [irp5, setIrp5] = useState<any>(null);
  const [employeeForIrp5, setEmployeeForIrp5] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
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
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Button variant="outline" onClick={async () => {
              if (!runs.length) return;
              const r = runs[0];
              const res = await getReportsEmp201(companyId, r.period_start, r.period_end);
              setEmp201(res);
            }}>Get EMP201 (current selection)</Button>
            <Button variant="outline" onClick={async () => {
              const yearStart = new Date(new Date().getFullYear(), 2, 1).toISOString().split('T')[0];
              const yearEnd = new Date(new Date().getFullYear()+1, 1, 28).toISOString().split('T')[0];
              const res = await getReportsEmp501(companyId, yearStart, yearEnd);
              setEmp501(res);
            }}>Get EMP501 (current tax year)</Button>
            <div className="flex items-end gap-2">
              <div className="w-full">
                <Label>Employee for IRP5</Label>
                <Select value={employeeForIrp5} onValueChange={(v: any) => setEmployeeForIrp5(v)}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={async () => {
                if (!runs.length || !employeeForIrp5) return;
                const r = runs[0];
                const yearStart = new Date(new Date().getFullYear(), 2, 1).toISOString().split('T')[0];
                const yearEnd = new Date(new Date().getFullYear()+1, 1, 28).toISOString().split('T')[0];
                const res = await getReportsIrp5(companyId, employeeForIrp5, yearStart, yearEnd);
                setIrp5(res);
              }}>Get IRP5</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardHeader><CardTitle>EMP201</CardTitle></CardHeader><CardContent><pre className="text-xs whitespace-pre-wrap">{emp201 ? JSON.stringify(emp201, null, 2) : ""}</pre></CardContent></Card>
            <Card><CardHeader><CardTitle>EMP501</CardTitle></CardHeader><CardContent><pre className="text-xs whitespace-pre-wrap">{emp501 ? JSON.stringify(emp501, null, 2) : ""}</pre></CardContent></Card>
            <Card><CardHeader><CardTitle>IRP5</CardTitle></CardHeader><CardContent><pre className="text-xs whitespace-pre-wrap">{irp5 ? JSON.stringify(irp5, null, 2) : ""}</pre></CardContent></Card>
          </div>
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
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", id_number: "", start_date: "", salary_type: "monthly", salary_amount: "", bank_name: "", bank_branch_code: "", bank_account_number: "", bank_account_type: "checking" });

  const load = React.useCallback(async () => {
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
  }, [companyId, toast]);
  useEffect(() => { if (companyId) load(); }, [companyId, load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    try {
      let insertedEmp: any = null;
      try {
        const res = await supabase.from("employees" as any).insert({
          company_id: companyId,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          id_number: form.id_number || null,
          start_date: form.start_date || null,
          salary_type: form.salary_type || null,
          bank_name: form.bank_name || null,
          bank_branch_code: form.bank_branch_code || null,
          bank_account_number: form.bank_account_number || null,
          bank_account_type: form.bank_account_type || null,
          active: true,
        } as any).select("id").single();
        if (res.error) throw res.error;
        insertedEmp = res.data;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        const retry = msg.includes("column") && msg.includes("does not exist");
        if (!retry) throw err;
        const res2 = await supabase.from("employees" as any).insert({
          company_id: companyId,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || null,
          id_number: form.id_number || null,
          start_date: form.start_date || null,
          salary_type: form.salary_type || null,
          active: true,
        } as any).select("id").single();
        if (res2.error) throw res2.error;
        insertedEmp = res2.data;
      }
      const empId = (insertedEmp as any)?.id;
      if (empId) {
        const ensureAccount = async (nm: string, tp: 'expense' | 'liability', code: string) => {
          const { data: found }: any = await supabase
            .from('chart_of_accounts' as any)
            .select('id')
            .eq('company_id', companyId)
            .eq('account_name', nm)
            .maybeSingle();
          if ((found as any)?.id) return (found as any).id as string;
          const { data }: any = await supabase
            .from('chart_of_accounts' as any)
            .insert({ company_id: companyId, account_code: code, account_name: nm, account_type: tp, is_active: true } as any)
            .select('id')
            .single();
          return (data as any).id as string;
        };
        await ensureAccount('Salary Expense', 'expense', '6000-SAL');
        await ensureAccount('Employer UIF Expense', 'expense', '6000-UIF-EXP');
        await ensureAccount('Employer SDL Expense', 'expense', '6000-SDL-EXP');
        await ensureAccount('Net Salaries Payable', 'liability', '2100-NET');
        await ensureAccount('PAYE Payable', 'liability', '2100-PAYE');
        await ensureAccount('UIF Payable', 'liability', '2100-UIF');
        await ensureAccount('SDL Payable', 'liability', '2100-SDL');
        const saItems = [
          { name: "Basic Salary", type: "earning" },
          { name: "Allowance", type: "earning" },
          { name: "Overtime", type: "earning" },
          { name: "Bonus", type: "earning" },
          { name: "Commission", type: "earning" },
          { name: "Travel Allowance (Fixed)", type: "earning" },
          { name: "Travel Allowance (Reimbursive)", type: "earning" },
          { name: "PAYE", type: "deduction" },
          { name: "UIF Employee", type: "deduction" },
          { name: "UIF Employer", type: "employer" },
          { name: "SDL Employer", type: "employer" },
          { name: "Medical Aid Employee", type: "deduction" },
          { name: "Medical Aid Employer", type: "employer" },
          { name: "Pension Employee", type: "deduction" },
          { name: "Pension Employer", type: "employer" },
        ];
        const { data: existing } = await supabase
          .from("pay_items" as any)
          .select("id,name,type")
          .eq("company_id", companyId);
        const map = new Map<string, any>();
        (existing || []).forEach((i: any) => map.set(String(i.name).toLowerCase(), i));
        const toInsert: any[] = [];
        for (const it of saItems) {
          const key = it.name.toLowerCase();
          const taxable = it.type === "earning" && !it.name.toLowerCase().includes("reimbursive");
          if (!map.has(key)) toInsert.push({ company_id: companyId, code: it.name.replace(/\s+/g, "_").toUpperCase(), name: it.name, type: it.type, taxable });
        }
        if (toInsert.length) await supabase.from("pay_items" as any).insert(toInsert as any);
        const { data: allItems } = await supabase
          .from("pay_items" as any)
          .select("id,name,type")
          .eq("company_id", companyId);
        const byName = new Map<string, any>();
        (allItems || []).forEach((i: any) => byName.set(String(i.name).toLowerCase(), i));
        const basic = byName.get("basic salary");
        const allowance = byName.get("allowance");
        const overtime = byName.get("overtime");
        const bonusItem = byName.get("bonus");
        const commissionItem = byName.get("commission");
        const travelFixed = byName.get("travel allowance (fixed)");
        const travelReimb = byName.get("travel allowance (reimbursive)");
        const paye = byName.get("paye");
        const uifEmp = byName.get("uif employee");
        const uifEr = byName.get("uif employer");
        const sdlEr = byName.get("sdl employer");
        const rows: any[] = [];
        const basicAmt = parseFloat(form.salary_amount || "0");
        if (basic) rows.push({ employee_id: empId, pay_item_id: basic.id, amount: basicAmt, rate: null, unit: null });
        if (allowance) rows.push({ employee_id: empId, pay_item_id: allowance.id, amount: 0, rate: null, unit: null });
        if (overtime) rows.push({ employee_id: empId, pay_item_id: overtime.id, amount: 0, rate: null, unit: "hour" });
        if (bonusItem) rows.push({ employee_id: empId, pay_item_id: bonusItem.id, amount: 0, rate: null, unit: null });
        if (commissionItem) rows.push({ employee_id: empId, pay_item_id: commissionItem.id, amount: 0, rate: null, unit: null });
        if (travelFixed) rows.push({ employee_id: empId, pay_item_id: travelFixed.id, amount: 0, rate: null, unit: null });
        if (travelReimb) rows.push({ employee_id: empId, pay_item_id: travelReimb.id, amount: 0, rate: null, unit: null });
        if (paye) rows.push({ employee_id: empId, pay_item_id: paye.id, amount: 0, rate: null, unit: null });
        if (uifEmp) rows.push({ employee_id: empId, pay_item_id: uifEmp.id, amount: 0, rate: null, unit: null });
        if (uifEr) rows.push({ employee_id: empId, pay_item_id: uifEr.id, amount: 0, rate: null, unit: null });
        if (sdlEr) rows.push({ employee_id: empId, pay_item_id: sdlEr.id, amount: 0, rate: null, unit: null });
        if (rows.length) await supabase.from("employee_pay_items" as any).insert(rows as any);
      }
      toast({ title: "Success", description: "Employee created" });
      setDialogOpen(false);
      setForm({ first_name: "", last_name: "", email: "", id_number: "", start_date: "", salary_type: "monthly", salary_amount: "", bank_name: "", bank_branch_code: "", bank_account_number: "", bank_account_type: "checking" });
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
                <TableHead>Salary Type</TableHead>
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
                <TableCell>{e.salary_type || "-"}</TableCell>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Salary Type</Label>
                <Select value={form.salary_type} onValueChange={(v: any) => setForm({ ...form, salary_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Salary Amount</Label>
                <Input type="number" step="0.01" value={form.salary_amount} onChange={e => setForm({ ...form, salary_amount: e.target.value })} />
              </div>
              <div>
                <Label>Bank Name</Label>
                <Select value={form.bank_name} onValueChange={(v: any) => setForm({ ...form, bank_name: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABSA">ABSA Bank</SelectItem>
                    <SelectItem value="FNB">FNB (First National Bank)</SelectItem>
                    <SelectItem value="Standard Bank">Standard Bank</SelectItem>
                    <SelectItem value="Nedbank">Nedbank</SelectItem>
                    <SelectItem value="Capitec">Capitec Bank</SelectItem>
                    <SelectItem value="Investec">Investec Bank</SelectItem>
                    <SelectItem value="TymeBank">TymeBank</SelectItem>
                    <SelectItem value="Bidvest">Bidvest Bank</SelectItem>
                    <SelectItem value="Discovery">Discovery Bank</SelectItem>
                    <SelectItem value="African Bank">African Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Branch Code</Label>
                <Input value={form.bank_branch_code} onChange={e => setForm({ ...form, bank_branch_code: e.target.value })} />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Account Type</Label>
              <Select value={form.bank_account_type} onValueChange={(v: any) => setForm({ ...form, bank_account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
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

  const load = React.useCallback(async () => {
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
  }, [companyId, toast]);
  useEffect(() => { if (companyId) load(); }, [companyId, load]);

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

  

  const loadRuns = React.useCallback(async () => {
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
  }, [companyId, toast]);

  const loadEmployees = React.useCallback(async () => {
    const { data } = await supabase.from("employees" as any).select("*").eq("company_id", companyId).order("first_name", { ascending: true });
    setEmployees((data || []) as any);
  }, [companyId]);

  const loadLines = React.useCallback(async (runId: string) => {
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", runId);
    setLines((data || []) as any);
  }, []);

  useEffect(() => { if (companyId) { loadRuns(); loadEmployees(); } }, [companyId, loadRuns, loadEmployees]);

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
    window.dispatchEvent(new Event('payroll-data-changed'));
    loadRuns();
  };

  const payNetWages = async () => {
    if (!selectedRun) return;
    const { error } = await supabase.rpc("post_pay_run_pay", { _pay_run_id: selectedRun.id, _amount: totals.net });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Success", description: "Net wages paid" });
    window.dispatchEvent(new Event('payroll-data-changed'));
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
    window.dispatchEvent(new Event('payroll-data-changed'));
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
      .eq('id', companyId)
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
        .eq('id', companyId)
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
function RunPayrollWizard({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [step, setStep] = useState<number>(1);
  const [frequency, setFrequency] = useState<string>("monthly");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [run, setRun] = useState<any>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editRate, setEditRate] = useState<string>("");
  const [entries, setEntries] = useState<Record<string, { allowance: string; overtime: string }>>({});
  const [lines, setLines] = useState<any[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("employees" as any).select("*").eq("company_id", companyId).order("first_name", { ascending: true });
      setEmployees((data || []) as any);
    };
    if (companyId) load();
  }, [companyId]);
  const ensureRun = async () => {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);
    const { data: existing } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).eq("period_start", start).eq("period_end", end).maybeSingle();
    if (existing) { setRun(existing); return existing; }
    const { data, error } = await supabase.from("pay_runs" as any).insert({ company_id: companyId, period_start: start, period_end: end, status: "draft" } as any).select("*").single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    setRun(data); return data;
  };
  const openEdit = async (emp: Employee) => {
    setEditEmp(emp);
    const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
    const basicId = (basicItem as any)?.id;
    if (!basicId) { setEditRate("0"); setEditOpen(true); return; }
    const { data: ep } = await supabase.from("employee_pay_items" as any).select("amount").eq("employee_id", emp.id).eq("pay_item_id", basicId).maybeSingle();
    const amt = ep ? Number((ep as any).amount || 0) : 0;
    setEditRate(String(amt));
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!editEmp) return;
    const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
    const basicId = (basicItem as any)?.id;
    if (!basicId) {
      const { data } = await supabase.from("pay_items" as any).insert({ company_id: companyId, code: "BASIC_SALARY", name: "Basic Salary", type: "earning", taxable: true } as any).select("id").single();
      const newId = (data as any)?.id;
      if (!newId) return;
      await supabase.from("employee_pay_items" as any).insert({ employee_id: editEmp.id, pay_item_id: newId, amount: parseFloat(editRate || "0"), rate: null, unit: null } as any);
    } else {
      const { data: ep } = await supabase.from("employee_pay_items" as any).select("id").eq("employee_id", editEmp.id).eq("pay_item_id", basicId).maybeSingle();
      if (ep) {
        await supabase.from("employee_pay_items" as any).update({ amount: parseFloat(editRate || "0") } as any).eq("id", (ep as any).id);
      } else {
        await supabase.from("employee_pay_items" as any).insert({ employee_id: editEmp.id, pay_item_id: basicId, amount: parseFloat(editRate || "0"), rate: null, unit: null } as any);
      }
    }
    setEditOpen(false);
  };
  const computePAYE = (monthlyGross: number): number => {
    const annual = monthlyGross * 12;
    const brackets = [
      { upTo: 237100, base: 0, rate: 0.18, over: 0 },
      { upTo: 370500, base: 42678, rate: 0.26, over: 237100 },
      { upTo: 512800, base: 77362, rate: 0.31, over: 370500 },
      { upTo: 673000, base: 121475, rate: 0.36, over: 512800 },
      { upTo: 857900, base: 179147, rate: 0.39, over: 673000 },
      { upTo: 1817000, base: 251258, rate: 0.41, over: 857900 },
      { upTo: Infinity, base: 644489, rate: 0.45, over: 1817000 },
    ];
    let taxAnnual = 0;
    for (const b of brackets) { if (annual <= b.upTo) { taxAnnual = b.base + (annual - b.over) * b.rate; break; } }
    const rebateAnnual = 17235;
    const taxAfterRebate = Math.max(0, taxAnnual - rebateAnnual);
    return +(taxAfterRebate / 12).toFixed(2);
  };
  const processAll = async () => {
    const r = await ensureRun();
    if (!r) return;
    const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
    const basicId = (basicItem as any)?.id;
    const basics: Record<string, number> = {};
    if (basicId) {
      const { data: all } = await supabase.from("employee_pay_items" as any).select("employee_id, amount").in("employee_id", employees.map(e => e.id)).eq("pay_item_id", basicId);
      (all || []).forEach((row: any) => { basics[row.employee_id] = Number(row.amount || 0); });
    }
    for (const e of employees) {
      const basic = basics[e.id] || 0;
      const allowance = parseFloat(entries[e.id]?.allowance || "0");
      const overtime = parseFloat(entries[e.id]?.overtime || "0");
      const gross = +(basic + allowance + overtime).toFixed(2);
      const uifCapMonthly = 177.12;
      const uifEmpRaw = +(gross * 0.01).toFixed(2);
      const uif_emp = Math.min(uifEmpRaw, uifCapMonthly);
      const uif_er = +(gross * 0.01).toFixed(2);
      const sdl_er = +(gross * 0.01).toFixed(2);
      const paye = computePAYE(gross);
      const net = +(gross - paye - uif_emp).toFixed(2);
      const payload = { pay_run_id: (r as any).id, employee_id: e.id, gross, net, paye, uif_emp, uif_er, sdl_er } as any;
      const { data: existing } = await supabase.from("pay_run_lines" as any).select("id").eq("pay_run_id", (r as any).id).eq("employee_id", e.id).maybeSingle();
      if (existing) { await supabase.from("pay_run_lines" as any).update(payload as any).eq("id", (existing as any).id); } else { await supabase.from("pay_run_lines" as any).insert(payload as any); }
    }
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", (r as any).id);
    setLines((data || []) as any);
    toast({ title: "Processed", description: "Calculations updated" });
  };
  const loadLinesLocal = React.useCallback(async () => {
    if (!run) return;
    const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", (run as any).id);
    setLines((data || []) as any);
  }, [run?.id]);
  useEffect(() => { loadLinesLocal(); }, [run?.id, loadLinesLocal]);
  const totals = useMemo(() => ({
    gross: lines.reduce((s, l: any) => s + (l.gross || 0), 0),
    paye: lines.reduce((s, l: any) => s + (l.paye || 0), 0),
    uif: lines.reduce((s, l: any) => s + (l.uif_emp || 0) + (l.uif_er || 0), 0),
    sdl: lines.reduce((s, l: any) => s + (l.sdl_er || 0), 0),
    net: lines.reduce((s, l: any) => s + (l.net || 0), 0),
  }), [lines]);
  const ensureAccountByCode = async (nm: string, tp: 'asset' | 'liability' | 'equity' | 'income' | 'expense', code: string) => {
    const { data: found } = await supabase.from('chart_of_accounts' as any).select('id').eq('company_id', companyId).eq('account_code', code).maybeSingle();
    if ((found as any)?.id) return (found as any).id as string;
    const { data } = await supabase.from('chart_of_accounts' as any).insert({ company_id: companyId, account_code: code, account_name: nm, account_type: tp, is_active: true } as any).select('id').single();
    return (data as any).id as string;
  };
  const postRunJournal = async () => {
    if (!run || lines.length === 0) return;
    const paye = totals.paye;
    const uifEmp = lines.reduce((s, l: any) => s + (l.uif_emp || 0), 0);
    const uifEr = lines.reduce((s, l: any) => s + (l.uif_er || 0), 0);
    const sdlEr = totals.sdl;
    const gross = totals.gross;
    const net = totals.net;
    const postDate = new Date().toISOString().slice(0, 10);
    const salaryExp = await ensureAccountByCode('Salary Expense', 'expense', '6020');
    const uifExp = await ensureAccountByCode('Employer UIF Expense', 'expense', '6021');
    const sdlExp = await ensureAccountByCode('Employer SDL Expense', 'expense', '6022');
    const netPayable = await ensureAccountByCode('Net Salaries Payable', 'liability', '2100-NET');
    const payePayable = await ensureAccountByCode('PAYE Payable', 'liability', '2100-PAYE');
    const uifPayable = await ensureAccountByCode('UIF Payable', 'liability', '2100-UIF');
    const sdlPayable = await ensureAccountByCode('SDL Payable', 'liability', '2100-SDL');
    const benefitsPayable = await ensureAccountByCode('Employee Benefits Payable', 'liability', '2100-BEN');
    const benefitsTotal = 0;
    const { data: { user } } = await supabase.auth.getUser();
    const basePayload: any = { company_id: companyId, user_id: user?.id || '', transaction_date: postDate, description: `Payroll posting ${new Date(run.period_start).toLocaleDateString()} - ${new Date(run.period_end).toLocaleDateString()}`, total_amount: gross, status: 'pending', transaction_type: 'payroll' };
    const { data: tx } = await supabase.from('transactions' as any).insert(basePayload as any).select('id').single();
    const txId = (tx as any)?.id;
    if (!txId) return;
    const rows = [
      { transaction_id: txId, account_id: salaryExp, debit: gross, credit: 0, description: 'Salary Expense', status: 'approved' },
      { transaction_id: txId, account_id: uifExp, debit: uifEr, credit: 0, description: 'Employer UIF Expense', status: 'approved' },
      { transaction_id: txId, account_id: sdlExp, debit: sdlEr, credit: 0, description: 'Employer SDL Expense', status: 'approved' },
      { transaction_id: txId, account_id: netPayable, debit: 0, credit: net, description: 'Net Salaries Payable', status: 'approved' },
      { transaction_id: txId, account_id: payePayable, debit: 0, credit: paye, description: 'PAYE Payable', status: 'approved' },
      { transaction_id: txId, account_id: uifPayable, debit: 0, credit: uifEmp + uifEr, description: 'UIF Payable', status: 'approved' },
      { transaction_id: txId, account_id: sdlPayable, debit: 0, credit: sdlEr, description: 'SDL Payable', status: 'approved' },
      { transaction_id: txId, account_id: benefitsPayable, debit: 0, credit: benefitsTotal, description: 'Employee Benefits Payable', status: 'approved' },
    ];
    await supabase.from('transaction_entries' as any).insert(rows as any);
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: txId, description: r.description }));
    await supabase.from('ledger_entries' as any).insert(ledgerRows as any);
    await supabase.from('transactions' as any).update({ status: 'posted' } as any).eq('id', txId);
    toast({ title: 'Posted', description: 'Payroll journal posted' });
    window.dispatchEvent(new Event('payroll-data-changed'));
  };
  const pickCompanyBank = async (): Promise<string | null> => {
    const { data } = await supabase.from('bank_accounts' as any).select('id').eq('company_id', companyId).order('account_name');
    const b = (data || [])[0] as any;
    return b ? String(b.id) : null;
  };
  const postEmployeePayments = async () => {
    const bankId = await pickCompanyBank();
    if (!bankId || lines.length === 0) { toast({ title: 'Bank', description: 'No bank account or lines' }); return; }
    const net = totals.net;
    const postDate = new Date().toISOString().slice(0, 10);
    const bankLedger = await ensureAccountByCode('Bank', 'asset', '1000');
    const netPayable = await ensureAccountByCode('Net Salaries Payable', 'liability', '2100-NET');
    const { data: { user } } = await supabase.auth.getUser();
    const base: any = { company_id: companyId, user_id: user?.id || '', transaction_date: postDate, description: 'Employees payment', total_amount: net, status: 'pending', transaction_type: 'payment' };
    const { data: tx } = await supabase.from('transactions' as any).insert({ ...base, bank_account_id: bankId } as any).select('id').single();
    const txId = (tx as any)?.id; if (!txId) return;
    const rows = [
      { transaction_id: txId, account_id: netPayable, debit: net, credit: 0, description: 'Net Salaries Payable', status: 'approved' },
      { transaction_id: txId, account_id: bankLedger, debit: 0, credit: net, description: 'Bank', status: 'approved' },
    ];
    await supabase.from('transaction_entries' as any).insert(rows as any);
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: txId, description: r.description }));
    await supabase.from('ledger_entries' as any).insert(ledgerRows as any);
    await supabase.from('transactions' as any).update({ status: 'posted' } as any).eq('id', txId);
    toast({ title: 'Paid', description: 'Employees payment posted' });
    window.dispatchEvent(new Event('payroll-data-changed'));
  };
  const postSarsPayment = async () => {
    const bankId = await pickCompanyBank();
    if (!bankId || lines.length === 0) { toast({ title: 'Bank', description: 'No bank account or lines' }); return; }
    const paye = totals.paye;
    const uif = lines.reduce((s, l: any) => s + (l.uif_emp || 0) + (l.uif_er || 0), 0);
    const sdl = totals.sdl;
    const total = paye + uif + sdl;
    const postDate = new Date().toISOString().slice(0, 10);
    const bankLedger = await ensureAccountByCode('Bank', 'asset', '1000');
    const payePayable = await ensureAccountByCode('PAYE Payable', 'liability', '2100-PAYE');
    const uifPayable = await ensureAccountByCode('UIF Payable', 'liability', '2100-UIF');
    const sdlPayable = await ensureAccountByCode('SDL Payable', 'liability', '2100-SDL');
    const { data: { user } } = await supabase.auth.getUser();
    const base: any = { company_id: companyId, user_id: user?.id || '', transaction_date: postDate, description: 'SARS payment', total_amount: total, status: 'pending', transaction_type: 'payment' };
    const { data: tx } = await supabase.from('transactions' as any).insert({ ...base, bank_account_id: bankId } as any).select('id').single();
    const txId = (tx as any)?.id; if (!txId) return;
    const rows = [
      { transaction_id: txId, account_id: payePayable, debit: paye, credit: 0, description: 'PAYE Payable', status: 'approved' },
      { transaction_id: txId, account_id: uifPayable, debit: uif, credit: 0, description: 'UIF Payable', status: 'approved' },
      { transaction_id: txId, account_id: sdlPayable, debit: sdl, credit: 0, description: 'SDL Payable', status: 'approved' },
      { transaction_id: txId, account_id: bankLedger, debit: 0, credit: total, description: 'Bank', status: 'approved' },
    ];
    await supabase.from('transaction_entries' as any).insert(rows as any);
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: txId, description: r.description }));
    await supabase.from('ledger_entries' as any).insert(ledgerRows as any);
    await supabase.from('transactions' as any).update({ status: 'posted' } as any).eq('id', txId);
    toast({ title: 'Paid', description: 'SARS payment posted' });
    window.dispatchEvent(new Event('payroll-data-changed'));
  };
  const postBenefitsPayment = async () => {
    const bankId = await pickCompanyBank();
    if (!bankId) { toast({ title: 'Bank', description: 'No bank account' }); return; }
    const total = 0;
    if (total <= 0) { toast({ title: 'No Benefits', description: 'No benefits payable' }); return; }
    const postDate = new Date().toISOString().slice(0, 10);
    const bankLedger = await ensureAccountByCode('Bank', 'asset', '1000');
    const benefitsPayable = await ensureAccountByCode('Employee Benefits Payable', 'liability', '2100-BEN');
    const { data: { user } } = await supabase.auth.getUser();
    const base: any = { company_id: companyId, user_id: user?.id || '', transaction_date: postDate, description: 'Benefits payment', total_amount: total, status: 'pending', transaction_type: 'payment' };
    const { data: tx } = await supabase.from('transactions' as any).insert({ ...base, bank_account_id: bankId } as any).select('id').single();
    const txId = (tx as any)?.id; if (!txId) return;
    const rows = [
      { transaction_id: txId, account_id: benefitsPayable, debit: total, credit: 0, description: 'Employee Benefits Payable', status: 'approved' },
      { transaction_id: txId, account_id: bankLedger, debit: 0, credit: total, description: 'Bank', status: 'approved' },
    ];
    await supabase.from('transaction_entries' as any).insert(rows as any);
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: txId, description: r.description }));
    await supabase.from('ledger_entries' as any).insert(ledgerRows as any);
    await supabase.from('transactions' as any).update({ status: 'posted' } as any).eq('id', txId);
    toast({ title: 'Paid', description: 'Benefits payment posted' });
  };
  const finalizePosting = async () => {
    if (!run) return;
    const { error } = await supabase.rpc("post_pay_run_finalize", { _pay_run_id: (run as any).id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Posted", description: "General ledger posting completed" });
  };
  const downloadAll = async () => {
    if (!run) return;
    const { data: company } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .eq('id', companyId)
      .maybeSingle();
    const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
    for (const l of lines) {
      const emp = employees.find(e => e.id === l.employee_id);
      const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : l.employee_id;
      const slip: PayslipForPDF = { period_start: run.period_start, period_end: run.period_end, employee_name, gross: l.gross, net: l.net, paye: l.paye, uif_emp: l.uif_emp, uif_er: l.uif_er, sdl_er: l.sdl_er, details: null };
      const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
      if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const periodName = `${new Date(run.period_start).toLocaleDateString('en-ZA')} - ${new Date(run.period_end).toLocaleDateString('en-ZA')}`;
      a.href = url;
      a.download = `payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Run Payroll</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <Badge variant="secondary">Running payroll for {new Date(year, month - 1, 1).toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}</Badge>
          {run && <Badge variant="outline" className="capitalize">Status: {String(run.status || 'draft')}</Badge>}
        </div>
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnight">Fortnight</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Year</Label>
                <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value || '0'))} />
              </div>
              <div>
                <Label>Month</Label>
                <Input type="number" value={month} onChange={e => setMonth(parseInt(e.target.value || '0'))} />
              </div>
            </div>
            <Button className="bg-gradient-primary" onClick={async () => { const r = await ensureRun(); if (r) setStep(2); }}>Next</Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Salary Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{e.first_name} {e.last_name}</TableCell>
                    <TableCell>{e.salary_type || '-'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openEdit(e)}>Edit Rate</Button>
                    </TableCell>
                    <TableCell>{e.active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button className="bg-gradient-primary" onClick={() => setStep(3)}>Next</Button>
            </div>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Rate</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Label>Basic Salary</Label>
                  <Input type="number" step="0.01" value={editRate} onChange={e => setEditRate(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={saveEdit}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic Salary</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>UIF</TableHead>
                  <TableHead>PAYE</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(e => {
                  const entry = entries[e.id] || { allowance: "", overtime: "" };
                  const line = lines.find(l => l.employee_id === e.id);
                  const basic = line ? `R ${Number(line.gross || 0).toFixed(2)}` : "-";
                  const paye = line ? `R ${Number(line.paye || 0).toFixed(2)}` : "-";
                  const uif = line ? `R ${(Number(line.uif_emp || 0) + Number(line.uif_er || 0)).toFixed(2)}` : "-";
                  const net = line ? `R ${Number(line.net || 0).toFixed(2)}` : "-";
                  return (
                    <TableRow key={e.id}>
                      <TableCell>{e.first_name} {e.last_name}</TableCell>
                      <TableCell>{basic}</TableCell>
                      <TableCell>
                        <Input className="w-28" type="number" step="0.01" value={entry.overtime} onChange={ev => setEntries({ ...entries, [e.id]: { ...entry, overtime: ev.target.value } })} />
                      </TableCell>
                      <TableCell>
                        <Input className="w-28" type="number" step="0.01" value={entry.allowance} onChange={ev => setEntries({ ...entries, [e.id]: { ...entry, allowance: ev.target.value } })} />
                      </TableCell>
                      <TableCell>{uif}</TableCell>
                      <TableCell>{paye}</TableCell>
                      <TableCell>{net}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button className="bg-gradient-primary" onClick={processAll}>Process All</Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Gross Pay" value={`R ${totals.gross.toFixed(2)}`} />
              <StatCard title="PAYE" value={`R ${totals.paye.toFixed(2)}`} />
              <StatCard title="UIF" value={`R ${totals.uif.toFixed(2)}`} />
              <StatCard title="SDL" value={`R ${totals.sdl.toFixed(2)}`} />
              <StatCard title="Net Pay" value={`R ${totals.net.toFixed(2)}`} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button className="bg-gradient-primary" onClick={() => setStep(5)}>Next</Button>
            </div>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadAll}>Download PDF</Button>
              <Button variant="outline" onClick={() => toast({ title: 'Email', description: 'Compose emails via payslips list' })}>Email Payslips</Button>
              <Button className="bg-gradient-primary" onClick={finalizePosting}>Post to General Ledger</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeesSimple({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pageEmp, setPageEmp] = useState(0);
  const pageSizeEmp = 7;
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    id_number: "",
    start_date: "",
    position: "",
    department: "",
    payroll_number: "",
    tax_number: "",
    salary_type: "monthly",
    salary_amount: "",
    bank_name: "",
    bank_branch_code: "",
    bank_account_number: "",
    bank_account_type: "checking",
    paye_registered: false,
    uif_registered: false,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editRate, setEditRate] = useState<string>("");
  const ensureCurrentRun = async () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("pay_runs" as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("period_start", start)
      .eq("period_end", end)
      .maybeSingle();
    if (existing) return existing as any;
    const { data, error } = await supabase
      .from("pay_runs" as any)
      .insert({ company_id: companyId, period_start: start, period_end: end, status: "draft" } as any)
      .select("*")
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return null; }
    return data as any;
  };
  const computePAYE = (monthlyGross: number): number => {
    const annual = monthlyGross * 12;
    const brackets = [
      { upTo: 237100, base: 0, rate: 0.18, over: 0 },
      { upTo: 370500, base: 42678, rate: 0.26, over: 237100 },
      { upTo: 512800, base: 77362, rate: 0.31, over: 370500 },
      { upTo: 673000, base: 121475, rate: 0.36, over: 512800 },
      { upTo: 857900, base: 179147, rate: 0.39, over: 673000 },
      { upTo: 1817000, base: 251258, rate: 0.41, over: 857900 },
      { upTo: Infinity, base: 644489, rate: 0.45, over: 1817000 },
    ];
    let taxAnnual = 0;
    for (const b of brackets) { if (annual <= b.upTo) { taxAnnual = b.base + (annual - b.over) * b.rate; break; } }
    const rebateAnnual = 17235;
    const taxAfterRebate = Math.max(0, taxAnnual - rebateAnnual);
    return +(taxAfterRebate / 12).toFixed(2);
  };
  const getBasicSalary = async (empId: string): Promise<number> => {
    const { data: basicItem } = await supabase
      .from("pay_items" as any)
      .select("id")
      .eq("company_id", companyId)
      .eq("name", "Basic Salary")
      .maybeSingle();
    const basicId = (basicItem as any)?.id;
    if (!basicId) return 0;
    const { data: ep } = await supabase
      .from("employee_pay_items" as any)
      .select("amount")
      .eq("employee_id", empId)
      .eq("pay_item_id", basicId)
      .maybeSingle();
    return ep ? Number((ep as any).amount || 0) : 0;
  };
  const runPayrollForEmployee = async (empId: string) => {
    const run = await ensureCurrentRun();
    if (!run) return;
    const gross = +(await getBasicSalary(empId)).toFixed(2);
    const uifCapMonthly = 177.12;
    const uifEmpRaw = +(gross * 0.01).toFixed(2);
    const uif_emp = Math.min(uifEmpRaw, uifCapMonthly);
    const uif_er = +(gross * 0.01).toFixed(2);
    const sdl_er = +(gross * 0.01).toFixed(2);
    const paye = computePAYE(gross);
    const net = +(gross - paye - uif_emp).toFixed(2);
    const payload = { pay_run_id: (run as any).id, employee_id: empId, gross, net, paye, uif_emp, uif_er, sdl_er } as any;
    const { data: existing } = await supabase
      .from("pay_run_lines" as any)
      .select("id")
      .eq("pay_run_id", (run as any).id)
      .eq("employee_id", empId)
      .maybeSingle();
    if (existing) {
      await supabase.from("pay_run_lines" as any).update(payload as any).eq("id", (existing as any).id);
    } else {
      await supabase.from("pay_run_lines" as any).insert(payload as any);
    }
    toast({ title: "Processed", description: "Payroll calculated for employee" });
  };
  const processSelected = async () => {
    const ids = Object.entries(selected).filter(([_, v]) => v).map(([id]) => id);
    if (ids.length === 0) { toast({ title: "Select Employees", description: "Choose employees to process in bulk" }); return; }
    const run = await ensureCurrentRun();
    if (!run) return;
    for (const id of ids) { await runPayrollForEmployee(id); }
    toast({ title: "Processed", description: "Bulk payroll completed" });
  };
  const downloadPayslipForEmployee = async (empId: string) => {
    const { data: runs } = await supabase
      .from("pay_runs" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("period_start", { ascending: false });
    const run = (runs || [])[0];
    if (!run) { toast({ title: "No Run", description: "Create a pay run first" }); return; }
    const { data: l } = await supabase
      .from("pay_run_lines" as any)
      .select("*")
      .eq("pay_run_id", (run as any).id)
      .eq("employee_id", empId)
      .maybeSingle();
    if (!l) { toast({ title: "No Payslip", description: "Employee not processed in current run" }); return; }
    const emp = employees.find(e => e.id === empId);
    const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : empId;
    const slip: PayslipForPDF = {
      period_start: (run as any).period_start,
      period_end: (run as any).period_end,
      employee_name,
      gross: (l as any).gross,
      net: (l as any).net,
      paye: (l as any).paye,
      uif_emp: (l as any).uif_emp,
      uif_er: (l as any).uif_er,
      sdl_er: (l as any).sdl_er,
      details: null,
    };
    const { data: company } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .eq('id', companyId)
      .maybeSingle();
    const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
    const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
    if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
    const periodName = `${new Date((run as any).period_start).toLocaleDateString('en-ZA')} - ${new Date((run as any).period_end).toLocaleDateString('en-ZA')}`;
    doc.save(`payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`);
  };
  const downloadPayslipForEmployeePeriod = async (empId: string) => {
    const start = new Date(filterYear, filterMonth - 1, 1).toISOString().slice(0, 10);
    const end = new Date(filterYear, filterMonth, 0).toISOString().slice(0, 10);
    const { data: run } = await supabase
      .from("pay_runs" as any)
      .select("*")
      .eq("company_id", companyId)
      .eq("period_start", start)
      .eq("period_end", end)
      .maybeSingle();
    if (!run) { toast({ title: "No Run", description: "No payroll run for selected period" }); return; }
    const { data: l } = await supabase
      .from("pay_run_lines" as any)
      .select("*")
      .eq("pay_run_id", (run as any).id)
      .eq("employee_id", empId)
      .maybeSingle();
    if (!l) { toast({ title: "No Payslip", description: "Employee not processed in selected run" }); return; }
    const emp = employees.find(e => e.id === empId);
    const employee_name = emp ? `${emp.first_name} ${emp.last_name}` : empId;
    const slip: PayslipForPDF = {
      period_start: (run as any).period_start,
      period_end: (run as any).period_end,
      employee_name,
      gross: (l as any).gross,
      net: (l as any).net,
      paye: (l as any).paye,
      uif_emp: (l as any).uif_emp,
      uif_er: (l as any).uif_er,
      sdl_er: (l as any).sdl_er,
      details: null,
    };
    const { data: company } = await supabase
      .from('companies')
      .select('name,email,phone,address,tax_number,vat_number,logo_url')
      .eq('id', companyId)
      .maybeSingle();
    const doc = buildPayslipPDF(slip, (company as any) || { name: 'Company' });
    const logoDataUrl = await fetchLogoDataUrl((company as any)?.logo_url);
    if (logoDataUrl) addLogoToPDF(doc, logoDataUrl);
    const periodName = `${new Date((run as any).period_start).toLocaleDateString('en-ZA')} - ${new Date((run as any).period_end).toLocaleDateString('en-ZA')}`;
    doc.save(`payslip_${employee_name.replace(/\s+/g,'_')}_${periodName.replace(/\s+/g,'_')}.pdf`);
  };
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("employees" as any).select("*").eq("company_id", companyId).order("first_name", { ascending: true });
      setEmployees((data || []) as any); setLoading(false);
    };
    if (companyId) load();
  }, [companyId]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    let emp: any = null;
    try {
      const res = await supabase.from("employees" as any).insert({
        company_id: companyId,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        id_number: form.id_number || null,
        start_date: form.start_date || null,
        position: form.position || null,
        payroll_number: form.payroll_number || null,
        tax_number: form.tax_number || null,
        salary_type: form.salary_type,
        bank_name: form.bank_name || null,
        bank_branch_code: form.bank_branch_code || null,
        bank_account_number: form.bank_account_number || null,
        bank_account_type: form.bank_account_type || null,
        paye_registered: form.paye_registered,
        uif_registered: form.uif_registered,
        active: true,
      } as any).select("id").single();
      if (res.error) throw res.error;
      emp = res.data;
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const retry = msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find"));
      if (!retry) { toast({ title: "Error", description: err.message, variant: "destructive" }); return; }
      const res2 = await supabase.from("employees" as any).insert({
        company_id: companyId,
        first_name: form.first_name,
        last_name: form.last_name,
        id_number: form.id_number || null,
        salary_type: form.salary_type,
        active: true,
      } as any).select("id").single();
      if (res2.error) { toast({ title: "Error", description: res2.error.message, variant: "destructive" }); return; }
      emp = res2.data;
    }
    // Persist extended employee details in a separate table when available
    try {
      await (supabase as any)
        .from('employee_details')
        .upsert({ employee_id: (emp as any).id, department: form.department || null, address: form.address || null });
    } catch {}
    const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
    let basicId = (basicItem as any)?.id;
    if (!basicId) { const { data } = await supabase.from("pay_items" as any).insert({ company_id: companyId, code: "BASIC_SALARY", name: "Basic Salary", type: "earning", taxable: true } as any).select("id").single(); basicId = (data as any)?.id; }
    if (basicId) await supabase.from("employee_pay_items" as any).insert({ employee_id: (emp as any).id, pay_item_id: basicId, amount: parseFloat(form.salary_amount || "0"), rate: null, unit: null } as any);
    toast({ title: "Success", description: "Employee added" });
    setDialogOpen(false);
    setForm({ first_name: "", last_name: "", email: "", phone: "", address: "", id_number: "", start_date: "", position: "", department: "", payroll_number: "", tax_number: "", salary_type: "monthly", salary_amount: "", bank_name: "", bank_branch_code: "", bank_account_number: "", bank_account_type: "checking", paye_registered: false, uif_registered: false });
    const { data } = await supabase.from("employees" as any).select("*").eq("company_id", companyId);
    setEmployees((data || []) as any);
  };
  const importCSV = async (file: File) => {
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    rows.shift();
    for (const row of rows) {
      const cols = row.split(",");
      const [first_name, last_name, id_number, salary_type, salary_amount] = cols;
      const { data: emp } = await supabase.from("employees" as any).insert({ company_id: companyId, first_name, last_name, id_number, salary_type, active: true } as any).select("id").single();
      const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
      const basicId = (basicItem as any)?.id;
      if (basicId && (emp as any)?.id) await supabase.from("employee_pay_items" as any).insert({ employee_id: (emp as any).id, pay_item_id: basicId, amount: parseFloat(salary_amount || "0"), rate: null, unit: null } as any);
    }
    const { data } = await supabase.from("employees" as any).select("*").eq("company_id", companyId);
    setEmployees((data || []) as any);
    toast({ title: "Imported", description: "CSV imported" });
  };
  const openEdit = async (emp: Employee) => {
    setEditEmp(emp);
    const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
    const basicId = (basicItem as any)?.id;
    if (!basicId) { setEditRate("0"); setEditOpen(true); return; }
    const { data: ep } = await supabase.from("employee_pay_items" as any).select("amount").eq("employee_id", emp.id).eq("pay_item_id", basicId).maybeSingle();
    const amt = ep ? Number((ep as any).amount || 0) : 0;
    setEditRate(String(amt));
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!editEmp) return;
    const { data: basicItem } = await supabase.from("pay_items" as any).select("id").eq("company_id", companyId).eq("name", "Basic Salary").maybeSingle();
    const basicId = (basicItem as any)?.id;
    if (!basicId) {
      const { data } = await supabase.from("pay_items" as any).insert({ company_id: companyId, code: "BASIC_SALARY", name: "Basic Salary", type: "earning", taxable: true } as any).select("id").single();
      const newId = (data as any)?.id;
      if (!newId) { setEditOpen(false); return; }
      await supabase.from("employee_pay_items" as any).insert({ employee_id: editEmp.id, pay_item_id: newId, amount: parseFloat(editRate || "0"), rate: null, unit: null } as any);
    } else {
      const { data: ep } = await supabase.from("employee_pay_items" as any).select("id").eq("employee_id", editEmp.id).eq("pay_item_id", basicId).maybeSingle();
      if (ep) {
        await supabase.from("employee_pay_items" as any).update({ amount: parseFloat(editRate || "0") } as any).eq("id", (ep as any).id);
      } else {
        await supabase.from("employee_pay_items" as any).insert({ employee_id: editEmp.id, pay_item_id: basicId, amount: parseFloat(editRate || "0"), rate: null, unit: null } as any);
      }
    }
    setEditOpen(false);
    toast({ title: "Saved", description: "Employee rate updated" });
  };
  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Employees</CardTitle>
          <div className="flex gap-2">
            {canEdit && <Button onClick={() => setDialogOpen(true)} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-2" />Add Employee</Button>}
            {canEdit && <Button variant="outline" onClick={() => document.getElementById('empCsvInput')?.click()}>CSV Import</Button>}
            <div className="flex items-center gap-2">
              <Label>Year</Label>
              <Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value || '0'))} />
              <Label>Month</Label>
              <Input type="number" className="w-20" value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value || '0'))} />
            </div>
            <input id="empCsvInput" type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f); }} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (<div className="py-8 text-center text-muted-foreground">Loading…</div>) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Salary Type</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>PAYE registered?</TableHead>
                  <TableHead>UIF registered?</TableHead>
                  <TableHead className="w-64">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.slice(pageEmp * pageSizeEmp, pageEmp * pageSizeEmp + pageSizeEmp).map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Checkbox checked={!!selected[e.id]} onCheckedChange={(v: any) => setSelected(prev => ({ ...prev, [e.id]: !!v }))} />
                    </TableCell>
                    <TableCell>{e.first_name} {e.last_name}</TableCell>
                    <TableCell>{(e as any).position || '-'}</TableCell>
                    <TableCell>{e.id_number || '-'}</TableCell>
                    <TableCell>{e.salary_type || '-'}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>{(e as any).paye_registered ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{(e as any).uif_registered ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openEdit(e)}>Edit</Button>
                      <Button size="sm" variant="outline" className="ml-2" onClick={() => downloadPayslipForEmployeePeriod(e.id)}>Payslip</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm text-muted-foreground">Page {pageEmp + 1} of {Math.max(1, Math.ceil(employees.length / pageSizeEmp))}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={pageEmp === 0} onClick={() => setPageEmp(p => Math.max(0, p - 1))}>Previous</Button>
                <Button variant="outline" disabled={(pageEmp + 1) >= Math.ceil(employees.length / pageSizeEmp)} onClick={() => setPageEmp(p => p + 1)}>Next</Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>ID Number</Label><Input value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} /></div>
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Position</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
              <div><Label>Department</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>Payroll #</Label><Input value={form.payroll_number} onChange={e => setForm({ ...form, payroll_number: e.target.value })} /></div>
              <div><Label>Tax Number</Label><Input value={form.tax_number} onChange={e => setForm({ ...form, tax_number: e.target.value })} /></div>
              <div><Label>Salary Type</Label>
                <Select value={form.salary_type} onValueChange={(v: any) => setForm({ ...form, salary_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Rate</Label><Input type="number" step="0.01" value={form.salary_amount} onChange={e => setForm({ ...form, salary_amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>PAYE Registered?</Label>
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, paye_registered: !form.paye_registered })}>{form.paye_registered ? 'Yes' : 'No'}</Button>
              </div>
              <div>
                <Label>UIF Registered?</Label>
                <Button type="button" variant="outline" onClick={() => setForm({ ...form, uif_registered: !form.uif_registered })}>{form.uif_registered ? 'Yes' : 'No'}</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Bank Name</Label>
                <Select value={form.bank_name} onValueChange={(v: any) => setForm({ ...form, bank_name: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABSA">ABSA Bank</SelectItem>
                    <SelectItem value="FNB">FNB (First National Bank)</SelectItem>
                    <SelectItem value="Standard Bank">Standard Bank</SelectItem>
                    <SelectItem value="Nedbank">Nedbank</SelectItem>
                    <SelectItem value="Capitec">Capitec Bank</SelectItem>
                    <SelectItem value="Investec">Investec Bank</SelectItem>
                    <SelectItem value="TymeBank">TymeBank</SelectItem>
                    <SelectItem value="Bidvest">Bidvest Bank</SelectItem>
                    <SelectItem value="Discovery">Discovery Bank</SelectItem>
                    <SelectItem value="African Bank">African Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Branch Code</Label><Input value={form.bank_branch_code} onChange={e => setForm({ ...form, bank_branch_code: e.target.value })} /></div>
              <div><Label>Account Number</Label><Input value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} /></div>
            </div>
            <div>
              <Label>Account Type</Label>
              <Select value={form.bank_account_type} onValueChange={(v: any) => setForm({ ...form, bank_account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-gradient-primary">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Rate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Basic Salary</Label>
            <Input type="number" step="0.01" value={editRate} onChange={e => setEditRate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PayItemsSimple({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const [earnings, setEarnings] = useState<PayItem[]>([]);
  const [deductions, setDeductions] = useState<PayItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; type: "earning" | "deduction"; taxable: boolean }>({ name: "", type: "earning", taxable: true });
  const load = async () => {
    const { data } = await supabase.from("pay_items" as any).select("id,code,name,type,taxable").eq("company_id", companyId).order("name", { ascending: true });
    const list = (data || []) as any[];
    setEarnings(list.filter(i => i.type === 'earning'));
    setDeductions(list.filter(i => i.type === 'deduction'));
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);
  const ensureDefaults = async () => {
    const defaults = [
      { code: 'SALARY', name: 'Salary', type: 'earning', taxable: true },
      { code: 'OVERTIME', name: 'Overtime', type: 'earning', taxable: true },
      { code: 'BONUS', name: 'Bonus', type: 'earning', taxable: true },
      { code: 'ALLOWANCE', name: 'Allowances', type: 'earning', taxable: true },
      { code: 'PAYE', name: 'PAYE', type: 'deduction', taxable: false },
      { code: 'UIF', name: 'UIF', type: 'deduction', taxable: false },
      { code: 'SDL', name: 'SDL', type: 'deduction', taxable: false },
      { code: 'GARNISHEE', name: 'Garnishees', type: 'deduction', taxable: false },
    ];
    const { data: existing } = await supabase.from("pay_items" as any).select("name").eq("company_id", companyId);
    const names = new Set((existing || []).map((x: any) => String(x.name).toLowerCase()));
    const toInsert = defaults.filter(d => !names.has(d.name.toLowerCase())).map(d => ({ company_id: companyId, code: d.code, name: d.name, type: d.type, taxable: d.taxable }));
    if (toInsert.length) await supabase.from("pay_items" as any).insert(toInsert as any);
    await load();
    toast({ title: 'Ready', description: 'Default items ensured' });
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.name.replace(/\s+/g, '_').toUpperCase();
    const { error } = await supabase.from("pay_items" as any).insert({ company_id: companyId, code, name: form.name, type: form.type, taxable: form.taxable } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setDialogOpen(false); setForm({ name: '', type: 'earning', taxable: true });
    await load();
    toast({ title: 'Created', description: 'Custom pay item added' });
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Earnings</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Taxable</TableHead></TableRow></TableHeader>
            <TableBody>
              {earnings.map(e => (<TableRow key={e.id}><TableCell>{e.name}</TableCell><TableCell>{e.taxable ? 'Yes' : 'No'}</TableCell></TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Deductions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Taxable</TableHead></TableRow></TableHeader>
            <TableBody>
              {deductions.map(d => (<TableRow key={d.id}><TableCell>{d.name}</TableCell><TableCell>{d.taxable ? 'Yes' : 'No'}</TableCell></TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader className="flex items-center justify-between"><CardTitle>Manage</CardTitle>{canEdit && <div className="flex gap-2"><Button onClick={ensureDefaults}>Ensure Defaults</Button><Button variant="outline" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Custom Pay Item</Button></div>}</CardHeader>
        <CardContent></CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Pay Item</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earning">Earning</SelectItem>
                    <SelectItem value="deduction">Deduction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Taxable</Label><Button type="button" variant="outline" onClick={() => setForm({ ...form, taxable: !form.taxable })}>{form.taxable ? 'Yes' : 'No'}</Button></div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayrollHistory({ companyId }: { companyId: string }) {
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [viewRun, setViewRun] = useState<PayRun | null>(null);
  const [runLines, setRunLines] = useState<any[]>([]);
  const [pageRuns, setPageRuns] = useState(0);
  const pageSizeRuns = 7;
  const [pageLines, setPageLines] = useState(0);
  const pageSizeLines = 7;
  useEffect(() => { const load = async () => { const { data } = await supabase.from("pay_runs" as any).select("*").eq("company_id", companyId).order("period_start", { ascending: false }); setRuns((data || []) as any); }; if (companyId) load(); }, [companyId]);
  const openView = async (r: PayRun) => { setViewRun(r); const { data } = await supabase.from("pay_run_lines" as any).select("*").eq("pay_run_id", r.id); setRunLines((data || []) as any); };
  const totals = useMemo(() => ({ count: runLines.length, net: runLines.reduce((s, l: any) => s + (l.net || 0), 0) }), [runLines]);
  return (
    <div>
      <Table>
        <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Employees</TableHead><TableHead>Status</TableHead><TableHead>Total Net Pay</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {runs.slice(pageRuns * pageSizeRuns, pageRuns * pageSizeRuns + pageSizeRuns).map(r => (
            <TableRow key={r.id}>
              <TableCell>{new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}</TableCell>
              <TableCell>-</TableCell>
              <TableCell className="capitalize">{r.status}</TableCell>
              <TableCell>-</TableCell>
              <TableCell><Button size="sm" variant="outline" onClick={() => openView(r)}>View</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-muted-foreground">Page {pageRuns + 1} of {Math.max(1, Math.ceil(runs.length / pageSizeRuns))}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={pageRuns === 0} onClick={() => setPageRuns(p => Math.max(0, p - 1))}>Previous</Button>
          <Button variant="outline" disabled={(pageRuns + 1) >= Math.ceil(runs.length / pageSizeRuns)} onClick={() => setPageRuns(p => p + 1)}>Next</Button>
        </div>
      </div>
      <Dialog open={!!viewRun} onOpenChange={(o) => { if (!o) { setViewRun(null); setRunLines([]); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payroll Summary</DialogTitle></DialogHeader>
          {viewRun && (
            <div className="space-y-4">
              <div>{new Date(viewRun.period_start).toLocaleDateString()} - {new Date(viewRun.period_end).toLocaleDateString()}</div>
              <div className="grid grid-cols-3 gap-3">
                <StatCard title="Employees" value={`${totals.count}`} />
                <StatCard title="Net Pay" value={`R ${totals.net.toFixed(2)}`} />
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="text-right">Net</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {runLines.slice(pageLines * pageSizeLines, pageLines * pageSizeLines + pageSizeLines).map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.employee_id}</TableCell>
                      <TableCell className="text-right">R {Number(l.net || 0).toFixed(2)}</TableCell>
                      <TableCell><Button size="sm" variant="outline">Payslip</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-sm text-muted-foreground">Page {pageLines + 1} of {Math.max(1, Math.ceil(runLines.length / pageSizeLines))}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={pageLines === 0} onClick={() => setPageLines(p => Math.max(0, p - 1))}>Previous</Button>
                  <Button variant="outline" disabled={(pageLines + 1) >= Math.ceil(runLines.length / pageSizeLines)} onClick={() => setPageLines(p => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function PayrollPostingModule({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openPostDlg, setOpenPostDlg] = useState(false);
  const [openPaySalaryDlg, setOpenPaySalaryDlg] = useState(false);
  const [openPaySarsDlg, setOpenPaySarsDlg] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [postValues, setPostValues] = useState<{ gross: number; uif_er: number; sdl_er: number; paye: number; uif_emp: number; net: number }>({ gross: 0, uif_er: 0, sdl_er: 0, paye: 0, uif_emp: 0, net: 0 });
  const [paySalaryValues, setPaySalaryValues] = useState<{ net: number; bankId: string }>({ net: 0, bankId: "" });
  const [paySarsValues, setPaySarsValues] = useState<{ paye: number; sdl: number; uif_total: number; bankId: string }>({ paye: 0, sdl: 0, uif_total: 0, bankId: "" });
  const [bankId, setBankId] = useState<string>("");
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; account_name: string; bank_name?: string; account_number?: string }>>([]);
  const [linesByEmp, setLinesByEmp] = useState<Record<string, any>>({});
  const [currentRun, setCurrentRun] = useState<any>(null);
  const [currentRunId, setCurrentRunId] = useState<string>("");
  useEffect(() => {
    const load = async () => {
      const { data: emps } = await supabase.from('employees' as any).select('*').eq('company_id', companyId).order('first_name');
      setEmployees((emps || []) as any);
      const { data: run } = await supabase
        .from('pay_runs' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (run) {
        const { data: ls } = await supabase.from('pay_run_lines' as any).select('*').eq('pay_run_id', (run as any).id);
        const map: Record<string, any> = {};
        (ls || []).forEach((l: any) => { map[l.employee_id] = l; });
        setLinesByEmp(map);
        setCurrentRun(run);
        setCurrentRunId(String((run as any).id || ''));
      }
      const { data: banks } = await supabase.from('bank_accounts' as any).select('id, account_name, bank_name, account_number').eq('company_id', companyId).order('account_name');
      setBankAccounts((banks || []) as any);
      setBankId(((banks || [])[0] as any)?.id || "");
    };
    load();
  }, [companyId]);
  const getEffectiveCompanyId = useCallback(async (): Promise<string> => {
    let cid = String(companyId || '').trim();
    if (cid) return cid;
    if (!hasSupabaseEnv) return '';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from('profiles' as any)
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();
        cid = String((prof as any)?.company_id || '').trim();
      }
    } catch {}
    return cid;
  }, [companyId]);
  const ensureAccountByCode = async (nm: string, tp: 'asset' | 'liability' | 'equity' | 'income' | 'expense', code: string) => {
    const cid = await getEffectiveCompanyId();
    if (!cid) throw new Error('Company ID missing');
    const { data: found } = await supabase.from('chart_of_accounts' as any).select('id').eq('company_id', cid).eq('account_code', code).maybeSingle();
    if ((found as any)?.id) return (found as any).id as string;
    const { data } = await supabase.from('chart_of_accounts' as any).insert({ company_id: cid, account_code: code, account_name: nm, account_type: tp, is_active: true } as any).select('id').single();
    return (data as any).id as string;
  };
  const openPostFor = async (empId: string) => {
    const l = linesByEmp[empId];
    if (!l) { toast({ title: 'No Line', description: 'Run payroll first' }); return; }
    const gross = Number(l.gross || 0);
    const paye = Number(l.paye || 0);
    const uif_emp = Number(l.uif_emp || 0);
    const uif_er = Number(l.uif_er || 0);
    const sdl_er = Number(l.sdl_er || 0);
    const net = Number(l.net || 0);
    setSelectedEmpId(empId);
    setPostValues({ gross, uif_er, sdl_er, paye, uif_emp, net });
    setOpenPostDlg(true);
  };
  const openPayFor = async (empId: string) => {
    const l = linesByEmp[empId];
    if (!l) { toast({ title: 'No Line', description: 'Run payroll first' }); return; }
    setSelectedEmpId(empId);
    setPaySalaryValues({ net: Number(l.net || 0), bankId });
    setOpenPaySalaryDlg(true);
  };
  const openPaySarsFor = async (empId: string) => {
    const l = linesByEmp[empId];
    if (!l) { toast({ title: 'No Line', description: 'Run payroll first' }); return; }
    const paye = Number(l.paye || 0);
    const uif_total = Number(l.uif_emp || 0) + Number(l.uif_er || 0);
    const sdl = Number(l.sdl_er || 0);
    setSelectedEmpId(empId);
    setPaySarsValues({ paye, sdl, uif_total, bankId });
    setOpenPaySarsDlg(true);
  };
  const exportToExcel = () => {
    const rows = employees.map(e => {
      const l = linesByEmp[e.id];
      return {
        Employee: `${e.first_name} ${e.last_name}`,
        Gross: Number(l?.gross || 0),
        PAYE: Number(l?.paye || 0),
        UIF_Emp: Number(l?.uif_emp || 0),
        UIF_Er: Number(l?.uif_er || 0),
        SDL: Number(l?.sdl_er || 0),
        Net: Number(l?.net || 0),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    const label = currentRun ? new Date(String(currentRun.period_start || new Date())).toLocaleString('en-ZA', { month: 'long', year: 'numeric' }) : 'Current';
    XLSX.writeFile(wb, `Payroll_${label}.xlsx`);
  };

  const executePostJournal = async () => {
    try {
      const effectiveCompanyId = await getEffectiveCompanyId();
      if (!effectiveCompanyId) throw new Error('Company ID missing');
      const l = linesByEmp[selectedEmpId];
      if (!l) throw new Error('No payroll line');
      const ref = `PR-${currentRunId}-${selectedEmpId}-POST`;
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .eq('reference_number', ref)
        .maybeSingle();
      if (existingTx) { toast({ title: 'Duplicate', description: 'This payroll journal was already posted', variant: 'destructive' }); return; }
      const salaryExp = await ensureAccountByCode('Salary Expense', 'expense', '6020');
      const uifExp = await ensureAccountByCode('Employer UIF Expense', 'expense', '6021');
      const sdlExp = await ensureAccountByCode('Employer SDL Expense', 'expense', '6022');
      const netPayable = await ensureAccountByCode('Net Salaries Payable', 'liability', '2100-NET');
      const payePayable = await ensureAccountByCode('PAYE Payable', 'liability', '2100-PAYE');
      const uifPayable = await ensureAccountByCode('UIF Payable', 'liability', '2100-UIF');
      const sdlPayable = await ensureAccountByCode('SDL Payable', 'liability', '2100-SDL');
      const total = Number(postValues.gross || 0) + Number(postValues.uif_er || 0) + Number(postValues.sdl_er || 0);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: tx } = await supabase
        .from('transactions')
        .insert({ company_id: effectiveCompanyId, user_id: user.id, transaction_date: new Date().toISOString().slice(0,10), description: 'Payroll expense', total_amount: total, transaction_type: 'expense', status: 'pending', reference_number: ref } as any)
        .select()
        .single();
      const txId = (tx as any)?.id;
      const entries = [
        { transaction_id: txId, account_id: salaryExp, debit: Number(postValues.gross || 0), credit: 0, description: 'Salary Expense', status: 'pending' },
        { transaction_id: txId, account_id: uifExp, debit: Number(postValues.uif_er || 0), credit: 0, description: 'Employer UIF Expense', status: 'pending' },
        { transaction_id: txId, account_id: sdlExp, debit: Number(postValues.sdl_er || 0), credit: 0, description: 'Employer SDL Expense', status: 'pending' },
        { transaction_id: txId, account_id: netPayable, debit: 0, credit: Number(postValues.net || 0), description: 'Net Salaries Payable', status: 'pending' },
        { transaction_id: txId, account_id: payePayable, debit: 0, credit: Number(postValues.paye || 0), description: 'PAYE Payable', status: 'pending' },
        { transaction_id: txId, account_id: uifPayable, debit: 0, credit: Number((postValues.uif_emp || 0) + (postValues.uif_er || 0)), description: 'UIF Payable', status: 'pending' },
        { transaction_id: txId, account_id: sdlPayable, debit: 0, credit: Number(postValues.sdl_er || 0), description: 'SDL Payable', status: 'pending' },
      ];
      await supabase.from('transaction_entries').insert(entries as any);
      const ledgerRows = entries.map(e => ({ company_id: effectiveCompanyId, transaction_id: txId, account_id: e.account_id, entry_date: new Date().toISOString().slice(0,10), description: e.description, debit: e.debit, credit: e.credit, is_reversed: false }));
      await supabase.from('ledger_entries').insert(ledgerRows as any);
      setOpenPostDlg(false);
      toast({ title: 'Posted', description: 'Payroll journal posted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to post payroll', variant: 'destructive' });
    }
  };

  const executePaySalary = async () => {
    try {
      const effectiveCompanyId = await getEffectiveCompanyId();
      if (!effectiveCompanyId) throw new Error('Company ID missing');
      // Validate bank account
      const bid = String(paySalaryValues.bankId || '').trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!bid || !uuidRegex.test(bid) || !bankAccounts.find(b => b.id === bid)) {
        toast({ title: 'Bank Account Required', description: 'Please select a valid bank account.', variant: 'destructive' });
        return;
      }
      const ref = `PR-${currentRunId}-${selectedEmpId}-SALARY`;
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .eq('reference_number', ref)
        .maybeSingle();
      if (existingTx) { toast({ title: 'Duplicate', description: 'This salary payment was already posted', variant: 'destructive' }); return; }
      const netPayable = await ensureAccountByCode('Net Salaries Payable', 'liability', '2100-NET');
      const bankLedger = await ensureAccountByCode('Bank', 'asset', '1000');
      const amt = Number(paySalaryValues.net || 0);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: tx } = await supabase
        .from('transactions')
        .insert({ company_id: effectiveCompanyId, user_id: user.id, transaction_date: new Date().toISOString().slice(0,10), description: 'Salary payment', total_amount: amt, bank_account_id: bid, transaction_type: 'payment', status: 'pending', reference_number: ref } as any)
        .select()
        .single();
      const txId = (tx as any)?.id;
      const entries = [
        { transaction_id: txId, account_id: netPayable, debit: amt, credit: 0, description: 'Pay Net Salary', status: 'pending' },
        { transaction_id: txId, account_id: bankLedger, debit: 0, credit: amt, description: 'Pay Net Salary', status: 'pending' },
      ];
      await supabase.from('transaction_entries').insert(entries as any);
      const ledgerRows = entries.map(e => ({ company_id: effectiveCompanyId, transaction_id: txId, account_id: e.account_id, entry_date: new Date().toISOString().slice(0,10), description: e.description, debit: e.debit, credit: e.credit, is_reversed: false }));
      await supabase.from('ledger_entries').insert(ledgerRows as any);
      setOpenPaySalaryDlg(false);
      toast({ title: 'Paid', description: 'Salary payment posted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to pay salary', variant: 'destructive' });
    }
  };

  const executePaySars = async () => {
    try {
      const effectiveCompanyId = await getEffectiveCompanyId();
      if (!effectiveCompanyId) throw new Error('Company ID missing');
      // Validate bank account
      const bid = String(paySarsValues.bankId || '').trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!bid || !uuidRegex.test(bid) || !bankAccounts.find(b => b.id === bid)) {
        toast({ title: 'Bank Account Required', description: 'Please select a valid bank account.', variant: 'destructive' });
        return;
      }
      const ref = `PR-${currentRunId}-${selectedEmpId}-SARS`;
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .eq('reference_number', ref)
        .maybeSingle();
      if (existingTx) { toast({ title: 'Duplicate', description: 'This SARS payment was already posted', variant: 'destructive' }); return; }
      const payePayable = await ensureAccountByCode('PAYE Payable', 'liability', '2100-PAYE');
      const uifPayable = await ensureAccountByCode('UIF Payable', 'liability', '2100-UIF');
      const sdlPayable = await ensureAccountByCode('SDL Payable', 'liability', '2100-SDL');
      const bankLedger = await ensureAccountByCode('Bank', 'asset', '1000');
      const total = Number(paySarsValues.paye || 0) + Number(paySarsValues.sdl || 0) + Number(paySarsValues.uif_total || 0);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: tx } = await supabase
        .from('transactions')
        .insert({ company_id: effectiveCompanyId, user_id: user.id, transaction_date: new Date().toISOString().slice(0,10), description: 'SARS payment (PAYE/UIF/SDL)', total_amount: total, bank_account_id: bid, transaction_type: 'liability', status: 'pending', reference_number: ref } as any)
        .select()
        .single();
      const txId = (tx as any)?.id;
      const entries = [
        { transaction_id: txId, account_id: payePayable, debit: Number(paySarsValues.paye || 0), credit: 0, description: 'PAYE Payable', status: 'pending' },
        { transaction_id: txId, account_id: sdlPayable, debit: Number(paySarsValues.sdl || 0), credit: 0, description: 'SDL Payable', status: 'pending' },
        { transaction_id: txId, account_id: uifPayable, debit: Number(paySarsValues.uif_total || 0), credit: 0, description: 'UIF Payable', status: 'pending' },
        { transaction_id: txId, account_id: bankLedger, debit: 0, credit: total, description: 'SARS Payment', status: 'pending' },
      ];
      await supabase.from('transaction_entries').insert(entries as any);
      const ledgerRows = entries.map(e => ({ company_id: effectiveCompanyId, transaction_id: txId, account_id: e.account_id, entry_date: new Date().toISOString().slice(0,10), description: e.description, debit: e.debit, credit: e.credit, is_reversed: false }));
      await supabase.from('ledger_entries').insert(ledgerRows as any);
      setOpenPaySarsDlg(false);
      toast({ title: 'Paid', description: 'SARS payment posted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to pay SARS', variant: 'destructive' });
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Payroll</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm">
            {currentRun ? (
              <Badge variant="secondary">This payroll is for {new Date(String(currentRun.period_start)).toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}</Badge>
            ) : (
              <Badge variant="outline">No current pay run</Badge>
            )}
          </div>
          <Button variant="outline" onClick={exportToExcel}>Export to Excel</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>PAYE</TableHead>
              <TableHead>UIF</TableHead>
              <TableHead>SDL</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {employees.map(e => {
            const l = linesByEmp[e.id];
            return (
              <TableRow key={e.id}>
                  <TableCell>{e.first_name} {e.last_name}</TableCell>
                  <TableCell>{l ? `R ${Number(l.gross || 0).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{l ? `R ${Number(l.paye || 0).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{l ? `R ${(Number(l.uif_emp || 0) + Number(l.uif_er || 0)).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{l ? `R ${Number(l.sdl_er || 0).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{l ? `R ${Number(l.net || 0).toFixed(2)}` : '-'}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openPostFor(e.id)}>Post</Button>
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => openPayFor(e.id)}>Pay Salary</Button>
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => openPaySarsFor(e.id)}>Pay SARS</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Dialog open={openPostDlg} onOpenChange={setOpenPostDlg}>
          <DialogContent>
            <DialogHeader><DialogTitle>Post Payroll Journal</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Gross Salary</Label><Input value={String(postValues.gross)} onChange={e => setPostValues({ ...postValues, gross: Number(e.target.value || 0) })} /></div>
              <div><Label>PAYE</Label><Input value={String(postValues.paye)} onChange={e => setPostValues({ ...postValues, paye: Number(e.target.value || 0) })} /></div>
              <div><Label>UIF (Employer)</Label><Input value={String(postValues.uif_er)} onChange={e => setPostValues({ ...postValues, uif_er: Number(e.target.value || 0) })} /></div>
              <div><Label>UIF (Employee)</Label><Input value={String(postValues.uif_emp)} onChange={e => setPostValues({ ...postValues, uif_emp: Number(e.target.value || 0) })} /></div>
              <div><Label>SDL (Employer)</Label><Input value={String(postValues.sdl_er)} onChange={e => setPostValues({ ...postValues, sdl_er: Number(e.target.value || 0) })} /></div>
              <div><Label>Net Pay</Label><Input value={String(postValues.net)} onChange={e => setPostValues({ ...postValues, net: Number(e.target.value || 0) })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenPostDlg(false)}>Cancel</Button>
              <Button onClick={executePostJournal}>Post</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={openPaySalaryDlg} onOpenChange={setOpenPaySalaryDlg}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pay Net Salary</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Net Amount</Label><Input value={String(paySalaryValues.net)} onChange={e => setPaySalaryValues({ ...paySalaryValues, net: Number(e.target.value || 0) })} /></div>
              <div>
                <Label>Bank Account</Label>
                <Select value={paySalaryValues.bankId} onValueChange={(v: any) => setPaySalaryValues({ ...paySalaryValues, bankId: String(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenPaySalaryDlg(false)}>Cancel</Button>
              <Button onClick={executePaySalary}>Pay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={openPaySarsDlg} onOpenChange={setOpenPaySarsDlg}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pay SARS (PAYE/UIF/SDL)</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>PAYE</Label><Input value={String(paySarsValues.paye)} onChange={e => setPaySarsValues({ ...paySarsValues, paye: Number(e.target.value || 0) })} /></div>
              <div><Label>SDL</Label><Input value={String(paySarsValues.sdl)} onChange={e => setPaySarsValues({ ...paySarsValues, sdl: Number(e.target.value || 0) })} /></div>
              <div><Label>UIF Total</Label><Input value={String(paySarsValues.uif_total)} onChange={e => setPaySarsValues({ ...paySarsValues, uif_total: Number(e.target.value || 0) })} /></div>
              <div>
                <Label>Bank Account</Label>
                <Select value={paySarsValues.bankId} onValueChange={(v: any) => setPaySarsValues({ ...paySarsValues, bankId: String(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenPaySarsDlg(false)}>Cancel</Button>
              <Button onClick={executePaySars}>Pay</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
