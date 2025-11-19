import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalIncome: 0,
    totalExpenses: 0,
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
  const [firstRun, setFirstRun] = useState<{ hasCoa: boolean; hasBank: boolean }>({ hasCoa: true, hasBank: true });
  
  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Widget visibility settings
  const [widgets, setWidgets] = useState(() => {
    const defaultWidgets = {
      metrics: true,
      incomeExpense: true,
      expenseBreakdown: true,
      assetTrend: true,
      recentTransactions: true,
      trialBalance: true,
      arOverview: true,
      apOverview: true,
    };
    const saved = localStorage.getItem('dashboardWidgets');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...defaultWidgets, ...parsed };
  });

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth, selectedYear]);

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
            event: '*', 
            schema: 'public', 
            table: 'transactions',
            filter: `company_id=eq.${companyId}` 
          }, () => {
            console.log('Transaction changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'transaction_entries',
            // Note: transaction_entries doesn't have company_id, so we listen to all
            // and rely on the parent transaction check to re-load.
            // This is not ideal, but a constraint of the current schema.
          }, () => {
            console.log('Transaction entry changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'bank_accounts',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Bank account changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'invoices',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Invoice changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'fixed_assets',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Fixed asset changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'purchase_orders',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Purchase order changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'quotes',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Quote changed - updating dashboard...');
            loadDashboardData();
          })
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'sales',
            filter: `company_id=eq.${companyId}`
          }, () => {
            console.log('Sale changed - updating dashboard...');
            loadDashboardData();
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
  }, []);

  useEffect(() => {
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
  }, [widgets]);

  const toggleWidget = (widget: string) => {
    setWidgets((prev: any) => ({ ...prev, [widget]: !prev[widget] }));
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn('Dashboard: User not authenticated or auth error:', authError);
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        console.warn('Dashboard: Profile not found or error:', profileError);
        setLoading(false);
        return;
      }

      console.log('Loading dashboard data for company:', profile.company_id);

      // Calculate date range for selected month/year
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      // Load transactions filtered by selected month/year
      const rangeStart = new Date(selectedYear, selectedMonth - 6, 1);
      const { data: transactions, error: txError } = await supabase
        .from("transactions")
        .select(`
          *,
          entries:transaction_entries(
            id,
            debit,
            credit,
            chart_of_accounts(account_type, account_name)
          )
        `)
        .eq("company_id", profile.company_id)
        .gte("transaction_date", rangeStart.toISOString())
        .lte("transaction_date", endDate.toISOString())
        .order("transaction_date", { ascending: false });

      if (txError) throw txError;

      console.log('Loaded transactions:', transactions?.length);

      // Calculate totals by account type from ALL transaction entries
      let assets = 0, liabilities = 0, equity = 0, income = 0, expenses = 0;
      const monthlyMap = new Map<string, { income: number; expenses: number }>();
      const assetsMap = new Map<string, number>();
      const withinSelected = (d: string) => {
        const dt = new Date(d);
        return dt >= startDate && dt <= endDate;
      };

      transactions?.forEach(tx => {
        tx.entries?.forEach((entry: any) => {
          const type = entry.chart_of_accounts?.account_type?.toLowerCase() || "";
          const netAmount = entry.debit - entry.credit;
          const dtKey = new Date(tx.transaction_date).toISOString().slice(0,7);
          const agg = monthlyMap.get(dtKey) || { income: 0, expenses: 0 };
          if (type.includes("income") || type.includes("revenue")) agg.income += Math.abs(netAmount);
          else if (type.includes("expense")) agg.expenses += Math.abs(netAmount);
          monthlyMap.set(dtKey, agg);
          if (type.includes("asset")) {
            const a = assetsMap.get(dtKey) || 0;
            assetsMap.set(dtKey, a + netAmount);
          }

          if (withinSelected(tx.transaction_date)) {
            if (type.includes("asset")) assets += netAmount;
            else if (type.includes("liability")) liabilities += Math.abs(netAmount);
            else if (type.includes("equity")) equity += Math.abs(netAmount);
            else if (type.includes("income") || type.includes("revenue")) income += Math.abs(netAmount);
            else if (type.includes("expense")) expenses += Math.abs(netAmount);
          }
        });
      });

      // First-run checks (minimal, clean system)
      const { count: coaCount } = await supabase
        .from('chart_of_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      const { data: banksList } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("company_id", profile.company_id);

      setFirstRun({ hasCoa: (coaCount || 0) > 0, hasBank: (banksList || []).length > 0 });

      // Load bank balance
      const banks = banksList;

      const bankBalance = banks?.reduce((sum, b) => sum + Number(b.current_balance), 0) || 0;

      console.log('Calculated metrics:', { assets, liabilities, equity, income, expenses, bankBalance });

      setMetrics({
        totalAssets: assets,
        totalLiabilities: liabilities,
        totalEquity: equity,
        totalIncome: income,
        totalExpenses: expenses,
        bankBalance
      });

      // Format recent transactions
      const formatted = transactions?.slice(0, 4).map(tx => ({
        id: tx.reference_number || tx.id.slice(0, 8),
        description: tx.description,
        amount: `R ${Math.abs(tx.total_amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
        type: tx.total_amount >= 0 ? "income" : "expense",
        date: new Date(tx.transaction_date).toLocaleDateString('en-ZA')
      })) || [];

      setRecentTransactions(formatted);

      const monthsSeq: { label: string; key: string }[] = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(selectedYear, selectedMonth - 1 - (5 - i), 1);
        const label = d.toLocaleDateString('en-ZA', { month: 'short' });
        const key = d.toISOString().slice(0,7);
        return { label, key };
      });
      const incomeExpenseData = monthsSeq.map(m => ({
        month: m.label,
        income: monthlyMap.get(m.key)?.income || 0,
        expenses: monthlyMap.get(m.key)?.expenses || 0,
      }));
      setChartData(incomeExpenseData);

      const incTotals = new Map<string, number>();
      transactions?.forEach(tx => {
        if (!withinSelected(tx.transaction_date)) return;
        tx.entries?.forEach((entry: any) => {
          const type = entry.chart_of_accounts?.account_type?.toLowerCase() || "";
          if (!type.includes('income') && !type.includes('revenue')) return;
          const name = entry.chart_of_accounts?.account_name || 'Income';
          const amt = Math.abs((entry.debit || 0) - (entry.credit || 0));
          incTotals.set(name, (incTotals.get(name) || 0) + amt);
        });
      });
      const incSorted = Array.from(incTotals.entries()).sort((a,b) => b[1]-a[1]);
      const incTop5 = incSorted.slice(0,5).map(([name, value]) => ({ name, value }));
      const incOtherTotal = incSorted.slice(5).reduce((s, [,v]) => s+v, 0);
      setIncomeBreakdown(incTop5);
      setIncomeWheelInner([
        { name: 'Top 5', value: incTop5.reduce((s, v) => s + v.value, 0) },
        { name: 'Other', value: incOtherTotal }
      ] as any);

      // Expense breakdown - group by expense account name
      const expTotals = new Map<string, number>();
      transactions?.forEach(tx => {
        if (!withinSelected(tx.transaction_date)) return;
        tx.entries?.forEach((entry: any) => {
          const type = entry.chart_of_accounts?.account_type?.toLowerCase() || "";
          if (!type.includes('expense')) return;
          const name = entry.chart_of_accounts?.account_name || 'Expense';
          const amt = Math.abs((entry.debit || 0) - (entry.credit || 0));
          expTotals.set(name, (expTotals.get(name) || 0) + amt);
        });
      });
      const sorted = Array.from(expTotals.entries()).sort((a,b) => b[1]-a[1]);
      const top5 = sorted.slice(0,5).map(([name, value]) => ({ name, value }));
      const otherTotal = sorted.slice(5).reduce((s, [,v]) => s+v, 0);
      setExpenseBreakdown(top5);
      const expenseWheelInner = [
        { name: 'Top 5', value: top5.reduce((s, v) => s + v.value, 0) },
        { name: 'Other', value: otherTotal }
      ];
      setExpenseWheelInner(expenseWheelInner as any);

      const { data: fixedAssets } = await supabase
        .from("fixed_assets")
        .select("cost,purchase_date,useful_life_years,accumulated_depreciation,company_id")
        .eq("company_id", (profile as any).company_id);
      const faData = monthsSeq.map((m) => {
        const [yy, mm] = m.key.split("-");
        const monthEnd = new Date(Number(yy), Number(mm), 0);
        let nbv = 0;
        (fixedAssets || []).forEach((a: any) => {
          const res = calculateDepreciation(Number(a.cost || 0), String(a.purchase_date), Number(a.useful_life_years || 1), monthEnd);
          nbv += Math.max(0, res.netBookValue);
        });
        return { month: m.label, nbv };
      });
      setAssetTrend(faData);

      // Load AR unpaid invoices (sent/overdue/draft – exclude paid/cancelled)
      const { data: arData, error: arErr } = await supabase
        .from('invoices')
        .select('id, customer_name, invoice_date, due_date, total_amount, status')
        .eq('company_id', profile.company_id)
        .not('status', 'in', ['("paid")','("cancelled")'])
        .gte('invoice_date', startDate.toISOString().split('T')[0])
        .lte('invoice_date', endDate.toISOString().split('T')[0])
        .order('invoice_date', { ascending: false });
      if (arErr) throw arErr;
      const rows = (arData || []).map((r: any) => ({
        id: r.id,
        customer_name: r.customer_name || 'Unknown',
        total_amount: r.status === 'paid' ? 0 : Number(r.total_amount || 0),
        status: r.status,
        invoice_date: r.invoice_date,
        due_date: r.due_date || null
      }));
      setArInvoices(rows);
      // Compute Top 10 and Donut
      const totals = new Map<string, { name: string; amount: number }>();
      rows.forEach(r => {
        const key = r.customer_name || 'Unknown';
        const curr = totals.get(key) || { name: key, amount: 0 };
        curr.amount += r.total_amount || 0;
        totals.set(key, curr);
      });
      const top10 = Array.from(totals.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map(r => ({ name: r.name, amount: r.amount }));
      setArTop10(top10);
      const totalUnpaid = rows.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 1;
      const donut = Array.from(totals.values()).map(b => ({ name: b.name, value: b.amount, pct: (b.amount / totalUnpaid) * 100 }));
      setArDonut(donut);

      // Load AP from Bills
      const { data: apBills, error: apErr } = await supabase
        .from('bills')
        .select('id, supplier_id, bill_date, due_date, total_amount, status')
        .eq('company_id', profile.company_id)
        .order('bill_date', { ascending: false });
      let apRowsLocal: Array<{ id: string; supplier_name: string; total_amount: number; status: string; bill_date?: string; due_date?: string | null; source?: string }> = [];
      if (!apErr) {
        const supplierIds = Array.from(new Set((apBills || []).map((b: any) => b.supplier_id).filter(Boolean)));
        let nameMap: Record<string, string> = {};
        if (supplierIds.length > 0) {
          const { data: supps } = await supabase
            .from('suppliers')
            .select('id, name')
            .in('id', supplierIds);
          (supps || []).forEach((s: any) => { nameMap[s.id] = s.name; });
        }
        apRowsLocal = (apBills || []).filter((r: any) => !['paid','cancelled'].includes(String(r.status))).map((r: any) => ({
          id: r.id,
          supplier_name: nameMap[r.supplier_id] || 'Unknown',
          total_amount: Number(r.total_amount || 0),
          status: r.status,
          bill_date: r.bill_date,
          due_date: r.due_date || null,
          source: 'bills'
        }));
      }

      // Load AP from Purchase Orders and compute outstanding
      const { data: apPOs } = await supabase
        .from('purchase_orders')
        .select('id, supplier_id, po_number, po_date, total_amount, status')
        .eq('company_id', profile.company_id)
        .order('po_date', { ascending: false });
      let poRowsLocal: Array<{ id: string; supplier_name: string; total_amount: number; status: string; due_date?: string | null; bill_date?: string; source?: string }> = [];
      if (apPOs && apPOs.length > 0) {
        const supplierIdsPO = Array.from(new Set((apPOs || []).map((p: any) => p.supplier_id).filter(Boolean)));
        let nameMapPO: Record<string, string> = {};
        if (supplierIdsPO.length > 0) {
          const { data: suppsPO } = await supabase
            .from('suppliers')
            .select('id, name')
            .in('id', supplierIdsPO);
          (suppsPO || []).forEach((s: any) => { nameMapPO[s.id] = s.name; });
        }
        const poNumbers = (apPOs || []).map((p: any) => p.po_number).filter(Boolean);
        let payMap: Record<string, number> = {};
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
        poRowsLocal = (apPOs || []).filter((p: any) => String(p.status) !== 'paid').map((p: any) => {
          const supplierName = nameMapPO[p.supplier_id] || 'Unknown';
          const paidAmt = payMap[String(p.po_number || '')] || 0;
          const outstanding = Math.max(0, Number(p.total_amount || 0) - paidAmt);
          return {
            id: p.id,
            supplier_name: supplierName,
            total_amount: outstanding,
            status: p.status,
            bill_date: p.po_date,
            due_date: null,
            source: 'purchase_orders'
          };
        }).filter(r => r.total_amount > 0);
      }

      const allApRowsLocal = [...apRowsLocal, ...poRowsLocal];
      setApRows(allApRowsLocal);
      const apTotals = new Map<string, { name: string; amount: number }>();
      allApRowsLocal.forEach(r => {
        const key = r.supplier_name || 'Unknown';
        const curr = apTotals.get(key) || { name: key, amount: 0 };
        curr.amount += r.total_amount || 0;
        apTotals.set(key, curr);
      });
      const apTop = Array.from(apTotals.values()).sort((a, b) => b.amount - a.amount).slice(0, 10).map(r => ({ name: r.name, amount: r.amount }));
      setApTop10(apTop);
      const apTotalUnpaid = allApRowsLocal.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 1;
      const apDonutData = Array.from(apTotals.values()).map(b => ({ name: b.name, value: b.amount, pct: (b.amount / apTotalUnpaid) * 100 }));
      setApDonut(apDonutData);

      const nowStr = new Date().toISOString().split('T')[0];
      const arOverdue = rows.filter(r => r.total_amount > 0 && r.due_date && r.due_date < nowStr);
      const arOverUnder30 = arOverdue.filter(r => {
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        return d > 0 && d <= 30;
      });
      const arOver30 = arOverdue.filter(r => {
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        return d >= 31;
      });
      const arOver90 = arOverdue.filter(r => {
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        return d >= 90;
      });
      setArKpis({
        unpaidTotal: rows.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdueTotal: arOverdue.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdueUnder30Total: arOverUnder30.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdue30Total: arOver30.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdue90Total: arOver90.reduce((s, r) => s + (r.total_amount || 0), 0),
      });

      const arAgingMap = new Map<string, any>();
      rows.forEach(r => {
        const key = r.customer_name || 'Unknown';
        const isOverdue = r.total_amount > 0 && r.due_date && r.due_date < nowStr;
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        const bucket = !isOverdue ? 'current' : d <= 30 ? 'd1_30' : d <= 60 ? 'd31_60' : d <= 90 ? 'd61_90' : 'd91p';
        const curr = arAgingMap.get(key) || { name: key, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91p: 0, due: 0 };
        curr[bucket] += r.total_amount || 0;
        curr.due += r.total_amount || 0;
        arAgingMap.set(key, curr);
      });
      setArAging(Array.from(arAgingMap.values()));

      const apAgingMap = new Map<string, any>();
      allApRowsLocal.forEach(r => {
        const key = r.supplier_name || 'Unknown';
        const isOverdue = r.total_amount > 0 && r.due_date && r.due_date < nowStr;
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        const bucket = !isOverdue ? 'current' : d <= 30 ? 'd1_30' : d <= 60 ? 'd31_60' : d <= 90 ? 'd61_90' : 'd91p';
        const curr = apAgingMap.get(key) || { name: key, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91p: 0, due: 0 };
        curr[bucket] += r.total_amount || 0;
        curr.due += r.total_amount || 0;
        apAgingMap.set(key, curr);
      });
      setApAging(Array.from(apAgingMap.values()));

      const apOverdue = allApRowsLocal.filter(r => r.total_amount > 0 && r.due_date && r.due_date < nowStr);
      const apUnder30 = apOverdue.filter(r => {
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        return d > 0 && d <= 30;
      });
      const ap30 = apOverdue.filter(r => {
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        return d >= 31;
      });
      const ap90 = apOverdue.filter(r => {
        const a = r.due_date ? new Date(r.due_date).getTime() : 0;
        const b = new Date(nowStr).getTime();
        const d = Math.floor((b - a) / (1000 * 60 * 60 * 24));
        return d >= 90;
      });
      setApKpis({
        unpaidTotal: allApRowsLocal.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdueTotal: apOverdue.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdueUnder30Total: apUnder30.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdue30Total: ap30.reduce((s, r) => s + (r.total_amount || 0), 0),
        overdue90Total: ap90.reduce((s, r) => s + (r.total_amount || 0), 0),
      });

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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
      title: "Total Expenses",
      value: `R ${metrics.totalExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
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
  // @ts-ignore
  const [expenseWheelInner, setExpenseWheelInner] = useState<any[]>([]);
  // @ts-ignore
  const [incomeWheelInner, setIncomeWheelInner] = useState<any[]>([]);
  // @ts-ignore
  const [incomeWheelOuter, setIncomeWheelOuter] = useState<any[]>([]);

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>;
  }

  
  return (
    <div className="space-y-6">
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
          </div>
          <Badge variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}
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
                      <Cell key={`inner-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} />
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

        {widgets.apOverview && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                AP Unpaid (Top Suppliers)
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

        {widgets.apOverview && (
          <Card className="card-professional">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Unpaid bills percentage by supplier
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