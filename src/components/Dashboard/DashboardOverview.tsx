import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Briefcase,
  Settings,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { calculateDepreciation } from "@/components/FixedAssets/DepreciationCalculator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/useAuth";
import { DashboardCalendar } from "./DashboardCalendar";
import { FinancialHealthInsight } from "./FinancialHealthInsight";
import { useFiscalYear } from "@/hooks/use-fiscal-year";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoMode, getDemoCompany, getDemoTransactions, getDemoTrialBalanceForPeriod } from "@/lib/demo-data";
import { dashboardCache } from "@/stores/dashboardCache";

export const DashboardOverview = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalIncome: 0,
    totalExpenses: 0,
    operatingExpenses: 0,
    bankBalance: 0,
    currentAssets: 0,
    currentLiabilities: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [purchaseTrend, setPurchaseTrend] = useState<any[]>([]);
  const [assetTrend, setAssetTrend] = useState<any[]>([]);
  const [arInvoices, setArInvoices] = useState<Array<{ id: string; customer_name: string; total_amount: number; status: string; invoice_date: string; due_date: string | null }>>([]);
  const [arTop10, setArTop10] = useState<any[]>([]);
  const [arDonut, setArDonut] = useState<any[]>([]);
  const [incomeBreakdown, setIncomeBreakdown] = useState<any[]>([]);
  const [apTop10, setApTop10] = useState<any[]>([]);
  const [apDonut, setApDonut] = useState<any[]>([]);
  const [apRows, setApRows] = useState<Array<{ id: string; supplier_name: string; total_amount: number; status: string; bill_date?: string; due_date?: string | null; source?: string }>>([]);
  const [arKpis, setArKpis] = useState<{ unpaidTotal: number; overdueTotal: number; overdueUnder30Total: number; overdue30Total: number; overdue90Total: number }>({ unpaidTotal: 0, overdueTotal: 0, overdueUnder30Total: 0, overdue30Total: 0, overdue90Total: 0 });
  const [apKpis, setApKpis] = useState<{ unpaidTotal: number; overdueTotal: number; overdueUnder30Total: number; overdue30Total: number; overdue90Total: number }>({ unpaidTotal: 0, overdueTotal: 0, overdueUnder30Total: 0, overdue30Total: 0, overdue90Total: 0 });
  const [arAging, setArAging] = useState<any[]>([]);
  const [apAging, setApAging] = useState<any[]>([]);
  const [netProfitTrend, setNetProfitTrend] = useState<any[]>([]);
  const [plTrend, setPlTrend] = useState<any[]>([]);
  const [budgetUtilization, setBudgetUtilization] = useState<number>(0);
  const [budgetOnTrack, setBudgetOnTrack] = useState<boolean>(true);
  const [inventoryLevels, setInventoryLevels] = useState<Array<{ name: string; qty: number }>>([]);
  const [bsComposition, setBsComposition] = useState<Array<{ label: string; assets: number; liabilities: number; equity: number }>>([]);
  const [costStructure, setCostStructure] = useState<any[]>([]);
  const [profitMargins, setProfitMargins] = useState<any[]>([]);
  const [cashGaugePct, setCashGaugePct] = useState<number>(0);
  const [cashOnTrack, setCashOnTrack] = useState<boolean>(true);
  const [safeMinimum, setSafeMinimum] = useState<number>(0);
  const [userName, setUserName] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [companyId, setCompanyId] = useState<string>("");
  const [chartMonths, setChartMonths] = useState<number>(12);
  const [sbStatus, setSbStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const [sbLatency, setSbLatency] = useState<number | null>(null);
  const [sbStrength, setSbStrength] = useState<number>(0);
  const loadingRef = useRef(false);
  const reloadErrorCountRef = useRef<number>(0);
  const { fiscalStartMonth, selectedFiscalYear, setSelectedFiscalYear, getCalendarYearForFiscalPeriod, loading: fiscalLoading } = useFiscalYear();
  
  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (!fiscalLoading && typeof selectedFiscalYear === 'number') {
      setSelectedYear(selectedFiscalYear);
      const nextMonth = fiscalStartMonth === 12 ? 1 : (fiscalStartMonth + 1);
      setSelectedMonth(nextMonth);
    }
  }, [fiscalLoading, selectedFiscalYear, fiscalStartMonth]);
  
  // Widget visibility settings
  const [widgets, setWidgets] = useState(() => {
    const defaultWidgets = {
      metrics: true,
      netProfit: true,
      incomeVsExpense: true,
      incomeExpense: true,
      expenseBreakdown: true,
      assetTrend: true,
      recentTransactions: true,
      trialBalance: true,
      arOverview: true,
      apOverview: true,
      purchaseTrend: true,
      budgetGauge: false,
      inventoryStock: true,
      bsComposition: true,
      cashGauge: true,
    };
    const saved = localStorage.getItem('dashboardWidgets');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...defaultWidgets, ...parsed };
  });
  const [todoItems, setTodoItems] = useState<Array<{ id: string; label: string; done: boolean }>>([]);

  const checkSupabaseConnection = useCallback(async () => {
    try {
      const dm = typeof localStorage !== 'undefined' && localStorage.getItem('rigel_demo_mode') === 'true';
      if (dm) {
        setSbStatus('online');
        setSbStrength(3);
        setSbLatency(null);
        return;
      }
      setSbStatus(prev => prev === 'offline' ? 'connecting' : prev);
      const start = performance.now();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSbStatus('offline');
        setSbStrength(0);
        setSbLatency(null);
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);
      if (error) throw error;
      const latency = Math.round(performance.now() - start);
      setSbLatency(latency);
      setSbStatus('online');
      setSbStrength(latency < 150 ? 3 : latency < 400 ? 2 : 1);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('AbortError') || msg.includes('ERR_ABORTED')) {
        setSbStatus('offline');
        setSbStrength(0);
        setSbLatency(null);
        return;
      }
      setSbStatus('offline');
      setSbStrength(0);
      setSbLatency(null);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(checkSupabaseConnection, 15000);
    checkSupabaseConnection();
    return () => { try { clearInterval(timer); } catch {} };
  }, [checkSupabaseConnection]);



  const calculateTotalInventoryValue = useCallback(async (companyId: string) => {
    try {
      const { data: products } = await supabase
        .from('items')
        .select('cost_price, quantity_on_hand')
        .eq('company_id', companyId)
        .eq('item_type', 'product')
        .gt('quantity_on_hand', 0);
      const totalValue = (products || []).reduce((sum, product) => {
        const cost = Number(product.cost_price || 0);
        const qty = Number(product.quantity_on_hand || 0);
        return sum + (cost * qty);
      }, 0);
      return totalValue;
    } catch (error) {
      return 0;
    }
  }, []);

  function totalsFromTrialBalance(tb: any[]) {
    const income = tb.filter((a: any) => a.account_type.toLowerCase() === 'revenue' || a.account_type.toLowerCase() === 'income').reduce((s: number, a: any) => s + (a.balance || 0), 0);
    const cogs = tb.filter((a: any) => a.account_type.toLowerCase() === 'expense' && ((a.account_name || '').toLowerCase().includes('cost of') || String(a.account_code || '').startsWith('5000'))).reduce((s: number, a: any) => s + (a.balance || 0), 0);
    const opex = tb.filter((a: any) => a.account_type.toLowerCase() === 'expense' && !((a.account_name || '').toLowerCase().includes('cost of') || String(a.account_code || '').startsWith('5000'))).reduce((s: number, a: any) => s + (a.balance || 0), 0);
    return { income, expenses: cogs + opex };
  }

  const fetchTrialBalanceForPeriod = useCallback(async (companyId: string, start: string, end: string) => {
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    endDateObj.setHours(23, 59, 59, 999);

    const { data: accounts, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('id, account_code, account_name, account_type')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('account_code');
    if (accountsError) throw accountsError;

    const { data: txEntries, error: txError } = await supabase
      .from('transaction_entries')
      .select(`
        transaction_id,
        account_id,
        debit,
        credit,
        transactions!inner (
          transaction_date,
          status
        )
      `)
      .eq('transactions.company_id', companyId)
      .eq('transactions.status', 'posted')
      .gte('transactions.transaction_date', startDateObj.toISOString())
      .lte('transactions.transaction_date', endDateObj.toISOString());
    if (txError) throw txError;

    const { data: ledgerEntries, error: ledgerError } = await supabase
      .from('ledger_entries')
      .select('transaction_id, account_id, debit, credit, entry_date')
      .eq('company_id', companyId)
      .gte('entry_date', startDateObj.toISOString())
      .lte('entry_date', endDateObj.toISOString());
    if (ledgerError) throw ledgerError;

    const trialBalance: Array<{ account_id: string; account_code: string; account_name: string; account_type: string; balance: number; }> = [];
    const totalInventoryValue = await calculateTotalInventoryValue(companyId);
    const ledgerTxIds = new Set<string>((ledgerEntries || []).map((e: any) => String(e.transaction_id || '')));
    const filteredTxEntries = (txEntries || []).filter((e: any) => !ledgerTxIds.has(String(e.transaction_id || '')));

    (accounts || []).forEach((acc: any) => {
      let sumDebit = 0;
      let sumCredit = 0;
      filteredTxEntries?.forEach((entry: any) => { if (entry.account_id === acc.id) { sumDebit += Number(entry.debit || 0); sumCredit += Number(entry.credit || 0); } });
      ledgerEntries?.forEach((entry: any) => { if (entry.account_id === acc.id) { sumDebit += Number(entry.debit || 0); sumCredit += Number(entry.credit || 0); } });
      const type = (acc.account_type || '').toLowerCase();
      const naturalDebit = type === 'asset' || type === 'expense';
      const balance = naturalDebit ? (sumDebit - sumCredit) : (sumCredit - sumDebit);
      const shouldShow = Math.abs(balance) > 0.01;
      if (shouldShow) { trialBalance.push({ account_id: acc.id, account_code: acc.account_code, account_name: acc.account_name, account_type: acc.account_type, balance }); }
    });
    return trialBalance;
  }, [calculateTotalInventoryValue]);
  const toggleTodo = (id: string) => {
    const next = todoItems.map(it => it.id === id ? { ...it, done: !it.done } : it);
    setTodoItems(next);
    if (companyId) {
      const todoKey = `dashboard_todo_${companyId}`;
      try { localStorage.setItem(todoKey, JSON.stringify(next)); } catch {}
    }
  };

  const DASHBOARD_TTL_MS = 10 * 60 * 1000;

  const applyCachedDashboard = (cached: any) => {
    if (!cached) return;
    if (cached.metrics) setMetrics(cached.metrics);
    if (cached.recentTransactions) setRecentTransactions(cached.recentTransactions);
    if (cached.chartData) setChartData(cached.chartData);
    if (cached.netProfitTrend) setNetProfitTrend(cached.netProfitTrend);
    if (cached.plTrend) setPlTrend(cached.plTrend);
    if (cached.incomeBreakdown) setIncomeBreakdown(cached.incomeBreakdown);
    if (cached.expenseBreakdown) setExpenseBreakdown(cached.expenseBreakdown);
    if (cached.arTop10) setArTop10(cached.arTop10);
    if (cached.apTop10) setApTop10(cached.apTop10);
    if (cached.arDonut) setArDonut(cached.arDonut);
    if (cached.apDonut) setApDonut(cached.apDonut);
  };

  const loadDashboardData = useCallback(async (opts?: { force?: boolean }) => {
    try {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const isDemo = isDemoMode();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!isDemo && (authError || !user)) { setLoading(false); loadingRef.current = false; reloadErrorCountRef.current += 1; toast({ title: "Session expired", description: "Please sign in again" }); navigate("/login?session=expired", { replace: true }); return; }
      let cid = "";
      let nameForUser = "";
      if (isDemo) {
        const company = getDemoCompany();
        cid = String(company.id);
        nameForUser = "Demo User";
      } else {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id, first_name, last_name")
          .eq("user_id", user.id)
          .single();
        if (profileError || !profile) { setLoading(false); loadingRef.current = false; reloadErrorCountRef.current += 1; return; }
        cid = String(profile.company_id);
        const fullName = [String(profile.first_name || '').trim(), String(profile.last_name || '').trim()].filter(Boolean).join(' ');
        nameForUser = fullName || (user.user_metadata?.name as string) || user.email || "";
      }
      setCompanyId(cid);
      setUserName(nameForUser);
      try {
        const todoKey = `dashboard_todo_${String(cid)}`;
        const savedTodos = localStorage.getItem(todoKey);
        if (savedTodos) {
          setTodoItems(JSON.parse(savedTodos));
        } else {
          const defaults = [
            { id: 'todo-connect-bank', label: 'Connect bank account', done: false },
            { id: 'todo-import-statement', label: 'Import bank statement (CSV)', done: false },
            { id: 'todo-reconcile-month', label: 'Reconcile bank for current month', done: false },
            { id: 'todo-approve-transactions', label: 'Approve pending transactions', done: false },
            { id: 'todo-first-invoice', label: 'Create first invoice', done: false },
            { id: 'todo-first-bill', label: 'Record first bill', done: false },
            { id: 'todo-lock-period', label: 'Lock last reconciled period', done: false },
            { id: 'todo-recon-report', label: 'Run reconciliation report (PDF/CSV)', done: false },
            { id: 'todo-outstanding', label: 'Review outstanding deposits/payments', done: false },
            { id: 'todo-bank-rules', label: 'Set up bank rules', done: false },
          ];
          setTodoItems(defaults);
          localStorage.setItem(todoKey, JSON.stringify(defaults));
        }
      } catch {}
      
      const calendarYear = getCalendarYearForFiscalPeriod(selectedYear, selectedMonth);
      const startDate = new Date(calendarYear, selectedMonth - 1, 1);
      const endDate = new Date(calendarYear, selectedMonth, 0, 23, 59, 59);
      
      const rangeStart = new Date(startDate);
      rangeStart.setMonth(rangeStart.getMonth() - chartMonths);
      
      const cacheKey = `db-cache-${String(cid)}-${selectedYear}-${selectedMonth}-${chartMonths}m-fy${fiscalStartMonth}`;
      const cachedEntry = dashboardCache.get(cacheKey);
      if (cachedEntry?.payload) {
        applyCachedDashboard(cachedEntry.payload);
      }
      const hasCache = !!cachedEntry?.payload;
      const stale = opts?.force ? true : dashboardCache.isStale(cacheKey, String(cid), DASHBOARD_TTL_MS);
      if (hasCache && !stale) {
        setLoading(false);
        loadingRef.current = false;
        reloadErrorCountRef.current = 0;
        return;
      }
      setLoading(!hasCache);
      let transactions: any[] = [];
      let trialBalance: any[] = [];
      if (isDemo) {
        transactions = await getDemoTransactions();
        trialBalance = await getDemoTrialBalanceForPeriod(startDate.toISOString(), endDate.toISOString());
      } else {
        const tbPromise = fetchTrialBalanceForPeriod(String(cid), startDate.toISOString(), endDate.toISOString());

        const txRes = await supabase
          .from("dashboard_recent_transactions" as any)
          .select("id, reference_number, description, total_amount, transaction_date, transaction_type, status")
          .eq("company_id", cid)
          .gte("transaction_date", rangeStart.toISOString())
          .lte("transaction_date", endDate.toISOString())
          .order("transaction_date", { ascending: false });

        if ((txRes as any)?.error) {
          const fallbackTxRes = await supabase
            .from("transactions")
            .select("id, reference_number, description, total_amount, transaction_date, transaction_type, status")
            .eq("company_id", cid)
            .gte("transaction_date", rangeStart.toISOString())
            .lte("transaction_date", endDate.toISOString())
            .order("transaction_date", { ascending: false });
          if ((fallbackTxRes as any)?.error) throw (fallbackTxRes as any).error;
          transactions = (fallbackTxRes as any)?.data || [];
        } else {
          transactions = (txRes as any)?.data || [];
        }

        trialBalance = await tbPromise;
      }
      const recent = (transactions || []).slice(0, 10).map((t: any) => ({
        id: String(t.id || t.reference_number || ''),
        description: String(t.description || ''),
        date: new Date(String(t.transaction_date || new Date())).toLocaleDateString('en-ZA'),
        type: String(t.type || '').toLowerCase() === 'income' ? 'income' : (['sales','income','asset_disposal','invoice'].includes(String(t.transaction_type || '').toLowerCase()) ? 'income' : 'expense'),
        amount: Number(t.total_amount || t.amount || 0),
        status: String(t.status || 'pending').toLowerCase()
      }));
      setRecentTransactions(recent);
      const totals = totalsFromTrialBalance(trialBalance);
      const operatingExpensesTB = (trialBalance || [])
        .filter((a: any) => {
          const type = String(a.account_type || '').toLowerCase();
          const name = String(a.account_name || '').toLowerCase();
          const code = String(a.account_code || '');
          const isExpense = type === 'expense';
          const isCogs = name.includes('cost of') || code.startsWith('5000');
          return isExpense && !isCogs;
        })
        .reduce((s: number, a: any) => s + Math.abs(Number(a.balance || 0)), 0);
      const totalAssets = (trialBalance || []).filter((a: any) => String(a.account_type || '').toLowerCase() === 'asset').reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
      const totalLiabilities = (trialBalance || []).filter((a: any) => String(a.account_type || '').toLowerCase() === 'liability').reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
      const totalEquity = (trialBalance || []).filter((a: any) => String(a.account_type || '').toLowerCase() === 'equity').reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

      const incomeAccounts = (trialBalance || []).filter((a: any) => ['revenue', 'income'].includes(String(a.account_type || '').toLowerCase())).map((a: any) => ({ name: String(a.account_name || ''), value: Math.abs(Number(a.balance || 0)) }));
      const expenseAccounts = (trialBalance || []).filter((a: any) => String(a.account_type || '').toLowerCase() === 'expense').map((a: any) => ({ name: String(a.account_name || ''), value: Math.abs(Number(a.balance || 0)) }));
      let incomeSorted = incomeAccounts.sort((a: any, b: any) => b.value - a.value).slice(0, 10);
      let expenseSorted = expenseAccounts.sort((a: any, b: any) => b.value - a.value).slice(0, 10);
      if (expenseSorted.length === 0 || Number(totals.expenses) === 0 || incomeSorted.length === 0 || Number(totals.income) === 0) {
        const { data: te } = await supabase
          .from('transaction_entries')
          .select(`account_id, debit, credit, transactions!inner (transaction_date, company_id)`) 
          .eq('transactions.company_id', companyId)
          .gte('transactions.transaction_date', startDate.toISOString())
          .lte('transactions.transaction_date', endDate.toISOString());
        const { data: accounts } = await supabase
          .from('chart_of_accounts')
          .select('id, account_type, account_name, account_code')
          .eq('company_id', companyId)
          .eq('is_active', true);
        const typeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
        const nameById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_name || '')]));
        const codeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_code || '')]));
        const incomeMap: Record<string, number> = {};
        const expenseMap: Record<string, number> = {};
        (te || []).forEach((e: any) => {
          const id = String(e.account_id);
          const type = (typeById.get(id) || '').toLowerCase();
          const name = (nameById.get(id) || '').toLowerCase();
          const code = codeById.get(id) || '';
          const debit = Number(e.debit || 0);
          const credit = Number(e.credit || 0);
          const isIncome = type.includes('income') || type.includes('revenue');
          const isExpense = type.includes('expense') || name.includes('cost of') || String(code).startsWith('5');
          if (isIncome) {
            incomeMap[id] = (incomeMap[id] || 0) + Math.abs(credit - debit);
          } else if (isExpense) {
            expenseMap[id] = (expenseMap[id] || 0) + Math.abs(debit - credit);
          }
        });
        incomeSorted = Object.entries(incomeMap).map(([id, val]) => ({ name: nameById.get(id) || id, value: Number(val.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
        expenseSorted = Object.entries(expenseMap).map(([id, val]) => ({ name: nameById.get(id) || id, value: Number(val.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
      }
      // Aggregate over multi-month range using teRange (computed below)
      // Temporarily set from single-period totals; will overwrite after teRange aggregation
      setIncomeBreakdown(incomeSorted);
      setExpenseBreakdown(expenseSorted);
      setIncomeWheelInner([{ name: 'Expenses', value: totals.expenses }, { name: 'Income', value: totals.income }]);
      setExpenseWheelInner([{ name: 'Income', value: totals.income }, { name: 'Expenses', value: totals.expenses }]);

      const months: Array<{ start: Date; end: Date; label: string }> = [];
      for (let i = 0; i < chartMonths; i++) {
        const monthIndex = (fiscalStartMonth - 1 + i) % 12;
        const monthNum = monthIndex + 1;
        const yearForMonth = getCalendarYearForFiscalPeriod(selectedYear, monthNum);
        const ms = new Date(yearForMonth, monthIndex, 1);
        const me = new Date(yearForMonth, monthIndex + 1, 0, 23, 59, 59, 999);
        const label = ms.toLocaleDateString('en-ZA', { month: 'short' });
        months.push({ start: ms, end: me, label });
      }
      const monthlyData: any[] = [];
      const netTrend: any[] = [];
      const assetMonthly: any[] = [];
      const { data: teRange } = await supabase
        .from('transaction_entries')
        .select(`account_id, debit, credit, transactions!inner (transaction_date, company_id)`) 
        .eq('transactions.company_id', cid)
        .gte('transactions.transaction_date', months[0].start.toISOString())
        .lte('transactions.transaction_date', months[months.length - 1].end.toISOString());
      const { data: accountsAll } = await supabase
        .from('chart_of_accounts')
        .select('id, account_type, account_name, account_code')
        .eq('company_id', cid)
        .eq('is_active', true);
      const typeByIdAll = new Map<string, string>((accountsAll || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
      const nameByIdAll = new Map<string, string>((accountsAll || []).map((a: any) => [String(a.id), String(a.account_name || '')]));
      const codeByIdAll = new Map<string, string>((accountsAll || []).map((a: any) => [String(a.id), String(a.account_code || '')]));
      const buckets: Record<string, { income: number; expenses: number; cogs: number; opex: number; label: string }> = {};
      const incAgg: Record<string, number> = {};
      const expAgg: Record<string, number> = {};
      months.forEach(m => { buckets[m.label] = { income: 0, expenses: 0, cogs: 0, opex: 0, label: m.label }; });
      (teRange || []).forEach((e: any) => {
        const dt = new Date(String(e.transactions?.transaction_date || new Date()));
        const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
        if (!buckets[label]) return;
        const id = String(e.account_id || '');
        const type = (typeByIdAll.get(id) || '').toLowerCase();
        const name = String(nameByIdAll.get(id) || '').toLowerCase();
        const code = codeByIdAll.get(id) || '';
        const debit = Number(e.debit || 0);
        const credit = Number(e.credit || 0);
        const isIncome = type.includes('income') || type.includes('revenue');
        const isExpense = type.includes('expense') || name.includes('cost of') || String(code).startsWith('5');
        if (isIncome) {
          const val = Math.abs(credit - debit);
          buckets[label].income += val;
          incAgg[id] = (incAgg[id] || 0) + val;
        } else if (isExpense) {
          const val = Math.abs(debit - credit);
          buckets[label].expenses += val;
          expAgg[id] = (expAgg[id] || 0) + val;
          
          const isCogs = name.includes('cost of') || String(code).startsWith('5000');
          if (isCogs) buckets[label].cogs += val;
          else buckets[label].opex += val;
        }
      });
      
      const costStructureData: any[] = [];
      const profitMarginsData: any[] = [];

      Object.values(buckets).forEach(r => {
        monthlyData.push({ month: r.label, income: Number(r.income.toFixed(2)), expenses: Number(r.expenses.toFixed(2)) });
        netTrend.push({ month: r.label, netProfit: Number((r.income - r.expenses).toFixed(2)) });
        
        costStructureData.push({ 
            month: r.label, 
            cogs: Number(r.cogs.toFixed(2)), 
            opex: Number(r.opex.toFixed(2)) 
        });

        const grossProfit = r.income - r.cogs;
        const netProfit = r.income - r.expenses;
        const grossMargin = r.income > 0 ? (grossProfit / r.income) * 100 : 0;
        const netMargin = r.income > 0 ? (netProfit / r.income) * 100 : 0;

        profitMarginsData.push({
            month: r.label,
            grossMargin: Number(grossMargin.toFixed(1)),
            netMargin: Number(netMargin.toFixed(1))
        });

        assetMonthly.push({ month: r.label, nbv: 0 });
      });
      
      setCostStructure(costStructureData);
      setProfitMargins(profitMarginsData);

      const { data: fa } = await supabase
        .from('fixed_assets')
        .select('id, description, cost, purchase_date, useful_life_years, status')
        .eq('company_id', companyId);
      if (fa && fa.length > 0) {
        for (let i = 0; i < months.length; i++) {
          const monthEnd = months[i].end;
          let nbvSum = 0;
          (fa || []).forEach((asset: any) => {
            const status = String(asset.status || '').toLowerCase();
            if (status === 'disposed') return;
            const res = calculateDepreciation(Number(asset.cost || 0), String(asset.purchase_date || new Date().toISOString()), Number(asset.useful_life_years || 5), monthEnd);
            nbvSum += Number(res.netBookValue || 0);
          });
          assetMonthly[i].nbv = Number(nbvSum.toFixed(2));
        }
        setAssetTrend(assetMonthly);
      } else {
        setAssetTrend([]);
      }
      setChartData(monthlyData);
      setNetProfitTrend(netTrend);

      // Donut data: aggregate Income vs Expenses over the full selected range using ledger entries (posted/approved)
      const { data: ledRange } = await supabase
        .from('ledger_entries')
        .select('account_id, debit, credit, entry_date')
        .eq('company_id', cid)
        .gte('entry_date', months[0].start.toISOString())
        .lte('entry_date', months[months.length - 1].end.toISOString());

      // Fetch ALL-TIME ledger entries for Balance Sheet metrics (Assets, Liabilities, Equity)
      const { data: bsLedgerEntries } = await supabase
        .from('ledger_entries')
        .select('account_id, debit, credit')
        .eq('company_id', cid)
        .lte('entry_date', endDate.toISOString());

      const { data: accMapData } = await supabase
        .from('chart_of_accounts')
        .select('id, account_type, account_name, account_code')
        .eq('company_id', cid)
        .eq('is_active', true);
      const accTypeById = new Map<string, string>((accMapData || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
      const accNameById = new Map<string, string>((accMapData || []).map((a: any) => [String(a.id), String(a.account_name || '')]));
      const accCodeById = new Map<string, string>((accMapData || []).map((a: any) => [String(a.id), String(a.account_code || '')]));
      
      let incomeTotalAgg = 0;
      let expenseTotalAgg = 0;
      let cogsTotalAgg = 0;
      let opexTotalAgg = 0;
      
      const expenseAggByName: Record<string, number> = {};
      const incomeAggByName: Record<string, number> = {};
      
      // Calculate P&L (Income/Expenses) based on the SELECTED RANGE (ledRange)
      (ledRange || []).forEach((e: any) => {
        const id = String(e.account_id || '');
        const type = (accTypeById.get(id) || '').toLowerCase();
        const name = String(accNameById.get(id) || '').toLowerCase();
        const code = String(accCodeById.get(id) || '');
        const debit = Number(e.debit || 0);
        const credit = Number(e.credit || 0);
        const isIncome = type.includes('income') || type.includes('revenue');
        const isExpense = type.includes('expense') || name.includes('cost of') || code.startsWith('5');
        
        if (isIncome) {
          const val = Math.abs(credit - debit);
          incomeTotalAgg += val;
          const key = accNameById.get(id) || id;
          incomeAggByName[key] = (incomeAggByName[key] || 0) + val;
        } else if (isExpense) {
          const val = Math.abs(debit - credit);
          expenseTotalAgg += val;
          const key = accNameById.get(id) || id;
          expenseAggByName[key] = (expenseAggByName[key] || 0) + val;
          
          const isCogs = name.includes('cost of') || code.startsWith('5000');
          if (isCogs) cogsTotalAgg += val;
          else opexTotalAgg += val;
        }
      });

      // Calculate Balance Sheet (Assets/Liabilities/Equity) based on ALL TIME (bsLedgerEntries)
      let bsAssets = 0;
      let bsLiabilities = 0;
      let bsEquity = 0;

      (bsLedgerEntries || []).forEach((e: any) => {
        const id = String(e.account_id || '');
        const type = (accTypeById.get(id) || '').toLowerCase();
        const debit = Number(e.debit || 0);
        const credit = Number(e.credit || 0);
        
        if (type === 'asset') {
            bsAssets += (debit - credit);
        } else if (type === 'liability') {
            bsLiabilities += (credit - debit);
        } else if (type === 'equity') {
            bsEquity += (credit - debit);
        }
      });
      
      const expenseDonutBreak = Object.entries(expenseAggByName)
        .map(([name, val]) => ({ name, value: Number(val.toFixed(2)) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      const incomeDonutBreak = Object.entries(incomeAggByName)
        .map(([name, val]) => ({ name, value: Number(val.toFixed(2)) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
      setIncomeWheelInner([{ name: 'Expenses', value: expenseTotalAgg }, { name: 'Income', value: incomeTotalAgg }]);
      setExpenseWheelInner([{ name: 'Income', value: incomeTotalAgg }, { name: 'Expenses', value: expenseTotalAgg }]);
      if (expenseDonutBreak.length > 0) setExpenseBreakdown(expenseDonutBreak);
      if (incomeDonutBreak.length > 0) setIncomeBreakdown(incomeDonutBreak);
      
      // Legacy charts logic removed (Top Sales Products & Revenue by Category)

      // Quotes acceptance vs unaccepted over selected range
      try {
        const { data: quotesRows } = await supabase
          .from('quotes')
          .select('created_at, quote_date, status, company_id')
          .eq('company_id', cid);
        const rangeStartIso = months[0].start.toISOString();
        const rangeEndIso = months[months.length - 1].end.toISOString();
        let accepted = 0; let unaccepted = 0;
        (quotesRows || []).forEach((q: any) => {
          const dtIso = new Date(String(q.quote_date || q.created_at || new Date())).toISOString();
          if (dtIso < rangeStartIso || dtIso > rangeEndIso) return;
          const st = String(q.status || '').toLowerCase();
          if (st === 'accepted' || st === 'approved') accepted += 1; else unaccepted += 1;
        });
        setQuotesAcceptanceDonut([
          { name: 'Accepted', value: accepted },
          { name: 'Unaccepted', value: unaccepted }
        ]);
      } catch {}


      const { data: banks } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('company_id', cid);
      const bankBalance = (banks || []).reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);
      const operatingExpenses12 = monthlyData.reduce((sum: number, d: any) => sum + Number(d.expenses || 0), 0);
      const incomeBreakAgg = Object.entries(incAgg).map(([id, val]) => ({ name: nameByIdAll.get(id) || id, value: Number(val.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
      const expenseBreakAgg = Object.entries(expAgg).map(([id, val]) => ({ name: nameByIdAll.get(id) || id, value: Number(val.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
      const newMetrics = {
        totalAssets: bsAssets,
        totalLiabilities: bsLiabilities,
        totalEquity: bsEquity,
        totalIncome: incomeTotalAgg,
        totalExpenses: expenseTotalAgg,
        operatingExpenses: opexTotalAgg,
        bankBalance,
        currentAssets: 0,
        currentLiabilities: 0
      };

      try {
        const { data: budgetRows } = await supabase
          .from('budgets')
          .select('account_id, category, budgeted_amount, status')
          .eq('company_id', cid)
          .eq('budget_year', selectedYear)
          .eq('budget_month', selectedMonth)
          .in('status', ['active','approved']);
        const filteredBudgets = (budgetRows || []).filter((r: any) => ['active','approved'].includes(String(r.status || '').toLowerCase()));
        const accIds = Array.from(new Set((filteredBudgets || []).map((r: any) => String(r.account_id || '')).filter(Boolean)));
        let actualMap: Record<string, number> = {};
        if (accIds.length > 0) {
          const { data: te } = await supabase
            .from('transaction_entries')
            .select(`account_id, debit, credit, status, transactions!inner (transaction_date, company_id, status)`) 
            .eq('transactions.company_id', cid)
            .in('transactions.status', ['posted','approved'])
            .gte('transactions.transaction_date', startDate.toISOString())
            .lte('transactions.transaction_date', endDate.toISOString())
            .eq('status', 'approved');
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_type')
            .eq('company_id', cid)
            .in('id', accIds);
          const typeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
          actualMap = {};
          (te || []).forEach((e: any) => {
            const id = String(e.account_id || '');
            if (!accIds.includes(id)) return;
            const type = (typeById.get(id) || '').toLowerCase();
            const debit = Number(e.debit || 0);
            const credit = Number(e.credit || 0);
            if (type.includes('income') || type.includes('revenue')) {
              actualMap[id] = (actualMap[id] || 0) + Math.abs(credit - debit);
            } else if (type.includes('expense')) {
              actualMap[id] = (actualMap[id] || 0) + Math.abs(debit - credit);
            } else {
              const naturalDebit = type === 'asset' || type === 'expense';
              const bal = naturalDebit ? (debit - credit) : (credit - debit);
              actualMap[id] = (actualMap[id] || 0) + bal;
            }
          });
        }
        const cfBudgets = (filteredBudgets || []).filter((r: any) => String(r.category || '').startsWith('cashflow_'));
        const cfActual = { operating: 0, investing: 0, financing: 0, net: 0 } as any;
        if (cfBudgets.length > 0) {
          const { data: cf } = await supabase.rpc('generate_cash_flow', {
            _company_id: cid,
            _period_start: startDate.toISOString(),
            _period_end: endDate.toISOString()
          });
          if (cf && cf[0]) {
            cfActual.operating = Number((cf[0] as any).operating_activities || 0);
            cfActual.investing = Number((cf[0] as any).investing_activities || 0);
            cfActual.financing = Number((cf[0] as any).financing_activities || 0);
            cfActual.net = Number((cf[0] as any).net_cash_flow || 0);
          }
        }
        let onTrackCount = 0;
        let totalCount = 0;
        (filteredBudgets || []).forEach((r: any) => {
          const budgetAmt = Number(r.budgeted_amount || 0);
          let actualAmt = 0;
          if (r.account_id) {
            actualAmt = Number(actualMap[String(r.account_id)] || 0);
          } else if (String(r.category || '').startsWith('cashflow_')) {
            const key = String(r.category || '').replace('cashflow_', '');
            actualAmt = Number((cfActual as any)[key] || 0);
          }
          const variance = budgetAmt - actualAmt;
          const isOnTrack = variance >= 0;
          totalCount += 1;
          if (isOnTrack) onTrackCount += 1;
        });
        const pctOnTrack = totalCount > 0 ? Math.round((onTrackCount / totalCount) * 100) : 0;
        setBudgetUtilization(pctOnTrack);
        setBudgetOnTrack(pctOnTrack === 100);
      } catch {}

      if ((newMetrics.totalIncome === 0 || newMetrics.totalExpenses === 0) || (newMetrics.totalAssets === 0 && newMetrics.totalLiabilities === 0 && newMetrics.totalEquity === 0)) {
        try {
          const { data: te } = await supabase
            .from('transaction_entries')
            .select(`account_id, debit, credit, transactions!inner (transaction_date, company_id)`) 
            .eq('transactions.company_id', companyId)
            .gte('transactions.transaction_date', startDate.toISOString())
            .lte('transactions.transaction_date', endDate.toISOString());
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_type, account_name, account_code')
            .eq('company_id', companyId)
            .eq('is_active', true);

          const typeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
          const nameById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_name || '')]));
          const codeById = new Map<string, string>((accounts || []).map((a: any) => [String(a.id), String(a.account_code || '')]));

          let inc = 0, exp = 0, opex = 0, assetsSum = 0, liabSum = 0, eqSum = 0;
          (te || []).forEach((e: any) => {
            const id = String(e.account_id);
            const type = (typeById.get(id) || '').toLowerCase();
            const name = String(nameById.get(id) || '').toLowerCase();
            const code = String(codeById.get(id) || '');
            const debit = Number(e.debit || 0);
            const credit = Number(e.credit || 0);
            const naturalDebit = type === 'asset' || type.includes('expense');
            const bal = naturalDebit ? (debit - credit) : (credit - debit);
            if (type.includes('income') || type.includes('revenue')) inc += Math.abs(credit - debit);
            else if (type.includes('expense')) exp += Math.abs(debit - credit);
            if ((type.includes('expense')) && !(name.includes('cost of') || code.startsWith('5000'))) {
              opex += Math.abs(debit - credit);
            }
            else if (type === 'asset') assetsSum += bal;
            else if (type === 'liability') liabSum += bal;
            else if (type === 'equity') eqSum += bal;
          });
          newMetrics.totalIncome = Math.max(Number(newMetrics.totalIncome || 0), Number(inc.toFixed(2)));
          newMetrics.totalExpenses = Math.max(Number(newMetrics.totalExpenses || 0), Number(exp.toFixed(2)));
          newMetrics.operatingExpenses = Math.max(Number(newMetrics.operatingExpenses || 0), Number(opex.toFixed(2)));
          if (newMetrics.totalAssets === 0 && newMetrics.totalLiabilities === 0 && newMetrics.totalEquity === 0) {
            newMetrics.totalAssets = Number(assetsSum.toFixed(2));
            newMetrics.totalLiabilities = Number(liabSum.toFixed(2));
            newMetrics.totalEquity = Number(eqSum.toFixed(2));
          }

          if (monthlyData.every(d => Number(d.income) === 0 && Number(d.expenses) === 0)) {
            const monthlyBuckets: Record<string, { income: number; expenses: number; label: string }> = {};
            months.forEach(m => { const key = m.label; monthlyBuckets[key] = { income: 0, expenses: 0, label: m.label }; });
            (te || []).forEach((e: any) => {
              const dt = new Date(String(e.transactions?.transaction_date || startDate));
              const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
              const type = typeById.get(String(e.account_id)) || '';
              const debit = Number(e.debit || 0);
              const credit = Number(e.credit || 0);
              if (monthlyBuckets[label]) {
                const name = String(nameById.get(String(e.account_id)) || '').toLowerCase();
                const code = codeById.get(String(e.account_id)) || '';
                const isIncome = type.includes('income') || type.includes('revenue');
                const isExpense = type.includes('expense') || name.includes('cost of') || String(code).startsWith('5');
                if (isIncome) monthlyBuckets[label].income += Math.abs(credit - debit);
                else if (isExpense) monthlyBuckets[label].expenses += Math.abs(debit - credit);
              }
            });
      const rebuilt = Object.values(monthlyBuckets);
      setChartData(rebuilt.map(r => ({ month: r.label, income: Number(r.income.toFixed(2)), expenses: Number(r.expenses.toFixed(2)) })));
      setNetProfitTrend(rebuilt.map(r => ({ month: r.label, netProfit: Number((r.income - r.expenses).toFixed(2)) })));
      }

          const incomeMap: Record<string, number> = {};
          const expenseMap: Record<string, number> = {};
          (te || []).forEach((e: any) => {
            const type = typeById.get(String(e.account_id)) || '';
            const debit = Number(e.debit || 0);
            const credit = Number(e.credit || 0);
            if (type === 'income' || type === 'revenue') {
              incomeMap[String(e.account_id)] = (incomeMap[String(e.account_id)] || 0) + Math.abs(credit - debit);
            } else if (type === 'expense') {
              expenseMap[String(e.account_id)] = (expenseMap[String(e.account_id)] || 0) + Math.abs(debit - credit);
            }
          });
          const incomeBreak = Object.entries(incomeMap).map(([id, val]) => ({ name: nameById.get(id) || id, value: Number(val.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
          const expenseBreak = Object.entries(expenseMap).map(([id, val]) => ({ name: nameById.get(id) || id, value: Number(val.toFixed(2)) })).sort((a, b) => b.value - a.value).slice(0, 10);
      setIncomeBreakdown(incomeBreakAgg.length > 0 ? incomeBreakAgg : incomeBreak);
      setExpenseBreakdown(expenseBreakAgg.length > 0 ? expenseBreakAgg : expenseBreak);
      setIncomeWheelInner([{ name: 'Expenses', value: expenseTotalAgg }, { name: 'Income', value: incomeTotalAgg }]);
      setExpenseWheelInner([{ name: 'Income', value: incomeTotalAgg }, { name: 'Expenses', value: expenseTotalAgg }]);

          if (!banks || banks.length === 0) {
            try {
              const bankAccounts = (accounts || []).filter((a: any) => String(a.account_type || '').toLowerCase() === 'asset' && ((String(a.account_name || '').toLowerCase().includes('bank')) || String(a.account_code || '') === '1100'));
              const bankIds = new Set(bankAccounts.map((a: any) => String(a.id)));
              const { data: les } = await supabase
                .from('ledger_entries')
                .select('account_id, debit, credit')
                .eq('company_id', cid)
                .gte('entry_date', startDate.toISOString())
                .lte('entry_date', endDate.toISOString());
              const bb = (les || []).filter((e: any) => bankIds.has(String(e.account_id))).reduce((s: number, e: any) => s + (Number(e.debit || 0) - Number(e.credit || 0)), 0);
              newMetrics.bankBalance = Number(bb.toFixed(2));
            } catch {}
          }
        } catch {}
      }

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, customer_name, total_amount, status, invoice_date, due_date')
        .eq('company_id', cid)
        .gte('invoice_date', rangeStart.toISOString())
        .lte('invoice_date', endDate.toISOString());
      const unpaidStatuses = new Set(['unpaid','pending','partial','sent','overdue','open']);
      const today = new Date();
      const apStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const arByCustomer: Record<string, number> = {};
      let arUnpaid = 0, arOver30 = 0, arOver90 = 0, arUnder30 = 0;
      (invoices || []).forEach((inv: any) => {
        const amt = Number(inv.total_amount || 0);
        const isUnpaid = unpaidStatuses.has(String(inv.status || '').toLowerCase());
        if (isUnpaid) {
          const name = String(inv.customer_name || 'Unknown');
          arByCustomer[name] = (arByCustomer[name] || 0) + amt;
          arUnpaid += amt;
          const due = inv.due_date ? new Date(String(inv.due_date)) : null;
          if (due) {
            const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 90) arOver90 += amt;
            else if (diffDays > 30) arOver30 += amt;
            else if (diffDays > 0) arUnder30 += amt;
          }
        }
      });
      const arTop = Object.entries(arByCustomer).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 10);
      setArTop10(arTop);
      setArDonut(arTop.map(r => ({ name: r.name, value: Number(r.amount.toFixed(2)) })));
      setArKpis({ unpaidTotal: Number(arUnpaid.toFixed(2)), overdueTotal: Number((arUnder30 + arOver30 + arOver90).toFixed(2)), overdueUnder30Total: Number(arUnder30.toFixed(2)), overdue30Total: Number(arOver30.toFixed(2)), overdue90Total: Number(arOver90.toFixed(2)) });

      const { data: purchases } = await supabase
        .from('purchase_orders')
        .select('id, supplier_id, supplier_name, po_number, total_amount, status, po_date, due_date')
        .eq('company_id', cid)
        .gte('po_date', apStart.toISOString())
        .lte('po_date', endDate.toISOString());
      const { data: bills } = await supabase
        .from('bills')
        .select('id, supplier_name, total_amount, status, bill_date, due_date')
        .eq('company_id', cid)
        .gte('bill_date', rangeStart.toISOString())
        .lte('bill_date', endDate.toISOString());

      const purchaseMonthly: any[] = [];
      months.forEach(m => {
        let sum = 0;
        (bills || []).forEach((b: any) => {
          const d = new Date(String(b.bill_date || new Date()));
          if (d >= m.start && d <= m.end) sum += Number(b.total_amount || 0);
        });
        purchaseMonthly.push({ month: m.label, amount: Number(sum.toFixed(2)) });
      });
      setPurchaseTrend(purchaseMonthly);
      const supplierIds = Array.from(new Set([
        ...(purchases || []).map((p: any) => p.supplier_id).filter(Boolean),
      ]));
      const nameMap: Record<string, string> = {};
      if (supplierIds.length > 0) {
        const { data: supps } = await supabase
          .from('suppliers')
          .select('id, name')
          .in('id', supplierIds);
        (supps || []).forEach((s: any) => { nameMap[String(s.id)] = String(s.name || 'Unknown'); });
      }
      const poNumbers = (purchases || []).map((p: any) => p.po_number).filter(Boolean);
      const payMap: Record<string, number> = {};
      if (poNumbers.length > 0) {
        const { data: pays } = await supabase
          .from('transactions')
          .select('reference_number, total_amount, transaction_type, status')
          .in('reference_number', poNumbers)
          .eq('transaction_type', 'payment')
          .in('status', ['posted','approved']);
        (pays || []).forEach((t: any) => {
          const ref = String(t.reference_number || '');
          payMap[ref] = (payMap[ref] || 0) + Number(t.total_amount || 0);
        });
      }
      const rows: Array<{ supplier_name: string; outstanding: number; source: string; due_date?: string | null }> = [];
      (bills || []).forEach((b: any) => {
        const status = String(b.status || '').toLowerCase();
        if (['paid','cancelled'].includes(status)) return;
        const supplierName = String(b.supplier_name || 'Unknown');
        rows.push({ supplier_name: supplierName, outstanding: Number(b.total_amount || 0), source: 'bills', due_date: b.due_date || null });
      });
      (purchases || []).forEach((po: any) => {
        const total = Number(po.total_amount || 0);
        const paidAmt = payMap[String(po.po_number || '')] || 0;
        const outstanding = Math.max(0, total - paidAmt);
        if (String(po.status).toLowerCase() === 'paid' || outstanding <= 0) return;
        const supplierName = nameMap[String(po.supplier_id)] || String(po.supplier_name || 'Unknown');
        rows.push({ supplier_name: supplierName, outstanding, source: 'purchase_orders', due_date: po.due_date || null });
      });
      const totalsMap = new Map<string, { name: string; amount: number }>();
      rows.forEach(r => {
        const key = r.supplier_name || 'Unknown';
        const curr = totalsMap.get(key) || { name: key, amount: 0 };
        curr.amount += r.outstanding || 0;
        totalsMap.set(key, curr);
      });
      const apTop = Array.from(totalsMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 10);
      setApTop10(apTop);
      const totalOutstanding = rows.reduce((sum, r) => sum + (r.outstanding || 0), 0) || 1;
      const donutBuckets = new Map<string, { name: string; value: number }>();
      rows.forEach(r => {
        const key = r.supplier_name || 'Unknown';
        const curr = donutBuckets.get(key) || { name: key, value: 0 };
        curr.value += r.outstanding || 0;
        donutBuckets.set(key, curr);
      });
      const apAll = Array.from(donutBuckets.values()).map(b => ({ name: b.name, value: Number(b.value.toFixed(2)), pct: (b.value / totalOutstanding) * 100 }));
      setApDonut(apAll);
      const nowIso = new Date().toISOString().split('T')[0];
      const unpaidTotal = rows.reduce((sum, r) => sum + (r.outstanding || 0), 0);
      const overdueBills = rows.filter(r => r.source === 'bills' && r.outstanding > 0 && r.due_date && String(r.due_date) < nowIso);
      const overdueTotal = overdueBills.reduce((sum, r) => sum + (r.outstanding || 0), 0);
      const overdueUnder30 = overdueBills.filter(r => {
        const d = r.due_date ? Math.floor((new Date(nowIso).getTime() - new Date(String(r.due_date)).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return d > 0 && d <= 30;
      });
      const overdue30 = overdueBills.filter(r => {
        const d = r.due_date ? Math.floor((new Date(nowIso).getTime() - new Date(String(r.due_date)).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return d >= 31 && d < 90;
      });
      const overdue90 = overdueBills.filter(r => {
        const d = r.due_date ? Math.floor((new Date(nowIso).getTime() - new Date(String(r.due_date)).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return d >= 90;
      });
      setApKpis({
        unpaidTotal: Number(unpaidTotal.toFixed(2)),
        overdueTotal: Number(overdueTotal.toFixed(2)),
        overdueUnder30Total: Number(overdueUnder30.reduce((s, r) => s + (r.outstanding || 0), 0).toFixed(2)),
        overdue30Total: Number(overdue30.reduce((s, r) => s + (r.outstanding || 0), 0).toFixed(2)),
        overdue90Total: Number(overdue90.reduce((s, r) => s + (r.outstanding || 0), 0).toFixed(2))
      });

      // Calculate Purchase Trend
      const pBuckets: Record<string, number> = {};
      months.forEach(m => { pBuckets[m.label] = 0; });
      (purchases || []).forEach((po: any) => {
        const dt = new Date(String(po.po_date || endDate));
        const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
        if (pBuckets[label] !== undefined) pBuckets[label] += Number(po.total_amount || 0);
      });
      (bills || []).forEach((b: any) => {
        const dt = new Date(String(b.bill_date || endDate));
        const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
        if (pBuckets[label] !== undefined) pBuckets[label] += Number(b.total_amount || 0);
      });
      const pTrendData = months.map(m => ({ month: m.label, amount: Number(pBuckets[m.label].toFixed(2)) }));
      setPurchaseTrend(pTrendData);

      if (monthlyData.every(d => Number(d.income) === 0 && Number(d.expenses) === 0)) {
        const invBuckets: Record<string, number> = {};
        const poBuckets: Record<string, number> = {};
        const billBuckets: Record<string, number> = {};
        months.forEach(m => { invBuckets[m.label] = 0; poBuckets[m.label] = 0; billBuckets[m.label] = 0; });
        (invoices || []).forEach((inv: any) => {
          const dt = new Date(String(inv.invoice_date || inv.sent_at || endDate));
          const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
          if (invBuckets[label] !== undefined) invBuckets[label] += Number(inv.total_amount || 0);
        });
        (purchases || []).forEach((po: any) => {
          const dt = new Date(String(po.po_date || po.due_date || endDate));
          const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
          if (poBuckets[label] !== undefined) poBuckets[label] += Number(po.total_amount || 0);
        });
        (bills || []).forEach((b: any) => {
          const dt = new Date(String(b.bill_date || b.due_date || endDate));
          const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
          if (billBuckets[label] !== undefined) billBuckets[label] += Number(b.total_amount || 0);
        });
        const altMonthly = months.map(m => ({ month: m.label, income: Number((invBuckets[m.label] || 0).toFixed(2)), expenses: Number(((poBuckets[m.label] || 0) + (billBuckets[m.label] || 0)).toFixed(2)) }));
        setChartData(altMonthly);
        setNetProfitTrend(altMonthly.map(r => ({ month: r.month, netProfit: Number((r.income - r.expenses).toFixed(2)) })));
      }
      // Fallback: if expense metric still zero, derive from purchase orders total
      if (newMetrics.totalExpenses === 0 || newMetrics.operatingExpenses === 0) {
        const purchasesMonthSum = (purchases || [])
          .filter((po: any) => {
            const dt = new Date(String(po.po_date || endDate));
            return dt >= startDate && dt <= endDate;
          })
          .reduce((s: number, po: any) => s + Number(po.total_amount || 0), 0);
        const billsMonthSum = (bills || [])
          .filter((b: any) => {
            const dt = new Date(String(b.bill_date || endDate));
            return dt >= startDate && dt <= endDate;
          })
          .reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0);
        const combined = purchasesMonthSum + billsMonthSum;
        if (combined > 0) {
          newMetrics.totalExpenses = Math.max(Number(newMetrics.totalExpenses || 0), Number(combined.toFixed(2)));
          newMetrics.operatingExpenses = Math.max(Number(newMetrics.operatingExpenses || 0), Number(combined.toFixed(2)));
        }
      }
      const expFromBreakdown = (expenseSorted || []).reduce((s: number, r: any) => s + Number(r.value || 0), 0);
      if (newMetrics.totalExpenses === 0 && expFromBreakdown > 0) {
        newMetrics.totalExpenses = Number(expFromBreakdown.toFixed(2));
      }
      setMetrics(newMetrics);
      try {
        const { data: products } = await supabase
          .from('items')
          .select('name, quantity_on_hand, item_type')
          .eq('company_id', cid)
          .eq('item_type', 'product');
        const stocks = (products || [])
          .map((p: any) => ({ name: String(p.name || 'Unknown'), qty: Number(p.quantity_on_hand || 0) }))
          .sort((a, b) => a.qty - b.qty)
          .slice(0, 10);
        setInventoryLevels(stocks);
      } catch {}
      const bsBuckets: Record<string, { assets: number; liabilities: number; equity: number; label: string }> = {};
      months.forEach(m => { bsBuckets[m.label] = { assets: 0, liabilities: 0, equity: 0, label: m.label }; });
      (teRange || []).forEach((e: any) => {
        const dt = new Date(String(e.transactions?.transaction_date || new Date()));
        const label = dt.toLocaleDateString('en-ZA', { month: 'short' });
        if (!bsBuckets[label]) return;
        const id = String(e.account_id || '');
        const type = (typeByIdAll.get(id) || '').toLowerCase();
        const debit = Number(e.debit || 0);
        const credit = Number(e.credit || 0);
        if (type === 'asset') bsBuckets[label].assets += (debit - credit);
        else if (type === 'liability') bsBuckets[label].liabilities += (credit - debit);
        else if (type === 'equity') bsBuckets[label].equity += (credit - debit);
      });
      const bsSeries = Object.values(bsBuckets).map(r => ({ label: r.label, assets: Number(r.assets.toFixed(2)), liabilities: Number(r.liabilities.toFixed(2)), equity: Number(r.equity.toFixed(2)) }));
      setBsComposition(bsSeries);
      const min = Math.max(10000, Number(newMetrics.operatingExpenses || 0));
      setSafeMinimum(min);
      const cashPct = min > 0 ? Math.min(100, Math.max(0, (Number(newMetrics.bankBalance || 0) / min) * 100)) : 0;
      setCashGaugePct(Number(cashPct.toFixed(0)));
      setCashOnTrack(Number(newMetrics.bankBalance || 0) >= min);
      setLoading(false);
      loadingRef.current = false;
      reloadErrorCountRef.current = 0;
      dashboardCache.set(cacheKey, String(cid), {
        metrics: newMetrics,
        recentTransactions: recent,
        chartData: monthlyData,
        netProfitTrend: netTrend,
        incomeBreakdown,
        expenseBreakdown,
        arTop10: arTop,
        apTop10: apTop,
        arDonut: arTop.map((r: any) => ({ name: r.name, value: Number(r.amount.toFixed(2)) })),
        apDonut: apTop.map((r: any) => ({ name: r.name, value: Number(r.amount.toFixed(2)) })),
      });
    } catch (error) {
      setLoading(false);
      loadingRef.current = false;
      reloadErrorCountRef.current += 1;
      const msg = (error as any)?.message ? String((error as any).message) : "Failed to load dashboard";
      toast({ title: "Dashboard load failed", description: msg, variant: "destructive" });
    }
  }, [selectedMonth, selectedYear, chartMonths, fetchTrialBalanceForPeriod, getCalendarYearForFiscalPeriod]);

  useEffect(() => {
    if (fiscalLoading) return;
    loadDashboardData();
  }, [selectedMonth, selectedYear, fiscalLoading, loadDashboardData]);

  useEffect(() => {
    const onInvalidated = (e: any) => {
      const cid = e?.detail?.companyId ? String(e.detail.companyId) : "";
      if (cid && companyId && cid !== companyId) return;
      if (!loadingRef.current) {
        loadDashboardData({ force: true });
      }
    };
    window.addEventListener("rigel-dashboard-cache-invalidated", onInvalidated as any);
    return () => window.removeEventListener("rigel-dashboard-cache-invalidated", onInvalidated as any);
  }, [companyId, loadDashboardData]);

  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
  }, [widgets]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleWidget = (widget: string) => {
    setWidgets((prev: any) => ({ ...prev, [widget]: !prev[widget] }));
  };

  const metricCards = [
    {
      title: "Total Assets",
      value: `R ${metrics.totalAssets.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: Building2,
      color: "text-blue-600",
      gradient: "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background border-blue-200/50"
    },
    {
      title: "Total Liabilities",
      value: `R ${metrics.totalLiabilities.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: FileText,
      color: "text-red-600",
      gradient: "bg-gradient-to-br from-red-500/10 via-red-500/5 to-background border-red-200/50"
    },
    {
      title: "Total Equity",
      value: `R ${(metrics.totalAssets - metrics.totalLiabilities).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: Briefcase,
      color: "text-purple-600",
      gradient: "bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background border-purple-200/50"
    },
    {
      title: "Total Income",
      value: `R ${metrics.totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-emerald-600",
      gradient: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background border-emerald-200/50"
    },
    {
      title: "Operating Expenses",
      value: `(R ${metrics.operatingExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`,
      icon: TrendingDown,
      color: "text-amber-600",
      gradient: "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background border-amber-200/50"
    },
    {
      title: "Bank Balance",
      value: `R ${metrics.bankBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: CreditCard,
      color: "text-cyan-600",
      gradient: "bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-background border-cyan-200/50"
    }
  ];

  const COLORS = [
    '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#EC4899', '#F43F5E', '#10B981'
  ];
  const PRODUCT_COLORS = [
    '#0EA5E9', '#F97316', '#22C55E', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#84CC16', '#EC4899', '#10B981'
  ];
  const QUOTE_COLORS = ['#22C55E', '#EF4444'];
  const POS_COLORS = ['#22C55E', '#10B981', '#06B6D4', '#3B82F6'];
  const NEG_COLORS = ['#EF4444', '#F97316', '#DC2626', '#F43F5E'];
  const [expenseWheelInner, setExpenseWheelInner] = useState<any[]>([]);
  const [incomeWheelInner, setIncomeWheelInner] = useState<any[]>([]);
  const [incomeWheelOuter, setIncomeWheelOuter] = useState<any[]>([]);
  const [quotesAcceptanceDonut, setQuotesAcceptanceDonut] = useState<Array<{ name: string; value: number }>>([]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card-professional border rounded-lg p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-3 w-28 mt-3" />
            </div>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card-professional border rounded-lg p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="card-professional border rounded-lg p-4">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome {userName}, {currentTime.toLocaleDateString('en-US', { weekday: 'long' })} {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-background p-1.5 rounded-md border shadow-sm">
            <div className="flex items-end gap-0.5 h-5">
              <div className={`w-1 rounded-sm ${sbStrength >= 1 ? 'bg-green-500' : 'bg-muted'} h-2`} />
              <div className={`w-1 rounded-sm ${sbStrength >= 2 ? 'bg-green-500' : 'bg-muted'} h-3`} />
              <div className={`w-1 rounded-sm ${sbStrength >= 3 ? 'bg-green-500' : 'bg-muted'} h-4`} />
            </div>
            <div className="text-xs">
              {sbStatus === 'online' ? 'Supabase Online' : sbStatus === 'connecting' ? 'Connecting…' : 'Supabase Offline'}
            </div>
            {sbLatency !== null && (
              <div className="text-[10px] text-muted-foreground">{sbLatency}ms</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const monthIndex = (fiscalStartMonth - 1 + i) % 12;
                  const monthNum = monthIndex + 1;
                  const date = new Date(2000, monthIndex, 1);
                  return (
                    <SelectItem key={monthNum} value={monthNum.toString()}>
                      {date.toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(value) => { const y = parseInt(value); setSelectedYear(y); setSelectedFiscalYear(y); }}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <SelectItem key={year} value={year.toString()}>{fiscalStartMonth === 1 ? year : `FY ${year}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={chartMonths.toString()} onValueChange={(value) => setChartMonths(parseInt(value))}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Months" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <SelectItem key={m} value={m.toString()}>{m} months</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            {new Date(getCalendarYearForFiscalPeriod(selectedYear, selectedMonth), selectedMonth - 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })} • {chartMonths} months
          </Badge>
          <FinancialHealthInsight metrics={metrics} />
          <DashboardCalendar />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Customize Dashboard</SheetTitle>
                <SheetDescription>
                  Toggle widgets to personalize your dashboard view
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                {Object.entries(widgets).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label htmlFor={key} className="flex items-center gap-2 cursor-pointer">
                      {value ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                    <Switch
                      id={key}
                      checked={value as boolean}
                      onCheckedChange={() => toggleWidget(key)}
                    />
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Key Metrics - Accounting Elements */}
      {widgets.metrics && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {metricCards.map((metric) => (
            <Card key={metric.title} className={`card-professional border-l-4 transition-all duration-300 hover:-translate-y-1 ${metric.color.replace('text-', 'border-')} ${metric.gradient}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`p-2 rounded-full bg-white/50 backdrop-blur-sm shadow-sm ${metric.color}`}>
                  <metric.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold tracking-tight ${metric.color}`}>{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">+2.5% from last month</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Purchase Trend (Last 6 Months) */}
        <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              Purchase Trend (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={purchaseTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                <Tooltip 
                  formatter={(value: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, 'Purchases']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} 
                />
                <Legend />
                <Bar dataKey="amount" name="Purchases" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {purchaseTrend.length === 0 && (
              <div className="text-sm text-muted-foreground mt-2">No purchase data found</div>
            )}
          </CardContent>
        </Card>

        {/* Unpaid Purchases % by Supplier */}
        <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              Unpaid Purchases % by Supplier
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={apDonut} 
                  dataKey="value" 
                  nameKey="name" 
                  innerRadius={60} 
                  outerRadius={100} 
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {apDonut.map((entry, index) => (
                    <Cell key={`cell-ap-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any, name: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, name]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} 
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            {apDonut.length === 0 && (
               <div className="text-sm text-muted-foreground mt-2">No unpaid purchases found</div>
            )}
          </CardContent>
        </Card>

        {/* Unpaid Purchases Amount (Top 10 Suppliers) */}
        <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              Unpaid Purchases Amount (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={apTop10} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  formatter={(value: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, 'Unpaid Amount']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} 
                />
                <Legend />
                <Bar dataKey="amount" name="Unpaid Amount" radius={[0, 4, 4, 0]}>
                  {apTop10.map((entry, index) => (
                    <Cell key={`ap-bar-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {apTop10.length === 0 && (
               <div className="text-sm text-muted-foreground mt-2">No unpaid purchases found</div>
            )}
          </CardContent>
        </Card>

        {widgets.incomeVsExpense && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex items-center justify-between border-b bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                {`Income vs Expenses (${chartMonths} months)`}
                </CardTitle>
              </CardHeader>
            <CardContent className="pt-6">
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
                  >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} domain={["dataMin", "dataMax"]} />
                  <Tooltip 
                    formatter={(value: any, name: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, name === 'income' ? 'Income' : 'Expenses']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              </div>
              {chartData.length === 0 && incomeBreakdown.length === 0 && expenseBreakdown.length === 0 && (
                <div className="text-sm text-muted-foreground mt-2">No income/expense data for the selected period</div>
              )}
            </CardContent>
          </Card>
        )}
        {widgets.netProfit && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                Net Profit Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={netProfitTrend} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} domain={["dataMin", "dataMax"]} />
                  <Tooltip 
                    formatter={(value: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, 'Net Profit']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="#10B981" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
              {netProfitTrend.length === 0 && (
                <div className="text-sm text-muted-foreground mt-2">No profit data for the selected period</div>
              )}
            </CardContent>
          </Card>
        )}
        {widgets.incomeExpense && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                Income
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                <Pie
                  data={incomeWheelInner}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={50}
                  label={({ name, percent = 0 }) => `${name}: ${Math.round((percent || 0) * 100)}%`}
                  dataKey="value"
                >
                    {incomeWheelInner.map((entry, index) => (
                      <Cell key={`income-inner-${index}`} fill={index === 0 ? '#3B82F6' : '#22C55E'} />
                    ))}
                </Pie>
                  <Pie
                    data={incomeBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    label={({ name, percent = 0 }) => `${name}: ${Math.round((percent || 0) * 100)}%`}
                    dataKey="value"
                  >
                    {incomeBreakdown.map((entry, index) => (
                      <Cell key={`income-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, name]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              {incomeBreakdown.length === 0 && (
                <div className="text-sm text-muted-foreground mt-2">No income data for the selected period</div>
              )}
            </CardContent>
          </Card>
        )}

        {widgets.inventoryStock && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                Inventory Stock Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={inventoryLevels} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={160} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [Number(v).toLocaleString('en-ZA'), 'Qty']} />
                  <Legend />
                  <Bar dataKey="qty" name="Qty" radius={[4,4,0,0]}>
                    {inventoryLevels.map((entry, index) => (
                      <Cell key={`inv-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {inventoryLevels.length === 0 && (
                <div className="text-sm text-muted-foreground mt-2">No inventory items</div>
              )}
            </CardContent>
          </Card>
        )}


        {widgets.expenseBreakdown && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-accent" />
                </div>
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseWheelInner}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    label={({ name, percent = 0 }) => `${name}: ${Math.round((percent || 0) * 100)}%`}
                    dataKey="value"
                  >
                    {expenseWheelInner.map((entry, index) => (
                      <Cell key={`inner-${index}`} fill={index === 0 ? '#EF4444' : '#10B981'} />
                    ))}
                  </Pie>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    dataKey="value"
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, name]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.bsComposition && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                Balance Sheet Composition
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={bsComposition}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any, n: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, n]} />
                  <Legend />
                  <Bar dataKey="assets" name="Assets" fill="#10B981" radius={[8,8,0,0]} />
                  <Bar dataKey="liabilities" name="Liabilities" fill="#EF4444" radius={[8,8,0,0]} />
                  <Line type="monotone" dataKey="equity" stroke="#3B82F6" strokeWidth={2} name="Equity" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        

        {widgets.arOverview && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                AR Unpaid (Top Customers)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={arTop10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Unpaid']} />
                  <Legend />
                  <Bar dataKey="amount" name="Unpaid" radius={[4, 4, 0, 0]}>
                    {arTop10.map((entry, index) => (
                      <Cell key={`ar-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}


        {widgets.assetTrend && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              Fixed Assets Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={assetTrend} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <defs>
                    <linearGradient id="nbvBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#16A34A" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                  <Tooltip
                    formatter={(value: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, 'Net Book Value']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                  />
                  <Legend />
                  <Bar dataKey="nbv" name="Net Book Value" fill="url(#nbvBar)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.cashGauge && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                Cash Position Gauge
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-6">
                <DashboardCashGauge percentage={cashGaugePct} onTrack={cashOnTrack} />
              </div>
              <div className="text-xs text-muted-foreground text-center">Safe minimum: R {safeMinimum.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} • Current: R {metrics.bankBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        )}

        {widgets.arOverview && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                Unpaid invoices percentage by customer
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={arDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {arDonut.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any, _n, p: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, p?.payload?.name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.purchaseTrend && (
          <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                Purchase Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={purchaseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                  <Tooltip
                    formatter={(value: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, 'Purchases']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="amount" name="Purchases" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.apOverview && (
          <>
            <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  Unpaid Purchases % by Supplier
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={apDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                      {apDonut.map((entry, index) => (
                        <Cell key={`ap-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any, _n, p: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, p?.payload?.name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  Unpaid Purchases Amount (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={apTop10} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Unpaid']} />
                    <Legend />
                    <Bar dataKey="amount" name="Unpaid" radius={[4, 4, 0, 0]}>
                      {apTop10.map((entry, index) => (
                        <Cell key={`ap-top-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              Cost Structure (COGS vs OPEX)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {costStructure.length === 0 ? (
              <div className="text-sm text-muted-foreground">No expense data in selected range</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={costStructure}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`R ${Number(value).toLocaleString('en-ZA')}`, '']} />
                  <Legend />
                  <Bar dataKey="cogs" stackId="cost" fill="#F97316" name="COGS" radius={[0,0,0,0]} />
                  <Bar dataKey="opex" stackId="cost" fill="#F59E0B" name="Operating Expenses" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              Profitability Margins
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {profitMargins.length === 0 ? (
              <div className="text-sm text-muted-foreground">No profit data in selected range</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={profitMargins}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${Number(v).toFixed(0)}%`} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`${Number(v).toFixed(1)}%`, '']} />
                  <Legend />
                  <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="netMargin" name="Net Margin %" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              Quotes Accepted vs Unaccepted
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={quotesAcceptanceDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                  {quotesAcceptanceDonut.map((entry, index) => (
                    <Cell key={`cell-q-${index}`} fill={QUOTE_COLORS[index % QUOTE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any, _n, p: any) => [Number(v), p?.payload?.name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent & Summary at End */}
      <div className="grid gap-6 lg:grid-cols-2">
          {widgets.trialBalance && (
            <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Receipt className="h-5 w-5 text-primary" />
                  </div>
                  Trial Balance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Total Debits</span>
                    <span className="font-bold text-primary">
                      R {(metrics.totalAssets + metrics.totalExpenses).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors">
                    <span className="font-medium">Total Credits</span>
                    <span className="font-bold text-accent">
                      R {(metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded bg-muted hover:bg-muted/80 transition-colors">
                    <span className="font-bold">Difference</span>
                    <span className={`font-bold ${
                      Math.abs((metrics.totalAssets + metrics.totalExpenses) - (metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome)) < 0.01
                        ? 'text-primary'
                        : 'text-destructive'
                    }`}>
                      R {Math.abs((metrics.totalAssets + metrics.totalExpenses) - (metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="mt-6 grid gap-2">
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/trial-balance')}>View Trial Balance</Button>
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => navigate('/reports')}>Generate Reports</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {widgets.recentTransactions && (
            <Card className="card-professional shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  Live Bank Feed
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 animate-pulse">
                  ● Live
                </Badge>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-md border">
                  <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 font-medium text-xs text-muted-foreground border-b">
                    <div className="col-span-2">Date</div>
                    <div className="col-span-6">Description</div>
                    <div className="col-span-2 text-right">Amount</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {recentTransactions.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No recent transactions found
                      </div>
                    ) : (
                      recentTransactions.map((tx) => (
                        <div key={tx.id} className="grid grid-cols-12 gap-4 p-3 border-b last:border-0 hover:bg-muted/30 transition-colors items-center text-sm">
                          <div className="col-span-2 text-muted-foreground text-xs">{tx.date}</div>
                          <div className="col-span-6 font-medium truncate" title={tx.description}>
                            {tx.description || 'Uncategorized Transaction'}
                          </div>
                          <div className={`col-span-2 text-right font-medium ${tx.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                            {tx.type === 'income' ? '+' : ''} R {Number(tx.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="col-span-2 flex justify-center">
                            <Badge variant={tx.status === 'posted' || tx.status === 'approved' ? 'default' : 'secondary'} className="text-[10px] h-5 px-2">
                              {tx.status === 'posted' || tx.status === 'approved' ? 'Cleared' : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => navigate('/transactions')} className="text-xs">
                    View All Transactions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
};

const DashboardBudgetGauge = ({ percentage, onTrack }: { percentage: number; onTrack: boolean }) => {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2 + 20;
  const r = size / 2 - 20;
  const start = -Math.PI / 2;
  const end = Math.PI / 2;
  const safePct = isNaN(percentage) ? 0 : percentage;
  const pct = Math.max(0, Math.min(100, safePct));
  const ang = start + (pct / 100) * (end - start);
  const nx = cx + r * Math.cos(ang);
  const ny = cy + r * Math.sin(ang);
  const color = pct <= 50 ? '#22c55e' : pct <= 80 ? '#f59e0b' : '#ef4444';
  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const a = start + (i / 10) * (end - start);
    const x1 = cx + (r - 10) * Math.cos(a);
    const y1 = cy + (r - 10) * Math.sin(a);
    const x2 = cx + r * Math.cos(a);
    const y2 = cy + r * Math.sin(a);
    return { x1, y1, x2, y2, i };
  });
  const sx = cx + r * Math.cos(start);
  const sy = cy + r * Math.sin(start);
  const ex = cx + r * Math.cos(ang);
  const ey = cy + r * Math.sin(ang);
  return (
    <svg width={size} height={size / 2 + 60} viewBox={`0 0 ${size} ${size / 2 + 60}`}>
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth={12} />
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke={"url(#gaugeGradient)"} strokeWidth={12} strokeLinecap="round" />
      {ticks.map((t) => (
        <line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#9ca3af" strokeWidth={t.i % 5 === 0 ? 3 : 1.5} />
      ))}
      <circle cx={cx} cy={cy} r={6} fill="#374151" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={4} />
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="20" fill={color}>{`${pct.toFixed(0)}%`}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="12" fill="#6b7280">{onTrack ? 'On Track' : 'Over Budget'}</text>
    </svg>
  );
};

const DashboardCashGauge = ({ percentage, onTrack }: { percentage: number; onTrack: boolean }) => {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2 + 20;
  const r = size / 2 - 20;
  const start = -Math.PI / 2;
  const end = Math.PI / 2;
  const safePct = isNaN(percentage) ? 0 : percentage;
  const pct = Math.max(0, Math.min(100, safePct));
  const ang = start + (pct / 100) * (end - start);
  const nx = cx + r * Math.cos(ang);
  const ny = cy + r * Math.sin(ang);
  const color = pct <= 50 ? '#22c55e' : pct <= 80 ? '#f59e0b' : '#ef4444';
  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const a = start + (i / 10) * (end - start);
    const x1 = cx + (r - 10) * Math.cos(a);
    const y1 = cy + (r - 10) * Math.sin(a);
    const x2 = cx + r * Math.cos(a);
    const y2 = cy + r * Math.sin(a);
    return { x1, y1, x2, y2, i };
  });
  const sx = cx + r * Math.cos(start);
  const sy = cy + r * Math.sin(start);
  const ex = cx + r * Math.cos(ang);
  const ey = cy + r * Math.sin(ang);
  return (
    <svg width={size} height={size / 2 + 60} viewBox={`0 0 ${size} ${size / 2 + 60}`}>
      <defs>
        <linearGradient id="cashGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth={12} />
      <path d={`M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke={"url(#cashGaugeGradient)"} strokeWidth={12} strokeLinecap="round" />
      {ticks.map((t) => (
        <line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#9ca3af" strokeWidth={t.i % 5 === 0 ? 3 : 1.5} />
      ))}
      <circle cx={cx} cy={cy} r={6} fill="#374151" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={4} />
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="20" fill={color}>{`${pct.toFixed(0)}%`}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="12" fill="#6b7280">{onTrack ? 'Healthy' : 'Below Minimum'}</text>
    </svg>
  );
};
