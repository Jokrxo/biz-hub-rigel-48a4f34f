import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { useNavigate } from "react-router-dom";
import { Activity, Link as LinkIcon, ShieldCheck, Sparkles } from "lucide-react";
import StellaLumenLogo from "@/components/Stella/StellaLumenLogo";
import { systemOverview, accountingPrimer, plainEnglishGuide, taxQuickTips } from "./knowledge";

interface FeedItem { id: string; title: string; description: string; ts: string }
interface ChatMsg { role: 'bot' | 'user'; text: string; ts: string }

interface StellaBotModalProps { open: boolean; onOpenChange: (v: boolean) => void }

export const StellaBotModal = ({ open, onOpenChange }: StellaBotModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ask");
  const [companyId, setCompanyId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<Array<{ label: string; detail?: string; navigateTo?: string }>>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [metrics, setMetrics] = useState<{ tx: number; inv: number; po: number; bills: number; budgets: number; bank: number; customers: number; items: number }>({ tx: 0, inv: 0, po: 0, bills: 0, budgets: 0, bank: 0, customers: 0, items: 0 });
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'bot', text: 'Hi, I am Stella. How can I help you today?', ts: new Date().toISOString() }]);
  const [chatInput, setChatInput] = useState("");
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [model, setModel] = useState<string>("gpt-4o-mini");
  useEffect(() => {
    if (!open) return;
    const hash = window.location.hash;
    if (hash === '#problems_and_diagnostics') setActiveTab('diagnostics');
    const onHashChange = () => {
      if (window.location.hash === '#problems_and_diagnostics') setActiveTab('diagnostics');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => { window.removeEventListener('hashchange', onHashChange); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    const init = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (!profile?.company_id) return;
      setCompanyId(profile.company_id);
      await loadMetrics(profile.company_id, ac.signal);
      wireRealtime(profile.company_id);
      const savedEnabled = localStorage.getItem("stella_ai_enabled");
      const savedKey = localStorage.getItem("stella_openai_key");
      const savedModel = localStorage.getItem("stella_openai_model");
      const envKey = (import.meta as any).env?.VITE_OPENAI_API_KEY || "";
      setAiEnabled(savedEnabled ? (savedEnabled === "true") : true);
      const useKey = savedKey || envKey || "";
      setOpenaiKey(useKey);
      if (useKey) localStorage.setItem("stella_openai_key", useKey);
      setModel(savedModel || "gpt-4o-mini");
    };
    init();
    return () => { ac.abort(); };
  }, [open, user?.id]);

  const loadMetrics = useCallback(async (cid: string, signal?: AbortSignal) => {
    try {
      const [tx, inv, po, bills, budgets, bank, customers, items] = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("invoices").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("purchase_orders").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("bills").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("budgets").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("bank_accounts").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("customers").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any),
        supabase.from("items").select("id", { count: "exact" }).eq("company_id", cid).limit(1).abortSignal(signal as any)
      ]);
      setMetrics({
        tx: (tx.count as number) || 0,
        inv: (inv.count as number) || 0,
        po: (po.count as number) || 0,
        bills: (bills.count as number) || 0,
        budgets: (budgets.count as number) || 0,
        bank: (bank.count as number) || 0,
        customers: (customers.count as number) || 0,
        items: (items.count as number) || 0
      });
    } catch {}
  }, []);

  const wireRealtime = useCallback((cid: string) => {
    const channel = (supabase as any)
      .channel("stella")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("Transaction", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_entries" }, (payload: any) => pushFeed("Entry", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("Invoice", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "bills", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("Bill", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_orders", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("PO", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "budgets", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("Budget", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("Bank", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (payload: any) => pushFeed("Item", payload))
      .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `company_id=eq.${cid}` }, (payload: any) => pushFeed("Customer", payload))
      .subscribe();
    return () => { (supabase as any).removeChannel(channel) };
  }, [companyId]);

  const pushFeed = useCallback((kind: string, payload: any) => {
    const row: any = payload?.new || payload?.old || {};
    if (row.company_id && companyId && row.company_id !== companyId) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const title = `${kind} ${payload.eventType || payload.event || "update"}`;
    const description = row.description || row.invoice_number || row.reference_number || row.account_name || row.name || String(row.id || "");
    setFeed(prev => [{ id, title, description, ts: new Date().toISOString() }, ...prev].slice(0, 50));
  }, [companyId]);

  const respond = (q: string) => {
    const lower = q.trim().toLowerCase();
    const isGreeting = ["hi","hello","hey","hy"].some(g => lower === g || lower.startsWith(g));
    const res: string[] = [];
    if (isGreeting) res.push('Hello! I can help with everyday finance tasks. Try “unpaid invoices”, “bank balance”, “VAT totals”, or “budget actual for November”.');
    if (lower.includes('budget') && lower.includes('actual')) res.push('Budget actuals: computed from posted entries for the month. Steps: Budget → select month → view “Actual vs Budget”.');
    if (lower.includes('unpaid') && lower.includes('invoice')) res.push('Unpaid invoices: Sales → Invoices; filter by Status ≠ paid; shows aging so you can follow up.');
    if (lower.includes('bank') && lower.includes('balance')) res.push('Bank balances update as you record receipts/payments. Steps: Bank → Accounts → Reconcile to match statements.');
    if (lower.includes('purchase') || lower.includes('ap')) res.push('Payables/AP: Purchase → Bills; record supplier bills, track unpaid and due dates.');
    if (lower.includes('vat')) res.push('VAT: Input on purchases (claim back), Output on sales (pay). Use VAT exclusive/inclusive rules; Tax → VAT to see totals. Example: Net R100 at 15% → VAT R15, Total R115.');
    if (lower === 'tax' || lower.includes('tax')) res.push('Tax overview: start with profit, adjust for non-deductibles and allowances; VAT201 from Output minus Input. See Tax module.');
    if (lower.includes('transactions')) res.push('Transactions: record income/expense; use date/type filters and drill into ledger entries for details.');
    if (lower.includes('sales')) res.push('Sales: create invoices/quotes; track AR and unpaid invoices, record customer payments.');
    if (lower.includes('cash flow')) res.push('Cash flow: Operating (day to day), Investing (assets), Financing (loans/shares). Positive net change increases closing cash.');
    // Add plain-English context for non-accountants
    res.push('Plain-English: Revenue is money in; expenses are costs; receivables mean customers owe you; payables mean you owe suppliers; VAT Output is what you pay, VAT Input is what you claim back.');
    if (res.length === 0) res.push('I can help with Budget, Transactions, Sales, Purchase, Bank, and VAT. Ask me something like “budget actual for November” or “unpaid invoices”.');
    return res.join(' ');
  };

  const sendChat = async () => {
    const q = chatInput.trim();
    if (!q) return;
    const now = new Date().toISOString();
    setMessages(prev => [...prev, { role: 'user', text: q, ts: now }]);
    const lower = q.toLowerCase();
    let answer: string | null = null;
    // Quick smart answers with live data where useful
    const wantsDebtors = ["debtors","receivable","receiv","ar"].some(k => lower.includes(k));
    const wantsVat = lower.includes("vat");
    const wantsUnpaidInvoices = lower.includes('unpaid') && lower.includes('invoice');
    if (companyId && (wantsDebtors || wantsVat || wantsUnpaidInvoices)) {
      try {
        if (wantsDebtors) {
          const { data } = await supabase
            .from('invoices')
            .select('total_amount, amount_paid, status')
            .eq('company_id', companyId)
            .in('status', ['sent','approved','posted','partial','unpaid']);
          const outstanding = (data || []).reduce((s: number, r: any) => {
            const total = Number(r.total_amount || 0);
            const paid = Number(r.amount_paid || 0);
            return s + Math.max(0, total - paid);
          }, 0);
          answer = `Debtors (accounts receivable) outstanding: R ${Number(outstanding).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}. Plain-English: customers owe you this amount. To collect: Sales → Invoices → filter unpaid → record receipts.`;
        }
        if (!answer && wantsVat) {
          const { data: tx } = await supabase
            .from('transactions')
            .select('transaction_type, vat_rate, vat_inclusive, total_amount, vat_amount, base_amount, status')
            .eq('company_id', companyId)
            .in('status', ['approved','posted','pending']);
          let out = 0, inn = 0;
          (tx || []).forEach((t: any) => {
            const type = String(t.transaction_type || '').toLowerCase();
            const isIncome = ['income','sales','receipt'].includes(type);
            const isPurchase = ['expense','purchase','bill','product_purchase'].includes(type);
            const rate = Number(t.vat_rate || 0);
            const total = Number(t.total_amount || 0);
            const base = Number(t.base_amount || 0);
            const inclusive = Boolean(t.vat_inclusive);
            let vat = Number(t.vat_amount || 0);
            if (vat === 0 && rate > 0) {
              if (inclusive) {
                const net = base > 0 ? base : total / (1 + rate / 100);
                vat = total - net;
              } else {
                vat = total - (base > 0 ? base : total);
              }
            }
            if (isIncome) out += Math.max(0, vat);
            if (isPurchase) inn += Math.max(0, vat);
          });
          const net = out - inn;
          const pos = net >= 0 ? 'payable' : 'receivable';
          answer = `VAT position: R ${Math.abs(net).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} ${pos}. Plain-English: ${pos === 'payable' ? 'you owe SARS this VAT' : 'SARS owes you a refund'}. Steps: Tax → VAT → prepare VAT201.`;
        }
        if (!answer && wantsUnpaidInvoices) {
          const { count } = await supabase.from('invoices').select('id', { count: 'exact' }).eq('company_id', companyId).neq('status', 'paid').limit(1);
          answer = `Unpaid invoices: ${count || 0}. Steps: Sales → Invoices → filter Status ≠ paid → follow up.`;
        }
      } catch {}
    }
    if (!answer && companyId && !aiEnabled) {
      if (lower.includes('unpaid') && lower.includes('invoice')) {
        const { count } = await supabase.from('invoices').select('id', { count: 'exact' }).eq('company_id', companyId).neq('status', 'paid').limit(1);
        answer = `Unpaid invoices: ${count || 0}`;
      } else if (lower.includes('recent') && lower.includes('transaction')) {
        const { data } = await supabase.from('transactions').select('description, transaction_date, total_amount').eq('company_id', companyId).order('transaction_date', { ascending: false }).limit(5);
        const list = (data || []).map((r: any) => `${r.transaction_date} • ${r.description || ''} • R ${(Number(r.total_amount || 0)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`).join('\n');
        answer = list ? `Recent transactions:\n${list}` : 'No recent transactions found';
      } else if (lower.includes('unpaid') && lower.includes('bill')) {
        const { count } = await supabase.from('bills').select('id', { count: 'exact' }).eq('company_id', companyId).neq('status', 'paid').limit(1);
        answer = `Unpaid bills: ${count || 0}`;
      }
    }
    if (!answer && aiEnabled && openaiKey) {
      try {
        const context = [
          `CompanyId: ${companyId}`,
          `Metrics: tx=${metrics.tx}, inv=${metrics.inv}, po=${metrics.po}, bills=${metrics.bills}, budgets=${metrics.budgets}, bank=${metrics.bank}, customers=${metrics.customers}, items=${metrics.items}`
        ].join(" | ");
        const sys = [
          "You are Stella, an assistant for a finance manager web app.",
          "Answer actionable accounting and tax questions with concise, accurate guidance.",
          "If the user mentions modules (Transactions, Sales, Purchase, Bank, Budget, VAT), explain where in the app to perform the task and add practical steps.",
          "Always include a short Plain-English explanation suitable for non-accountants.",
          "When possible, provide brief calculations and IFRS/US GAAP classification notes.",
          `Context: ${context}`,
          systemOverview,
          accountingPrimer,
          plainEnglishGuide,
          taxQuickTips
        ].join("\n\n");
        const history = messages.map(m => ({ role: m.role === 'bot' ? 'assistant' as const : 'user' as const, content: m.text }));
        const body = { model, messages: [{ role: 'system', content: sys }, ...history, { role: 'user', content: q }], temperature: 0.3 };
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
          body: JSON.stringify(body)
        });
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content || null;
        answer = text || null;
      } catch {}
    }
    if (!answer) answer = respond(q);
    setMessages(prev => [...prev, { role: 'bot', text: answer!, ts: new Date().toISOString() }]);
    setChatInput("");
  };

  useEffect(() => {
    const handler = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      if (!q) { setAnswers([]); return; }
      const res: Array<{ label: string; detail?: string; navigateTo?: string }> = [];
      if (q.includes("budget") && q.includes("actual")) res.push({ label: "Budget actuals", detail: "Actuals come from posted transaction entries for selected month", navigateTo: "/budget" });
      if (q.includes("unpaid") && q.includes("invoice")) res.push({ label: "Unpaid invoices", detail: "Open AR by customer", navigateTo: "/sales?tab=invoices" });
      if (q.includes("bank") && q.includes("balance")) res.push({ label: "Bank balance", detail: "Open Bank module", navigateTo: "/bank" });
      if (q.includes("purchase") || q.includes("ap")) res.push({ label: "AP dashboard", detail: "Supplier KPIs and aging", navigateTo: "/purchase?tab=ap-dashboard" });
      if (q.includes("vat")) res.push({ label: "VAT overview", detail: "Input/Output VAT totals", navigateTo: "/tax?tab=vat" });
      setAnswers(res.length > 0 ? res : [{ label: "Open Search", detail: "Use global search for detailed results", navigateTo: "/" }]);
    }, 250);
    return () => clearTimeout(handler);
  }, [query]);

  const metricBadges = useMemo(() => [
    { label: "Transactions", value: metrics.tx },
    { label: "Invoices", value: metrics.inv },
    { label: "Purchase Orders", value: metrics.po },
    { label: "Bills", value: metrics.bills },
    { label: "Budgets", value: metrics.budgets },
    { label: "Bank Accounts", value: metrics.bank },
    { label: "Customers", value: metrics.customers },
    { label: "Items", value: metrics.items }
  ], [metrics]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><StellaLumenLogo className="h-5 w-5" /> Stella Bot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {metricBadges.map(m => (
              <Badge key={m.label} variant="secondary">{m.label}: {m.value}</Badge>
            ))}
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="ask">Ask</TabsTrigger>
              <TabsTrigger value="feed">Live Feed</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
              <TabsTrigger value="diagnostics">Problems & Diagnostics</TabsTrigger>
            </TabsList>
            <TabsContent value="chat">
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto space-y-2 p-2 border rounded-md">
                  {messages.map((m, i) => (
                    <div key={i} className={`text-sm ${m.role === 'bot' ? 'text-muted-foreground' : 'text-foreground'}`}>
                      <span className="font-medium mr-2">{m.role === 'bot' ? 'Stella' : 'You'}:</span>{m.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Type your question…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} />
                  <Button onClick={sendChat}>Send</Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="ask">
              <div className="space-y-3">
                <Input placeholder="Ask Stella…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="space-y-2">
                  {answers.map((a, i) => (
                    <Card key={i} className="hover:bg-muted/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{a.label}</div>
                          {a.detail && <div className="text-xs text-muted-foreground">{a.detail}</div>}
                        </div>
                        {a.navigateTo && <Button variant="outline" size="sm" onClick={() => { navigate(a.navigateTo!); onOpenChange(false); }}><LinkIcon className="h-4 w-4 mr-1" />Open</Button>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="feed">
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {feed.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No activity yet</div>
                ) : feed.map(item => (
                  <Card key={item.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <Activity className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{new Date(item.ts).toLocaleString()}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="shortcuts">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => { navigate('/transactions'); onOpenChange(false); }}>Transactions</Button>
                <Button onClick={() => { navigate('/sales?tab=invoices'); onOpenChange(false); }}>Sales</Button>
                <Button onClick={() => { navigate('/purchase?tab=ap-dashboard'); onOpenChange(false); }}>Purchase</Button>
                <Button onClick={() => { navigate('/budget'); onOpenChange(false); }}>Budget</Button>
                <Button onClick={() => { navigate('/bank'); onOpenChange(false); }}>Bank</Button>
                <Button onClick={() => { navigate('/tax?tab=vat'); onOpenChange(false); }}>VAT</Button>
              </div>
            </TabsContent>
            <TabsContent value="diagnostics">
              <div id="problems_and_diagnostics" className="space-y-2">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><span className="text-sm">Company-scoped realtime enabled</span></div>
                <div className="text-xs text-muted-foreground">Live updates bound to your company only.</div>
              <div className="mt-4 p-3 border rounded-md space-y-3">
                <div className="flex items-center gap-2">
                  <Switch checked={aiEnabled} onCheckedChange={(v) => { setAiEnabled(v); localStorage.setItem('stella_ai_enabled', v ? 'true' : 'false'); }} />
                  <span className="text-sm">Enable OpenAI</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input type="password" placeholder="OpenAI API Key" value={openaiKey} onChange={(e) => { setOpenaiKey(e.target.value); localStorage.setItem('stella_openai_key', e.target.value); }} />
                  </div>
                  <div>
                    <Select value={model} onValueChange={(v) => { setModel(v); localStorage.setItem('stella_openai_model', v); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Your key is stored locally. The assistant uses system context and accounting rules to answer.
                </div>
              </div>
            </div>
          </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
