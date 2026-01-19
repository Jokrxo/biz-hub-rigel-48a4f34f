import { useEffect, useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { transactionsApi } from "@/lib/transactions-api";
import { 
  TrendingUp, 
  PieChart as PieChartIcon, 
  Briefcase, 
  DollarSign, 
  Menu, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  FileText, 
  Wallet, 
  Search, 
  Filter,
  LayoutDashboard,
  ArrowRightLeft,
  Landmark,
  Check,
  XCircle
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Progress } from "@/components/ui/progress";

type InvestmentAccount = { id: string; name: string; currency: string; broker_name?: string };
type Position = { id: string; account_id: string; symbol: string; instrument_type: string; quantity: number; avg_cost: number; current_price?: number; market_value?: number; unrealized_gain?: number };
type InvestmentTx = { id: string; account_id: string; type: string; trade_date: string; symbol: string; quantity?: number; price?: number; total_amount: number; currency?: string; fx_rate?: number; fees?: number; notes?: string };

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

export default function Investments() {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [companyId, setCompanyId] = useState<string>("");
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; account_name: string }>>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Operation completed successfully");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  
  // Dialog States
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [divOpen, setDivOpen] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [fdOpen, setFdOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  
  // Form States
  const [actionAccountId, setActionAccountId] = useState<string>("");
  const [actionBankId, setActionBankId] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [termMonths, setTermMonths] = useState<string>("12");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));
  
  // Search & Filter
  const [search, setSearch] = useState("");
  const [txFilter, setTxFilter] = useState("all");

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
        if (!profile?.company_id) return;
        setCompanyId(String(profile.company_id));
      } catch {}
    };
    init();
  }, []);

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data: accts } = await supabase.from("investment_accounts" as any).select("id, name, currency, broker_name").eq("company_id", companyId);
      setAccounts((accts || []) as any);
      const { data: pos } = await supabase.from("investment_positions" as any).select("*").in("account_id", (accts || []).map((a: any) => a.id));
      setPositions((pos || []) as any);
      const { data: txs } = await supabase.from("investment_transactions" as any).select("*").in("account_id", (accts || []).map((a: any) => a.id)).order("trade_date", { ascending: false });
      setTransactions((txs || []) as any);
      const { data: banks } = await supabase.from("bank_accounts" as any).select("id, account_name").eq("company_id", companyId).order("account_name");
      setBankAccounts(((banks || []) as any[]).filter(b => b && typeof b.id === 'string'));
    } catch (e: any) {
      // Tables may not exist yet; keep UI responsive
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadAll(); }, [companyId, loadAll]);

  const allocation = useMemo(() => {
    const map: Record<string, number> = {};
    (positions || []).forEach(p => {
      const key = String(p.instrument_type || 'other');
      const val = Number(p.market_value ?? (p.quantity || 0) * (p.current_price || p.avg_cost || 0));
      map[key] = (map[key] || 0) + Math.max(0, val);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
  }, [positions]);

  const fdMetaByAccount = useMemo(() => {
    const metas: Record<string, { principal: number; rate: number; termMonths: number; startDate: string }> = {};
    const fdPositions = (positions || []).filter(p => String(p.instrument_type).toLowerCase() === 'fixed_deposit');
    fdPositions.forEach(p => {
      const principal = Number(p.avg_cost || 0);
      const tx = (transactions || []).find(t => t.account_id === p.account_id && String(t.type).toLowerCase() === 'buy' && String(t.symbol || '').includes('FD-'));
      let rate = 0; let termMonths = 0; const startIso = tx ? String(tx.trade_date) : startDate;
      const note = (tx as any)?.notes || '';
      const rateMatch = String(note).match(/Rate\s+([0-9]+(?:\.[0-9]+)?)%/i);
      const termMatch = String(note).match(/Term\s+([0-9]+)m/i);
      if (rateMatch) rate = parseFloat(rateMatch[1]) / 100;
      if (termMatch) termMonths = parseInt(termMatch[1], 10);
      metas[p.account_id] = { principal, rate, termMonths, startDate: startIso };
    });
    return metas;
  }, [positions, transactions]);

  const fdMonthlyInterest = (accountId: string) => {
    const m = fdMetaByAccount[accountId];
    if (!m || !(m.principal > 0) || !(m.rate > 0)) return 0;
    return Number((m.principal * m.rate / 12).toFixed(2));
  };

  const performanceSeries = useMemo(() => {
    const series: Array<{ date: string; value: number }> = [];
    const monthsBack = 12;
    const end = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
      const dIso = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10);
      let total = 0;
      Object.values(fdMetaByAccount).forEach(m => {
        if (!m.rate || !m.principal) return;
        const start = new Date(m.startDate || dIso);
        const monthsElapsed = Math.max(0, Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
        const cappedMonths = m.termMonths ? Math.min(monthsElapsed, m.termMonths) : monthsElapsed;
        const accrued = m.principal * m.rate * (cappedMonths / 12);
        total += m.principal + accrued;
      });
      (positions || []).forEach(p => {
        if (String(p.instrument_type).toLowerCase() !== 'fixed_deposit') {
          const mv = Number(p.market_value ?? (p.quantity || 0) * (p.current_price || p.avg_cost || 0));
          total += Math.max(0, mv);
        }
      });
      series.push({ date: dIso, value: Number(total.toFixed(2)) });
    }
    return series;
  }, [positions, fdMetaByAccount]);

  const metrics = useMemo(() => {
    const totalValue = (positions || []).reduce((sum, p) => sum + Number(p.market_value ?? (p.quantity || 0) * (p.current_price || p.avg_cost || 0)), 0);
    const totalUnrealized = (positions || []).reduce((sum, p) => sum + Number(p.unrealized_gain || 0), 0);
    const year = new Date().getFullYear();
    const dividendsYTD = (transactions || []).filter(t => String(t.type).toLowerCase() === 'dividend' && new Date(t.trade_date).getFullYear() === year).reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const interestYTD = (transactions || []).filter(t => String(t.type).toLowerCase() === 'interest' && new Date(t.trade_date).getFullYear() === year).reduce((s, t) => s + Number(t.total_amount || 0), 0);
    
    return { totalValue, totalUnrealized, dividendsYTD, interestYTD };
  }, [positions, transactions]);

  const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#84CC16", "#EC4899", "#F43F5E", "#10B981"];

  const filteredPositions = useMemo(() => {
    return positions.filter(p => 
      p.symbol.toLowerCase().includes(search.toLowerCase()) || 
      (p.instrument_type || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [positions, search]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.symbol?.toLowerCase().includes(search.toLowerCase()) || t.type.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = txFilter === 'all' || t.type.toLowerCase() === txFilter;
      return matchesSearch && matchesFilter;
    });
  }, [transactions, search, txFilter]);

  return (
    <>
      <SEO title="Investments | Rigel Business" description="Manage company investments" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
              <p className="text-muted-foreground">Manage portfolio, track performance, and record distributions</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setActionsOpen(true)} className="shadow-md bg-gradient-primary">
                <Menu className="h-4 w-4 mr-2" />
                Quick Actions
              </Button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="Total Portfolio Value" 
              value={`R ${metrics.totalValue.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} 
              icon={Briefcase} 
              color="from-blue-500 to-blue-600" 
            />
            <MetricCard 
              title="Unrealized Gain" 
              value={`R ${metrics.totalUnrealized.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} 
              icon={TrendingUp} 
              color="from-emerald-500 to-emerald-600" 
              trend={metrics.totalValue > 0 ? `${((metrics.totalUnrealized / metrics.totalValue) * 100).toFixed(1)}% Return` : undefined}
            />
            <MetricCard 
              title="Dividends (YTD)" 
              value={`R ${metrics.dividendsYTD.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} 
              icon={PieChartIcon} 
              color="from-purple-500 to-purple-600" 
            />
            <MetricCard 
              title="Interest (YTD)" 
              value={`R ${metrics.interestYTD.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`} 
              icon={DollarSign} 
              color="from-orange-500 to-orange-600" 
            />
          </div>

          {/* Main Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <div className="border-b pb-px overflow-x-auto">
              <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 rounded-none">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="positions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Positions
                </TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="performance" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="reports" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Asset Allocation</CardTitle>
                    <CardDescription>Distribution by instrument type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {allocation.length === 0 ? (
                      <div className="flex items-center justify-center h-[300px] text-muted-foreground">No assets allocated</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={80} outerRadius={120} paddingAngle={2}>
                            {allocation.map((entry, index) => (
                              <Cell key={`alloc-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} 
                            formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Value']} 
                          />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Trend</CardTitle>
                    <CardDescription>Value over last 12 months</CardDescription>
                  </CardHeader>
                  <CardContent>
                     <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={performanceSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, {month:'short'})} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(val) => `R${(val/1000).toFixed(0)}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} 
                          formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Portfolio Value']} 
                          labelFormatter={(l) => new Date(l).toLocaleDateString()}
                        />
                        <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="positions">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Portfolio Positions</CardTitle>
                      <CardDescription>Current holdings and valuations</CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search positions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                        <TableHead className="text-right">Current Price</TableHead>
                        <TableHead className="text-right">Market Value</TableHead>
                        <TableHead className="text-right">Unrealized</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPositions.length === 0 ? (
                         <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No positions found</TableCell></TableRow>
                      ) : (
                        filteredPositions.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.symbol}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{p.instrument_type.replace('_', ' ')}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{accounts.find(a => a.id === p.account_id)?.name}</TableCell>
                            <TableCell className="text-right">{Number(p.quantity || 0).toLocaleString('en-ZA')}</TableCell>
                            <TableCell className="text-right">R {Number(p.avg_cost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-mono">R {Number(p.current_price || p.avg_cost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right font-bold">R {Number(p.market_value ?? (p.quantity || 0) * (p.current_price || p.avg_cost || 0)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className={`text-right ${Number(p.unrealized_gain || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              R {Number(p.unrealized_gain || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                   <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <CardTitle>Transaction History</CardTitle>
                      <CardDescription>Record of buys, sells, and distributions</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
                      </div>
                      <Select value={txFilter} onValueChange={setTxFilter}>
                        <SelectTrigger className="w-[130px]">
                          <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="buy">Buy</SelectItem>
                          <SelectItem value="sell">Sell</SelectItem>
                          <SelectItem value="dividend">Dividend</SelectItem>
                          <SelectItem value="interest">Interest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions found</TableCell></TableRow>
                      ) : (
                        filteredTransactions.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>{new Date(t.trade_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={t.type === 'buy' ? 'default' : t.type === 'sell' ? 'destructive' : 'secondary'} className="capitalize">
                                {t.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{t.symbol || '-'}</TableCell>
                            <TableCell className="text-right">{t.quantity ? Number(t.quantity).toLocaleString('en-ZA') : '-'}</TableCell>
                            <TableCell className="text-right font-mono">{t.price ? `R ${Number(t.price).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                            <TableCell className="text-right font-mono font-medium">R {Number(t.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader><CardTitle>Detailed Performance</CardTitle></CardHeader>
                <CardContent>
                   <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={performanceSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString()} stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(val) => `R${(val/1000).toFixed(0)}k`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} 
                          formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, 'Portfolio Value']} 
                          labelFormatter={(l) => new Date(l).toLocaleDateString()}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="value" name="Portfolio Value" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
               <Card>
                <CardHeader><CardTitle>Income Reports</CardTitle></CardHeader>
                <CardContent>
                  {(() => {
                    const now = new Date();
                    const year = now.getFullYear();
                    const ytdFilter = (d: string) => new Date(d).getFullYear() === year;
                    const dividendsYTD = (transactions || []).filter(t => String(t.type).toLowerCase() === 'dividend' && ytdFilter(t.trade_date)).reduce((s, t) => s + Number(t.total_amount || 0), 0);
                    const interestYTD = (transactions || []).filter(t => String(t.type).toLowerCase() === 'interest' && ytdFilter(t.trade_date)).reduce((s, t) => s + Number(t.total_amount || 0), 0);
                    const fdAccruedTotal = Object.values(fdMetaByAccount).reduce((s, m) => {
                      if (!m.rate || !m.principal) return s;
                      const start = new Date(m.startDate || now.toISOString().slice(0,10));
                      const monthsElapsed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
                      const cappedMonths = m.termMonths ? Math.min(monthsElapsed, m.termMonths) : monthsElapsed;
                      const accrued = m.principal * m.rate * (cappedMonths / 12);
                      return s + accrued;
                    }, 0);
                    return (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Card className="bg-muted/20 border-dashed">
                            <CardContent className="p-6 text-center">
                              <p className="text-sm text-muted-foreground mb-1">Dividends (YTD)</p>
                              <p className="text-2xl font-bold text-purple-600">R {dividendsYTD.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-muted/20 border-dashed">
                            <CardContent className="p-6 text-center">
                              <p className="text-sm text-muted-foreground mb-1">Interest (YTD)</p>
                              <p className="text-2xl font-bold text-orange-600">R {interestYTD.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                            </CardContent>
                          </Card>
                          <Card className="bg-muted/20 border-dashed">
                            <CardContent className="p-6 text-center">
                              <p className="text-sm text-muted-foreground mb-1">Accrued Interest (FD)</p>
                              <p className="text-2xl font-bold text-emerald-600">R {fdAccruedTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                            </CardContent>
                          </Card>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div>
                             <h4 className="text-sm font-semibold">Data Export</h4>
                             <p className="text-sm text-muted-foreground">Download your transaction history as CSV</p>
                          </div>
                          <Button variant="outline" onClick={() => {
                            const rows = (transactions || []).map(t => ({ date: t.trade_date, type: t.type, symbol: t.symbol || '', amount: t.total_amount }));
                            const header = 'Date,Type,Symbol,Amount\n';
                            const body = rows.map(r => `${r.date},${r.type},${r.symbol},${Number(r.amount || 0)}`).join('\n');
                            const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = 'investment-transactions.csv'; a.click(); URL.revokeObjectURL(url);
                          }}>
                            <FileText className="h-4 w-4 mr-2" />
                            Export CSV
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Quick Actions Dialog */}
          <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Quick Actions</DialogTitle>
                <DialogDescription>Record investment activities</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Trades</h4>
                  <Button className="w-full justify-start" onClick={() => { setActionsOpen(false); setBuyOpen(true); }}>
                    <ArrowDownLeft className="h-4 w-4 mr-2 text-emerald-500" />
                    Record Buy
                  </Button>
                  <Button className="w-full justify-start" onClick={() => { setActionsOpen(false); setSellOpen(true); }}>
                    <ArrowUpRight className="h-4 w-4 mr-2 text-red-500" />
                    Record Sell
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Income</h4>
                  <Button className="w-full justify-start" variant="outline" onClick={() => { setActionsOpen(false); setDivOpen(true); }}>
                    <PieChartIcon className="h-4 w-4 mr-2" />
                    Record Dividend
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => { setActionsOpen(false); setIntOpen(true); }}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Interest
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Fixed Deposits</h4>
                  <Button className="w-full justify-start" variant="outline" onClick={() => { setActionsOpen(false); setFdOpen(true); }}>
                    <Landmark className="h-4 w-4 mr-2" />
                    New Fixed Deposit
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Buy Dialog */}
          <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Record Buy Order</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Investment Account</Label>
                  <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. AAPL" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Source</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setBuyOpen(false)}>Cancel</Button>
                  <Button onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      setProgress(30);
                      setProgressText("Processing Buy Order...");
                      await transactionsApi.postInvestmentBuy({ accountId: actionAccountId, symbol, quantity: parseFloat(quantity||'0'), price: parseFloat(price||'0'), date: startDate, bankAccountId: actionBankId });
                      setProgress(100);
                      await new Promise(r => setTimeout(r, 500));
                      setSuccessMessage('Investment buy posted successfully');
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setBuyOpen(false); loadAll();
                        setIsSubmitting(false);
                      }, 2000);
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                      setIsSubmitting(false);
                    }
                  }}>Record Buy</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Sell Dialog */}
          <Dialog open={sellOpen} onOpenChange={setSellOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Record Sell Order</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Investment Account</Label>
                  <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Destination</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setSellOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={async () => {
                    try {
                      await transactionsApi.postInvestmentSell({ accountId: actionAccountId, symbol, quantity: parseFloat(quantity||'0'), price: parseFloat(price||'0'), date: startDate, bankAccountId: actionBankId });
                      setSuccessMessage('Investment sell posted successfully');
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setSellOpen(false); loadAll();
                      }, 2000);
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Record Sell</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Dividend Dialog */}
          <Dialog open={divOpen} onOpenChange={setDivOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Record Dividend</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Investment Account</Label>
                    <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Destination</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Symbol (Optional)</Label>
                  <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. AAPL" />
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setDivOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      setProgress(20);
                      setProgressText("Processing Dividend...");

                      await transactionsApi.postInvestmentDividend({ accountId: actionAccountId, amount: parseFloat(amount||'0'), date: startDate, bankAccountId: actionBankId, symbol });
                      
                      setProgress(100);
                      setProgressText("Finalizing...");
                      await new Promise(r => setTimeout(r, 500));

                      setSuccessMessage('Dividend posted successfully');
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setIsSubmitting(false);
                        setDivOpen(false); loadAll();
                      }, 2000);
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                      setIsSubmitting(false);
                    }
                  }}>Record Dividend</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* Interest Dialog */}
          <Dialog open={intOpen} onOpenChange={(o) => { setIntOpen(o); if (o && actionAccountId) { const auto = fdMonthlyInterest(actionAccountId); if (auto > 0) setAmount(String(auto.toFixed(2))); } }}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Record Interest</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Investment Account</Label>
                    <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Destination</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setIntOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      setProgress(20);
                      setProgressText("Processing Interest...");

                      const auto = fdMonthlyInterest(actionAccountId);
                      const postAmt = (parseFloat(amount||'0') > 0) ? parseFloat(amount||'0') : auto;
                      await transactionsApi.postInvestmentInterest({ accountId: actionAccountId, amount: postAmt, date: startDate, bankAccountId: actionBankId, symbol });
                      
                      setProgress(100);
                      setProgressText("Finalizing...");
                      await new Promise(r => setTimeout(r, 500));

                      setSuccessMessage('Interest posted successfully');
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setIsSubmitting(false);
                        setIntOpen(false); loadAll();
                      }, 2000);
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                      setIsSubmitting(false);
                    }
                  }}>Record Interest</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {/* FD Dialog */}
          <Dialog open={fdOpen} onOpenChange={setFdOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader><DialogTitle>New Fixed Deposit</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Account/Deposit Name</Label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g., FD - 6 Months" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Source</Label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Term (months)</Label>
                    <Input inputMode="numeric" value={termMonths} onChange={e => setTermMonths(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setFdOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      setProgress(20);
                      setProgressText("Creating Fixed Deposit...");

                      const amt = parseFloat(amount||'0');
                      const r = parseFloat(rate||'0')/100;
                      await transactionsApi.postFixedDepositOpen({ name: symbol || `Fixed Deposit`, amount: amt, rate: r, termMonths: parseInt(termMonths||'0', 10), date: startDate, bankAccountId: actionBankId });
                      
                      setProgress(100);
                      setProgressText("Finalizing...");
                      await new Promise(r => setTimeout(r, 500));

                      setSuccessMessage('Fixed Deposit created successfully');
                      setIsSuccess(true);
                      setTimeout(() => {
                        setIsSuccess(false);
                        setIsSubmitting(false);
                        setFdOpen(false); loadAll();
                      }, 2000);
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                      setIsSubmitting(false);
                    }
                  }}>Create Deposit</Button>
                </DialogFooter>
              </div>
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
        </div>
      </DashboardLayout>
    </>
  );
}
