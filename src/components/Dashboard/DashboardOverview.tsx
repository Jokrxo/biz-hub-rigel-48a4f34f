import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/ui/count-up";
import { SagePieChart } from "./SagePieChart";
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
  EyeOff,
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/useAuth";
import { DashboardCalendar } from "./DashboardCalendar";
import { FinancialHealthInsight } from "./FinancialHealthInsight";
import { useFiscalYear } from "@/hooks/use-fiscal-year";
import { useDashboardData } from "@/hooks/useDashboardData";

export const DashboardOverview = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [userName, setUserName] = useState<string>("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [chartMonths, setChartMonths] = useState<number>(12);
  const [sbStatus, setSbStatus] = useState<'online' | 'offline' | 'connecting'>('connecting');
  const [sbLatency, setSbLatency] = useState<number | null>(null);
  const [sbStrength, setSbStrength] = useState<number>(0);

  const { fiscalStartMonth, selectedFiscalYear, setSelectedFiscalYear, getCalendarYearForFiscalPeriod, loading: fiscalLoading } = useFiscalYear();
  
  // Manage company ID state locally to trigger refreshes
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle();
      if (data?.company_id) setCompanyId(String(data.company_id));
    };
    fetchCompanyId();

    const handleCompanyChange = () => { fetchCompanyId(); };
    window.addEventListener('company-changed', handleCompanyChange);
    return () => window.removeEventListener('company-changed', handleCompanyChange);
  }, [user]);

  // Date filter state
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [periodMode, setPeriodMode] = useState<'rolling' | 'fiscal_year'>('rolling');

  useEffect(() => {
    if (!fiscalLoading && typeof selectedFiscalYear === 'number') {
      setSelectedYear(selectedFiscalYear);
      const nextMonth = fiscalStartMonth === 12 ? 1 : (fiscalStartMonth + 1);
      setSelectedMonth(nextMonth);
    }
  }, [fiscalLoading, selectedFiscalYear, fiscalStartMonth]);

  // Load User Profile Name
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", user.id)
          .single();
        
        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
        setUserName(fullName || (user.user_metadata?.name as string) || user.email || "");
      } catch {}
    };
    loadProfile();
  }, [user]);
  
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
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
      const latency = Math.round(performance.now() - start);
      setSbLatency(latency);
      setSbStatus('online');
      setSbStrength(latency < 150 ? 3 : latency < 400 ? 2 : 1);
    } catch (e: any) {
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

  // --- React Query Hook ---
  const { data, isLoading, isFetching, error } = useDashboardData(
    companyId,
    selectedYear,
    selectedMonth,
    chartMonths,
    fiscalStartMonth,
    getCalendarYearForFiscalPeriod,
    periodMode
  );

  useEffect(() => {
    if (error) {
      toast({ title: "Dashboard load failed", description: error.message, variant: "destructive" });
    }
  }, [error, toast]);

  // Realtime Subscription for Silent Sync
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`dashboard-sync-${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `company_id=eq.${companyId}` },
        () => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaction_entries', filter: `transactions.company_id=eq.${companyId}` }, 
        () => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `company_id=eq.${companyId}` },
        () => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `company_id=eq.${companyId}` },
        () => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quotes', filter: `company_id=eq.${companyId}` },
        () => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  // Initial loading state (only for first load)
  if (isLoading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  // Safety check: if we are not loading but still have no data (e.g. error state or empty), 
  // we might want to return null or empty structure, but useDashboardData usually returns defaults.
  // We'll proceed assuming data exists if !isLoading.
  if (!data) return null;

  // Destructure data for cleaner usage in JSX
  const {
    metrics,
    recentTransactions,
    chartData,
    netProfitTrend,
    incomeBreakdown,
    expenseBreakdown,
    arTop10,
    apTop10,
    arDonut,
    apDonut,
    purchaseTrend,
    costStructure,
    profitMargins,
    assetTrend,
    inventoryLevels,
    bsComposition,
    cashGaugePct,
    cashOnTrack,
    safeMinimum,
    quotesAcceptanceDonut,
    incomeWheelInner,
    expenseWheelInner,
    arKpis,
    apKpis
  } = data;

  const metricCards = [
    {
      title: "Total Assets",
      amount: metrics.totalAssets,
      prefix: "R ",
      icon: Building2,
      color: "text-blue-600",
      gradient: "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-background border-blue-200/50"
    },
    {
      title: "Total Liabilities",
      amount: metrics.totalLiabilities,
      prefix: "R ",
      icon: FileText,
      color: "text-red-600",
      gradient: "bg-gradient-to-br from-red-500/10 via-red-500/5 to-background border-red-200/50"
    },
    {
      title: "Total Equity",
      amount: metrics.totalAssets - metrics.totalLiabilities,
      prefix: "R ",
      icon: Briefcase,
      color: "text-purple-600",
      gradient: "bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background border-purple-200/50"
    },
    {
      title: "Total Income",
      amount: metrics.totalIncome,
      prefix: "R ",
      icon: TrendingUp,
      color: "text-emerald-600",
      gradient: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background border-emerald-200/50"
    },
    {
      title: "Operating Expenses",
      amount: metrics.operatingExpenses,
      prefix: "(R ",
      suffix: ")",
      icon: TrendingDown,
      color: "text-amber-600",
      gradient: "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background border-amber-200/50"
    },
    {
      title: "Bank Balance",
      amount: metrics.bankBalance,
      prefix: "R ",
      icon: CreditCard,
      color: "text-cyan-600",
      gradient: "bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-background border-cyan-200/50"
    }
  ];

  const COLORS = [
    '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#EC4899', '#F43F5E', '#10B981'
  ];
  const QUOTE_COLORS = ['#22C55E', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            Dashboard
            {isFetching && !isLoading && (
               <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground bg-muted/50 px-2 py-1 rounded-full animate-pulse">
                 <Loader2 className="h-3 w-3 animate-spin" />
                 Updating...
               </div>
            )}
          </h1>
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
                <div className={`text-3xl font-bold tracking-tight ${metric.color}`}>
                  <CountUp 
                    end={metric.amount} 
                    prefix={metric.prefix} 
                    suffix={metric.suffix} 
                    decimals={2} 
                    duration={800} 
                  />
                </div>
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
          <SagePieChart
            title="Income Breakdown"
            data={incomeBreakdown}
            totalAmount={metrics.totalIncome}
            icon={TrendingUp}
            iconColor="text-emerald-600"
            storageKey="incomeBreakdown"
            colors={['#22C55E', '#16A34A', '#15803D', '#4ADE80', '#86EFAC', '#BBF7D0']}
          />
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
          <SagePieChart
            title="Expense Breakdown"
            data={expenseBreakdown}
            totalAmount={metrics.totalExpenses}
            icon={TrendingDown}
            iconColor="text-red-600"
            storageKey="expenseBreakdown"
            colors={['#EF4444', '#DC2626', '#B91C1C', '#F87171', '#FCA5A5', '#FECACA']}
          />
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
