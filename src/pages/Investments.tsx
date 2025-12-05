import { useEffect, useState, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { transactionsApi } from "@/lib/transactions-api";

type InvestmentAccount = { id: string; name: string; currency: string; broker_name?: string };
type Position = { id: string; account_id: string; symbol: string; instrument_type: string; quantity: number; avg_cost: number; current_price?: number; market_value?: number; unrealized_gain?: number };
type InvestmentTx = { id: string; account_id: string; type: string; trade_date: string; symbol: string; quantity?: number; price?: number; total_amount: number; currency?: string; fx_rate?: number; fees?: number; notes?: string };

export default function Investments() {
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [companyId, setCompanyId] = useState<string>("");
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<Array<{ id: string; account_name: string }>>([]);
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [divOpen, setDivOpen] = useState(false);
  const [intOpen, setIntOpen] = useState(false);
  const [fdOpen, setFdOpen] = useState(false);
  const [actionAccountId, setActionAccountId] = useState<string>("");
  const [actionBankId, setActionBankId] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [rate, setRate] = useState<string>("");
  const [termMonths, setTermMonths] = useState<string>("12");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0,10));

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
      // find initial buy tx for this account & symbol
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
      // FD accrual: principal + accrued interest up to d
      Object.values(fdMetaByAccount).forEach(m => {
        if (!m.rate || !m.principal) return;
        const start = new Date(m.startDate || dIso);
        const monthsElapsed = Math.max(0, Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
        const cappedMonths = m.termMonths ? Math.min(monthsElapsed, m.termMonths) : monthsElapsed;
        const accrued = m.principal * m.rate * (cappedMonths / 12);
        total += m.principal + accrued;
      });
      // Add other positions static market value as baseline
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

  const COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#84CC16", "#EC4899", "#F43F5E", "#10B981"];

  return (
    <>
      <SEO title="Investments | Rigel Business" description="Manage company investments" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Investments</h1>
              <p className="text-muted-foreground mt-1">Overview, Positions, Transactions, Performance, Reports</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setBuyOpen(true)}>Record Buy</Button>
              <Button variant="outline" onClick={() => setSellOpen(true)}>Record Sell</Button>
              <Button variant="outline" onClick={() => setDivOpen(true)}>Dividend</Button>
              <Button variant="outline" onClick={() => setIntOpen(true)}>Interest</Button>
              <Button className="bg-gradient-primary" onClick={() => setFdOpen(true)}>New Fixed Deposit</Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardHeader><CardTitle>Allocation</CardTitle></CardHeader>
                <CardContent>
                  {allocation.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No positions</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={allocation} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                          {allocation.map((entry, index) => (
                            <Cell key={`alloc-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any, _n, p: any) => [`R ${Number(v).toLocaleString('en-ZA')}`, p?.payload?.name]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="positions">
              <Card>
                <CardHeader><CardTitle>Positions</CardTitle></CardHeader>
                <CardContent>
                  {positions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No positions</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Avg Cost</TableHead>
                          <TableHead className="text-right">Market Value</TableHead>
                          <TableHead className="text-right">Unrealized</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map(p => (
                          <TableRow key={p.id}>
                            <TableCell>{accounts.find(a => a.id === p.account_id)?.name || p.account_id}</TableCell>
                            <TableCell>{p.symbol}</TableCell>
                            <TableCell className="capitalize">{p.instrument_type}</TableCell>
                            <TableCell className="text-right">{Number(p.quantity || 0).toLocaleString('en-ZA')}</TableCell>
                            <TableCell className="text-right">R {Number(p.avg_cost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">R {Number(p.market_value ?? (p.quantity || 0) * (p.current_price || p.avg_cost || 0)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">R {Number(p.unrealized_gain || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No transactions</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>{new Date(t.trade_date).toLocaleDateString()}</TableCell>
                            <TableCell className="capitalize">{t.type}</TableCell>
                            <TableCell>{t.symbol || '-'}</TableCell>
                            <TableCell className="text-right">{Number(t.quantity || 0).toLocaleString('en-ZA')}</TableCell>
                            <TableCell className="text-right">R {Number(t.price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">R {Number(t.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
                <CardContent>
                  {performanceSeries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No performance data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={performanceSeries}>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }} formatter={(v: any) => [`R ${Number(v).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, 'Portfolio Value']} />
                        <Legend />
                        <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card>
                <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
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
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <p className="text-sm text-muted-foreground">Dividends (YTD)</p>
                            <p className="text-2xl font-bold">R {dividendsYTD.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Interest (YTD)</p>
                            <p className="text-2xl font-bold">R {interestYTD.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">FD Interest Accrued (Total)</p>
                            <p className="text-2xl font-bold">R {fdAccruedTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button variant="outline" onClick={() => {
                            const rows = (transactions || []).map(t => ({ date: t.trade_date, type: t.type, symbol: t.symbol || '', amount: t.total_amount }));
                            const header = 'Date,Type,Symbol,Amount\n';
                            const body = rows.map(r => `${r.date},${r.type},${r.symbol},${Number(r.amount || 0)}`).join('\n');
                            const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = 'investment-transactions.csv'; a.click(); URL.revokeObjectURL(url);
                          }}>Export CSV</Button>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
            <DialogContent className="sm:max-w-[560px] p-4">
              <DialogHeader><DialogTitle>Record Buy</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Investment Account</label>
                  <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Symbol</label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Bank</label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm">Quantity</label>
                    <Input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Price</label>
                    <Input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setBuyOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      await transactionsApi.postInvestmentBuy({ accountId: actionAccountId, symbol, quantity: parseFloat(quantity||'0'), price: parseFloat(price||'0'), date: startDate, bankAccountId: actionBankId });
                      toast({ title: 'Recorded', description: 'Investment buy posted' });
                      setBuyOpen(false); loadAll();
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Post</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={sellOpen} onOpenChange={setSellOpen}>
            <DialogContent className="sm:max-w-[560px] p-4">
              <DialogHeader><DialogTitle>Record Sell</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm">Investment Account</label>
                  <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Symbol</label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Bank</label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm">Quantity</label>
                    <Input inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Price</label>
                    <Input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSellOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      await transactionsApi.postInvestmentSell({ accountId: actionAccountId, symbol, quantity: parseFloat(quantity||'0'), price: parseFloat(price||'0'), date: startDate, bankAccountId: actionBankId });
                      toast({ title: 'Recorded', description: 'Investment sell posted' });
                      setSellOpen(false); loadAll();
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Post</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={divOpen} onOpenChange={setDivOpen}>
            <DialogContent className="sm:max-w-[560px] p-4">
              <DialogHeader><DialogTitle>Record Dividend</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Investment Account</label>
                    <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">Bank</label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm">Amount</label>
                    <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Symbol (optional)</label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDivOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      await transactionsApi.postInvestmentDividend({ accountId: actionAccountId, amount: parseFloat(amount||'0'), date: startDate, bankAccountId: actionBankId, symbol });
                      toast({ title: 'Recorded', description: 'Dividend posted' });
                      setDivOpen(false); loadAll();
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Post</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={intOpen} onOpenChange={(o) => { setIntOpen(o); if (o && actionAccountId) { const auto = fdMonthlyInterest(actionAccountId); if (auto > 0) setAmount(String(auto.toFixed(2))); } }}>
            <DialogContent className="sm:max-w-[560px] p-4">
              <DialogHeader><DialogTitle>Record Interest</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Investment Account</label>
                    <Select value={actionAccountId} onValueChange={(v: any) => setActionAccountId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (<SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">Bank</label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Amount</label>
                    <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIntOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      const auto = fdMonthlyInterest(actionAccountId);
                      const postAmt = (parseFloat(amount||'0') > 0) ? parseFloat(amount||'0') : auto;
                      await transactionsApi.postInvestmentInterest({ accountId: actionAccountId, amount: postAmt, date: startDate, bankAccountId: actionBankId, symbol });
                      toast({ title: 'Recorded', description: 'Interest posted' });
                      setIntOpen(false); loadAll();
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Post</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={fdOpen} onOpenChange={setFdOpen}>
            <DialogContent className="sm:max-w-[600px] p-4">
              <DialogHeader><DialogTitle>New Fixed Deposit</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Account Name</label>
                    <Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g., FD - 6 Months" />
                  </div>
                  <div>
                    <label className="text-sm">Bank</label>
                    <Select value={actionBankId} onValueChange={(v: any) => setActionBankId(v)}>
                      <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(b => (<SelectItem key={b.id} value={b.id}>{b.account_name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm">Amount</label>
                    <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Interest Rate (%)</label>
                    <Input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Term (months)</label>
                    <Input inputMode="numeric" value={termMonths} onChange={e => setTermMonths(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm">Start Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setFdOpen(false)}>Cancel</Button>
                  <Button className="bg-gradient-primary" onClick={async () => {
                    try {
                      const amt = parseFloat(amount||'0');
                      const r = parseFloat(rate||'0')/100;
                      await transactionsApi.postFixedDepositOpen({ name: symbol || `Fixed Deposit`, amount: amt, rate: r, termMonths: parseInt(termMonths||'0', 10), date: startDate, bankAccountId: actionBankId });
                      toast({ title: 'Fixed Deposit Created', description: 'FD posted and recorded' });
                      setFdOpen(false); loadAll();
                    } catch (e: any) {
                      toast({ title: 'Error', description: e.message, variant: 'destructive' });
                    }
                  }}>Create</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
