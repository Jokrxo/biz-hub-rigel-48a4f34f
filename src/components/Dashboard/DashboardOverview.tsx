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
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { calculateDepreciation } from "@/components/FixedAssets/DepreciationCalculator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DashboardOverview = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalIncome: 0,
    totalExpenses: 0,
    operatingExpenses: 0,
    bankBalance: 0
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
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
  const [firstRun, setFirstRun] = useState<{ hasCoa: boolean; hasBank: boolean; hasProducts: boolean; hasCustomers: boolean; hasSuppliers: boolean; hasEmployees: boolean }>({ hasCoa: true, hasBank: true, hasProducts: true, hasCustomers: true, hasSuppliers: true, hasEmployees: true });
  const [userName, setUserName] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [chartMonths, setChartMonths] = useState<number>(6);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
  const loadingRef = useRef(false);
  
  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
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
      budgetGauge: true,
    };
    const saved = localStorage.getItem('dashboardWidgets');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...defaultWidgets, ...parsed };
  });

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
          transaction_date
        )
      `)
      .eq('transactions.company_id', companyId)
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
      let balance = naturalDebit ? (sumDebit - sumCredit) : (sumCredit - sumDebit);
      if (acc.account_code === '1300') { balance = totalInventoryValue; }
      const isInventoryName = (acc.account_name || '').toLowerCase().includes('inventory');
      const isPrimaryInventory = acc.account_code === '1300';
      const shouldShow = Math.abs(balance) > 0.01 && (!isInventoryName || isPrimaryInventory);
      if (shouldShow) { trialBalance.push({ account_id: acc.id, account_code: acc.account_code, account_name: acc.account_name, account_type: acc.account_type, balance }); }
    });
    return trialBalance;
  }, [calculateTotalInventoryValue]);

  const loadDashboardData = useCallback(async () => {
    try {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { setLoading(false); return; }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id, first_name, last_name")
        .eq("user_id", user.id)
        .single();
      if (profileError || !profile) { setLoading(false); return; }
      setCompanyId(String(profile.company_id));
      const fullName = [String(profile.first_name || '').trim(), String(profile.last_name || '').trim()].filter(Boolean).join(' ');
      setUserName(fullName || (user.user_metadata?.name as string) || user.email || "");
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
      const rangeStart = new Date(selectedYear, selectedMonth - chartMonths, 1);
      const cacheKey = `db-cache-${String(profile.company_id)}-${selectedYear}-${selectedMonth}-${chartMonths}m`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const c = JSON.parse(cached);
          if (c?.metrics) setMetrics(c.metrics);
          if (c?.recentTransactions) setRecentTransactions(c.recentTransactions);
          if (c?.chartData) setChartData(c.chartData);
          if (c?.netProfitTrend) setNetProfitTrend(c.netProfitTrend);
          if (c?.plTrend) setPlTrend(c.plTrend);
        }
      } catch {}
      const hadCache = !!localStorage.getItem(cacheKey);
      if (!hadCache) setLoading(true);
      const txPromise = supabase
        .from("transactions")
        .select(`
          id,
          reference_number,
          description,
          total_amount,
          transaction_date,
          transaction_type,
          status
        `)
        .eq("company_id", profile.company_id)
        .gte("transaction_date", rangeStart.toISOString())
        .lte("transaction_date", endDate.toISOString())
        .order("transaction_date", { ascending: false });
      const tbPromise = fetchTrialBalanceForPeriod(String(profile.company_id), startDate.toISOString(), endDate.toISOString());
      const [txRes, trialBalance] = await Promise.all([txPromise, tbPromise]);
      if ((txRes as any)?.error) throw (txRes as any).error;
      const transactions = (txRes as any)?.data || [];
      const recent = (transactions || []).slice(0, 10).map((t: any) => ({
        id: String(t.reference_number || t.id || ''),
        description: String(t.description || ''),
        date: new Date(String(t.transaction_date || new Date())).toLocaleDateString('en-ZA'),
        type: ['sales','income','asset_disposal','invoice'].includes(String(t.transaction_type || '').toLowerCase()) ? 'income' : 'expense',
        amount: `R ${Number(t.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
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
          .eq('transactions.company_id', profile.company_id)
          .gte('transactions.transaction_date', startDate.toISOString())
          .lte('transactions.transaction_date', endDate.toISOString());
        const { data: accounts } = await supabase
          .from('chart_of_accounts')
          .select('id, account_type, account_name, account_code')
          .eq('company_id', profile.company_id)
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
      setIncomeBreakdown(incomeSorted);
      setExpenseBreakdown(expenseSorted);
      setIncomeWheelInner([{ name: 'Expenses', value: totals.expenses }, { name: 'Income', value: totals.income }]);
      setExpenseWheelInner([{ name: 'Income', value: totals.income }, { name: 'Expenses', value: totals.expenses }]);

      const months: Array<{ start: Date; end: Date; label: string }> = [];
      for (let i = chartMonths - 1; i >= 0; i--) {
        const ms = new Date(selectedYear, selectedMonth - 1 - i, 1);
        const me = new Date(selectedYear, selectedMonth - 1 - i + 1, 0, 23, 59, 59, 999);
        const label = ms.toLocaleDateString('en-ZA', { month: 'short' });
        months.push({ start: ms, end: me, label });
      }
      const monthlyData: any[] = [];
      const netTrend: any[] = [];
      const assetMonthly: any[] = [];
      const { data: teRange } = await supabase
        .from('transaction_entries')
        .select(`account_id, debit, credit, transactions!inner (transaction_date, company_id)`) 
        .eq('transactions.company_id', profile.company_id)
        .gte('transactions.transaction_date', months[0].start.toISOString())
        .lte('transactions.transaction_date', months[months.length - 1].end.toISOString());
      const { data: accountsAll } = await supabase
        .from('chart_of_accounts')
        .select('id, account_type, account_name, account_code')
        .eq('company_id', profile.company_id)
        .eq('is_active', true);
      const typeByIdAll = new Map<string, string>((accountsAll || []).map((a: any) => [String(a.id), String(a.account_type || '').toLowerCase()]));
      const nameByIdAll = new Map<string, string>((accountsAll || []).map((a: any) => [String(a.id), String(a.account_name || '')]));
      const codeByIdAll = new Map<string, string>((accountsAll || []).map((a: any) => [String(a.id), String(a.account_code || '')]));
      const buckets: Record<string, { income: number; expenses: number; label: string }> = {};
      months.forEach(m => { buckets[m.label] = { income: 0, expenses: 0, label: m.label }; });
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
        if (isIncome) buckets[label].income += Math.abs(credit - debit);
        else if (isExpense) buckets[label].expenses += Math.abs(debit - credit);
      });
      Object.values(buckets).forEach(r => {
        monthlyData.push({ month: r.label, income: Number(r.income.toFixed(2)), expenses: Number(r.expenses.toFixed(2)) });
        netTrend.push({ month: r.label, netProfit: Number((r.income - r.expenses).toFixed(2)) });
        assetMonthly.push({ month: r.label, nbv: 0 });
      });
      const { data: fa } = await supabase
        .from('fixed_assets')
        .select('id, description, cost, purchase_date, useful_life_years, status')
        .eq('company_id', profile.company_id);
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

      const { data: banks } = await supabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('company_id', profile.company_id);
      const bankBalance = (banks || []).reduce((s: number, b: any) => s + Number(b.current_balance || 0), 0);
      const newMetrics = {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalIncome: totals.income,
        totalExpenses: totals.expenses,
        operatingExpenses: Number(operatingExpensesTB.toFixed(2)),
        bankBalance
      };

      try {
        const { data: budgetRows } = await supabase
          .from('budgets')
          .select('account_id, category, budgeted_amount, status')
          .eq('company_id', profile.company_id)
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
            .eq('transactions.company_id', profile.company_id)
            .eq('transactions.status', 'posted')
            .gte('transactions.transaction_date', startDate.toISOString())
            .lte('transactions.transaction_date', endDate.toISOString())
            .eq('status', 'approved');
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_type')
            .eq('company_id', profile.company_id)
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
        let cfActual = { operating: 0, investing: 0, financing: 0, net: 0 } as any;
        if (cfBudgets.length > 0) {
          const { data: cf } = await supabase.rpc('generate_cash_flow', {
            p_company_id: profile.company_id,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString()
          });
          if (cf && cf[0]) {
            cfActual.operating = Number(cf[0].operating || 0);
            cfActual.investing = Number(cf[0].investing || 0);
            cfActual.financing = Number(cf[0].financing || 0);
            cfActual.net = Number(cf[0].net || 0);
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
            .eq('transactions.company_id', profile.company_id)
            .gte('transactions.transaction_date', startDate.toISOString())
            .lte('transactions.transaction_date', endDate.toISOString());
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_type, account_name, account_code')
            .eq('company_id', profile.company_id)
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
          setIncomeBreakdown(incomeBreak);
          setExpenseBreakdown(expenseBreak);
          setIncomeWheelInner([{ name: 'Expenses', value: newMetrics.totalExpenses }, { name: 'Income', value: newMetrics.totalIncome }]);
          setExpenseWheelInner([{ name: 'Income', value: newMetrics.totalIncome }, { name: 'Expenses', value: newMetrics.totalExpenses }]);

          if (!banks || banks.length === 0) {
            try {
              const bankAccounts = (accounts || []).filter((a: any) => String(a.account_type || '').toLowerCase() === 'asset' && ((String(a.account_name || '').toLowerCase().includes('bank')) || String(a.account_code || '') === '1100'));
              const bankIds = new Set(bankAccounts.map((a: any) => String(a.id)));
              const { data: les } = await supabase
                .from('ledger_entries')
                .select('account_id, debit, credit')
                .eq('company_id', profile.company_id)
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
        .eq('company_id', profile.company_id)
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
        .eq('company_id', profile.company_id)
        .gte('po_date', apStart.toISOString())
        .lte('po_date', endDate.toISOString());
      const { data: bills } = await supabase
        .from('bills')
        .select('id, supplier_name, total_amount, status, bill_date, due_date')
        .eq('company_id', profile.company_id)
        .gte('bill_date', rangeStart.toISOString())
        .lte('bill_date', endDate.toISOString());
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
          .eq('status', 'posted');
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
      setLoading(false);
      loadingRef.current = false;
      try { localStorage.setItem(cacheKey, JSON.stringify({ metrics: newMetrics, recentTransactions: recent, chartData: monthlyData, netProfitTrend: netTrend, incomeBreakdown, expenseBreakdown, arTop10: arTop, apTop10: apTop, arDonut: arTop.map(r => ({ name: r.name, value: Number(r.amount.toFixed(2)) })), apDonut: apTop.map(r => ({ name: r.name, value: Number(r.amount.toFixed(2)) })) })); } catch {}
    } catch (error) {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [selectedMonth, selectedYear, chartMonths, fetchTrialBalanceForPeriod]);
  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth, selectedYear, loadDashboardData]);

  const reloadTimerRef = useRef<number | null>(null);
  const lastReloadAtRef = useRef<number>(0);
  const scheduleReload = useCallback(() => {
    const now = Date.now();
    if (now - lastReloadAtRef.current < 10000) return;
    lastReloadAtRef.current = now;
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = window.setTimeout(() => {
      if (!loadingRef.current) {
        loadDashboardData();
      }
    }, 500);
  }, [loadDashboardData]);

  useEffect(() => {
    const setupRealtime = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          console.warn('Dashboard realtime: User not authenticated:', authError);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();

        if (profileError || !profile) {
          console.warn('Dashboard realtime: Profile not found:', profileError);
          return;
        }

        const companyId = profile.company_id;

        // Set up real-time subscription for auto-updates on ALL financial data
        const channel = supabase
          .channel('dashboard-realtime-updates')
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'transactions',
            filter: `company_id=eq.${companyId}` 
          }, () => {
            console.log('Transaction changed - updating dashboard...');
            scheduleReload();
          })
          // Avoid listening to transaction_entries directly to reduce reload noise
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'bank_accounts',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Bank account changed - updating dashboard...');
            scheduleReload();
          })
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'invoices',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Invoice changed - updating dashboard...');
            scheduleReload();
          })
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'fixed_assets',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Fixed asset changed - updating dashboard...');
            scheduleReload();
          })
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'purchase_orders',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Purchase order changed - updating dashboard...');
            scheduleReload();
          })
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'quotes',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Quote changed - updating dashboard...');
            scheduleReload();
          })
          .on('postgres_changes', { 
            event: 'insert', 
            schema: 'public', 
            table: 'sales',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Sale changed - updating dashboard...');
            scheduleReload();
          })
          .subscribe((status) => {
            console.log('Dashboard real-time subscription status:', status);
          });

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Dashboard realtime setup error:', error);
      }
    };

    setupRealtime();
  }, [scheduleReload]);

  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
  }, [widgets]);

  const toggleWidget = (widget: string) => {
    setWidgets((prev: any) => ({ ...prev, [widget]: !prev[widget] }));
  };

  const setupComplete = firstRun.hasCoa && firstRun.hasBank && firstRun.hasProducts && firstRun.hasCustomers && firstRun.hasSuppliers && firstRun.hasEmployees;

  const metricCards = [
    {
      title: "Total Assets",
      value: `R ${metrics.totalAssets.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: Building2,
      color: "text-primary"
    },
    {
      title: "Total Liabilities",
      value: `R ${metrics.totalLiabilities.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: FileText,
      color: "text-destructive"
    },
    {
      title: "Total Equity",
      value: `R ${metrics.totalEquity.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: Briefcase,
      color: "text-accent"
    },
    {
      title: "Total Income",
      value: `R ${metrics.totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-primary"
    },
    {
      title: "Operating Expenses",
      value: `R ${metrics.operatingExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: "text-accent"
    },
    {
      title: "Bank Balance",
      value: `R ${metrics.bankBalance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
      icon: CreditCard,
      color: "text-primary"
    }
  ];

  const COLORS = [
    '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#EC4899', '#F43F5E', '#10B981'
  ];
  const POS_COLORS = ['#22C55E', '#10B981', '#06B6D4', '#3B82F6'];
  const NEG_COLORS = ['#EF4444', '#F97316', '#DC2626', '#F43F5E'];
  const [expenseWheelInner, setExpenseWheelInner] = useState<any[]>([]);
  const [incomeWheelInner, setIncomeWheelInner] = useState<any[]>([]);
  const [incomeWheelOuter, setIncomeWheelOuter] = useState<any[]>([]);

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{userName ? `Welcome, ${userName}` : 'Welcome'}</CardTitle>
        </CardHeader>
        <CardContent>
          {setupComplete ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">Your company setup is complete. Choose a module to continue.</div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate('/sales')}>Go to Sales</Button>
                <Button variant="outline" onClick={() => navigate('/purchase')}>Go to Purchase</Button>
                <Button variant="outline" onClick={() => navigate('/customers')}>Go to Customers</Button>
                <Button variant="outline" onClick={() => navigate('/payroll')}>Go to Payroll</Button>
                <Button variant="outline" onClick={() => navigate('/reports')}>View Reports</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Complete your company setup to get started.</div>
          )}
        </CardContent>
      </Card>

      <Sheet open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Company Setup</SheetTitle>
            <SheetDescription>Add core records for products, customers, suppliers, and employees.</SheetDescription>
          </SheetHeader>
          <div className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Product</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">Add products via Purchase Orders to capture costs and stock updates.</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/purchase')}>Go to Purchase</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">Manage your customers in the Customers module.</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/customers')}>Go to Customers</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supplier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">Create and manage suppliers in the Purchase module.</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/purchase')}>Go to Purchase</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Employee</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">Add employees in the Payroll module.</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/payroll')}>Go to Payroll</Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">You can skip and complete later in relevant pages.</div>
              <Button variant="outline" onClick={() => setOnboardingOpen(false)}>Skip</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {/* First-run setup banner */}
      {(!firstRun.hasCoa || !firstRun.hasBank) && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Welcome! Let’s set up your company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Chart of Accounts</span>
                  <Badge variant={firstRun.hasCoa ? 'default' : 'outline'}>{firstRun.hasCoa ? 'Done' : 'Not set'}</Badge>
                </div>
                {!firstRun.hasCoa && (
                  <Button className="mt-3" onClick={() => navigate('/transactions?tab=chart')}>Create Accounts</Button>
                )}
              </div>
              <div className="p-3 border rounded">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Bank Account</span>
                  <Badge variant={firstRun.hasBank ? 'default' : 'outline'}>{firstRun.hasBank ? 'Done' : 'Not set'}</Badge>
                </div>
                {!firstRun.hasBank && (
                  <Button className="mt-3" onClick={() => navigate('/bank')}>Add Bank Account</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's your live financial overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">January</SelectItem>
                <SelectItem value="2">February</SelectItem>
                <SelectItem value="3">March</SelectItem>
                <SelectItem value="4">April</SelectItem>
                <SelectItem value="5">May</SelectItem>
                <SelectItem value="6">June</SelectItem>
                <SelectItem value="7">July</SelectItem>
                <SelectItem value="8">August</SelectItem>
                <SelectItem value="9">September</SelectItem>
                <SelectItem value="10">October</SelectItem>
                <SelectItem value="11">November</SelectItem>
                <SelectItem value="12">December</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
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
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })} • {chartMonths} months
          </Badge>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metricCards.map((metric) => (
            <Card key={metric.title} className="card-professional">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {widgets.budgetGauge && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Budget Gauge
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-6">
                <DashboardBudgetGauge percentage={budgetUtilization} onTrack={budgetOnTrack} />
              </div>
            </CardContent>
          </Card>
        )}
        {widgets.incomeVsExpense && (
          <Card className="card-professional">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                {`Income vs Expenses (${chartMonths} months)`}
                </CardTitle>
              </CardHeader>
            <CardContent>
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
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Net Profit Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
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
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomeWheelInner}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
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

        {widgets.apOverview && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Unpaid purchases amount (Top 10 Suppliers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={apTop10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Unpaid']} />
                  <Legend />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} name="Unpaid">
                    {apTop10.map((_, index) => (
                      <Cell key={`ap-top10-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.expenseBreakdown && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-accent" />
                Expense Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseWheelInner}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
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

        {widgets.apOverview && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Unpaid purchases percentage by supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
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
        )}
        

        {widgets.arOverview && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                AR Unpaid (Top Customers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={arTop10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={150} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Unpaid']} />
                  <Legend />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Unpaid" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}


        {widgets.assetTrend && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Fixed Assets Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={assetTrend} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R ${Number(v).toLocaleString('en-ZA')}`} />
                  <Tooltip 
                    formatter={(value: any) => [`R ${Number(value).toLocaleString('en-ZA')}`, 'Net Book Value']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }} 
                  />
                  <Legend />
                  <Line type="monotone" dataKey="nbv" name="Net Book Value" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {widgets.arOverview && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Unpaid invoices percentage by customer
              </CardTitle>
            </CardHeader>
            <CardContent>
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

      </div>

      

      {/* Recent & Summary at End */}
      <div className="grid gap-6 lg:grid-cols-2">
          {widgets.trialBalance && (
            <Card className="card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Trial Balance Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="font-medium">Total Debits</span>
                    <span className="font-bold text-primary">
                      R {(metrics.totalAssets + metrics.totalExpenses).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="font-medium">Total Credits</span>
                    <span className="font-bold text-accent">
                      R {(metrics.totalLiabilities + metrics.totalEquity + metrics.totalIncome).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded bg-muted">
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
            <Card className="card-professional">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-8 rounded-full ${
                            transaction.type === 'income' ? 'bg-primary' : 'bg-accent'
                          }`} />
                          <div>
                            <p className="font-medium text-foreground">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">{transaction.id} • {transaction.date}</p>
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-foreground">{transaction.amount}</div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/transactions')}>View All Transactions</Button>
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
  const pct = Math.max(0, Math.min(100, percentage));
  const ang = start + (pct / 100) * (end - start);
  const nx = cx + r * Math.cos(ang);
  const ny = cy + r * Math.sin(ang);
  const color = onTrack ? '#22c55e' : '#ef4444';
  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const a = start + (i / 10) * (end - start);
    const x1 = cx + (r - 10) * Math.cos(a);
    const y1 = cy + (r - 10) * Math.sin(a);
    const x2 = cx + r * Math.cos(a);
    const y2 = cy + r * Math.sin(a);
    return { x1, y1, x2, y2, i };
  });
  return (
    <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`}>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#e5e7eb" strokeWidth={12} />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
      {ticks.map((t) => (
        <line key={t.i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#9ca3af" strokeWidth={t.i % 5 === 0 ? 3 : 1.5} />
      ))}
      <circle cx={cx} cy={cy} r={6} fill="#374151" />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={4} />
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="18" fill={color}>{`${pct.toFixed(0)}%`}</text>
    </svg>
  );
};
