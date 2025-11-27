import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download, Eye, Calendar, FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { exportFinancialReportToExcel, exportFinancialReportToPDF } from "@/lib/export-utils";

interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  total_debits: number;
  total_credits: number;
  balance: number;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  description: string;
  debit: number;
  credit: number;
  reference_id: string;
}

export const GAAPFinancialStatements = () => {
  const [loading, setLoading] = useState(false);
  const [periodMode, setPeriodMode] = useState<'monthly' | 'annual'>('annual');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0,7)); // YYYY-MM
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<string>('balance-sheet');
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1); // January 1st
    return date.toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [drilldownAccount, setDrilldownAccount] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [accountingEquation, setAccountingEquation] = useState<{
    is_valid: boolean;
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    difference: number;
    error_message: string;
  } | null>(null);
  const [cashFlow, setCashFlow] = useState<{
    operating_inflows: number;
    operating_outflows: number;
    net_cash_from_operations: number;
    investing_inflows: number;
    investing_outflows: number;
    net_cash_from_investing: number;
    financing_inflows: number;
    financing_outflows: number;
    net_cash_from_financing: number;
    opening_cash_balance: number;
    closing_cash_balance: number;
    net_change_in_cash: number;
  } | null>(null);
  const [ppeBookValue, setPpeBookValue] = useState<number>(0);
  const [openingEquityTotal, setOpeningEquityTotal] = useState<number>(0);
  const [fallbackCOGS, setFallbackCOGS] = useState<number>(0);
  const [vatNet, setVatNet] = useState<number>(0);
  const [ppeDisposalProceeds, setPpeDisposalProceeds] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { loadFinancialData(); }, [periodStart, periodEnd]);

  useEffect(() => {
    if (periodMode === 'monthly') {
      const [y, m] = selectedMonth.split('-').map((v) => parseInt(v, 10));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    } else {
      const start = new Date(selectedYear, 0, 1);
      const end = new Date(selectedYear, 11, 31);
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    }
  }, [periodMode, selectedMonth, selectedYear]);

  // Load cash flow whenever cash-flow tab is active or period changes
  useEffect(() => { if (activeTab === 'cash-flow') { loadCashFlow(); } }, [activeTab, periodStart, periodEnd]);

  async function loadFinancialData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: companyProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!companyProfile?.company_id) throw new Error("Company not found");

      // Fetch period-scoped trial balance using transaction entry dates
      const tbData = await fetchTrialBalanceForPeriod(companyProfile.company_id, periodStart, periodEnd);
      const normalized = (tbData || []).map((r: any) => ({
        account_id: String(r.account_id || ''),
        account_code: String(r.account_code || ''),
        account_name: String(r.account_name || ''),
        account_type: String(r.account_type || ''),
        normal_balance: String(r.normal_balance || 'debit'),
        total_debits: Number(r.total_debits || 0),
        total_credits: Number(r.total_credits || 0),
        balance: Number(r.balance || 0),
      }));
      setTrialBalance(normalized);

      const cogsFallback = await calculateCOGSFromInvoices(companyProfile.company_id, periodStart, periodEnd);
      setFallbackCOGS(cogsFallback);

      const { data: fa } = await supabase
        .from('fixed_assets')
        .select('cost, accumulated_depreciation, status')
        .eq('company_id', companyProfile.company_id);
      const ppeSum = (fa || [])
        .filter((a: any) => String(a.status || 'active').toLowerCase() !== 'disposed')
        .reduce((sum: number, a: any) => sum + Math.max(0, Number(a.cost || 0) - Number(a.accumulated_depreciation || 0)), 0);
      setPpeBookValue(ppeSum);

      // Aggregate opening balances into 3900: Opening Balance Equity
      let bankOpening = 0;
      let openingAssetsBook = 0;
      const { data: openingCoa } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', companyProfile.company_id)
        .eq('account_code', '3900')
        .maybeSingle();
      const openingAccountId = openingCoa ? (openingCoa as any).id as string : null;
      if (openingAccountId) {
        const { data: openingEntries } = await supabase
          .from('transaction_entries')
          .select(`credit, transactions!inner ( transaction_date, description, transaction_type, company_id )`)
          .eq('account_id', openingAccountId)
          .eq('transactions.company_id', companyProfile.company_id)
          .lte('transactions.transaction_date', periodEnd);
        bankOpening = (openingEntries || []).reduce((sum: number, e: any) => sum + Number(e.credit || 0), 0);
      }
      const { data: openingAssets } = await supabase
        .from('fixed_assets')
        .select('cost, accumulated_depreciation, status, description')
        .eq('company_id', companyProfile.company_id);
      openingAssetsBook = (openingAssets || [])
        .filter((a: any) => String(a.status || 'active').toLowerCase() !== 'disposed')
        .filter((a: any) => String(a.description || '').toLowerCase().includes('[opening]'))
        .reduce((sum: number, a: any) => sum + Math.max(0, Number(a.cost || 0) - Number(a.accumulated_depreciation || 0)), 0);
      setOpeningEquityTotal(bankOpening + openingAssetsBook);

      const { data: profileVatTx } = await supabase
        .from('transactions')
        .select('transaction_date, transaction_type, vat_rate, vat_inclusive, total_amount, vat_amount, base_amount')
        .eq('company_id', companyProfile.company_id)
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd)
        .in('status', ['approved','posted','pending']);
      let out = 0;
      let inn = 0;
      (profileVatTx || []).forEach((t: any) => {
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
      setVatNet(out - inn);

      const { data: disposals } = await supabase
        .from('transactions')
        .select('transaction_date, transaction_type, total_amount, status')
        .eq('company_id', companyProfile.company_id)
        .eq('transaction_type', 'asset_disposal')
        .gte('transaction_date', periodStart)
        .lte('transaction_date', periodEnd)
        .in('status', ['approved','posted','pending']);
      const proceeds = (disposals || [])
        .reduce((sum: number, t: any) => sum + Math.max(0, Number(t.total_amount || 0)), 0);
      setPpeDisposalProceeds(proceeds);

      // Validate accounting equation
      const { data: equation, error: eqError } = await supabase
        .rpc('validate_accounting_equation', { _company_id: companyProfile.company_id });

      if (eqError) throw eqError;
      if (equation && equation.length > 0) {
        setAccountingEquation(equation[0]);
      }

    } catch (error: any) {
      console.error('Error loading financial data:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: companyProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyProfile?.company_id) return;

    await supabase.rpc('refresh_afs_cache', { _company_id: companyProfile.company_id });
    await loadFinancialData();
    toast({ title: "Success", description: "Financial statements refreshed" });
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    try {
      if (type === 'pdf') {
        window.print();
        return;
      }
      // Build simple CSV for Excel
      const header = ['Account Code', 'Account Name', 'Type', 'Normal Balance', 'Debits', 'Credits', 'Balance'];
      const rows = trialBalance.map(r => [
        r.account_code,
        r.account_name,
        r.account_type,
        r.normal_balance,
        r.total_debits,
        r.total_credits,
        r.balance,
      ]);
      const csv = [header, ...rows]
        .map(cols => cols.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const label = periodMode === 'monthly' ? selectedMonth : `${selectedYear}`;
      a.download = `AFS_${label}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: 'Export error', description: e.message || 'Could not export', variant: 'destructive' });
    }
  };

  const handleStatementExport = (report: 'bs' | 'pl' | 'cf', type: 'pdf' | 'excel') => {
    try {
      if (report === 'bs') {
        const currentAssets = trialBalance.filter(r =>
          r.account_type.toLowerCase() === 'asset' &&
          (r.account_name.toLowerCase().includes('cash') ||
           r.account_name.toLowerCase().includes('bank') ||
           r.account_name.toLowerCase().includes('receivable') ||
           r.account_name.toLowerCase().includes('inventory') ||
           parseInt(r.account_code) < 1500)
        );
        const nonCurrentAssetsAll = trialBalance.filter(r => r.account_type.toLowerCase() === 'asset' && !currentAssets.includes(r));
        const accDepRows = nonCurrentAssetsAll.filter(r => r.account_name.toLowerCase().includes('accumulated'));
        const nonCurrentAssets = nonCurrentAssetsAll.filter(r => !r.account_name.toLowerCase().includes('accumulated'));
        const normalizeName = (name: string) => name.toLowerCase().replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const nbvFor = (assetRow: any) => {
          const base = normalizeName(assetRow.account_name);
          const related = accDepRows.filter((ad: any) => {
            const adBase = normalizeName(ad.account_name);
            return adBase.includes(base) || base.includes(adBase);
          });
          const accTotal = related.reduce((sum: number, r: any) => sum + r.balance, 0);
          return assetRow.balance - accTotal;
        };
    const currentLiabilitiesBase = trialBalance.filter(r => {
      const isLiab = r.account_type.toLowerCase() === 'liability';
      const name = r.account_name.toLowerCase();
      const code = String(r.account_code);
      const isPayableOrTax = (name.includes('payable') || name.includes('sars'));
      const isVat = name.includes('vat');
      const isLoan = name.includes('loan');
      const isLongLoan = isLoan && (code === '2400' || name.includes('long'));
      return isLiab && isPayableOrTax && !isVat && !isLongLoan;
    });
    const isLoanLiability = (r: any) => r.account_type.toLowerCase() === 'liability' && r.account_name.toLowerCase().includes('loan');
    const loanShort = trialBalance.filter(r => isLoanLiability(r) && (String(r.account_code) === '2300' || r.account_name.toLowerCase().includes('short')));
    const currentLiabilities = [...currentLiabilitiesBase, ...loanShort.filter(ls => !currentLiabilitiesBase.some(b => b.account_id === ls.account_id))];
        const vatInputAsAssets = trialBalance.filter(r =>
          (r.account_name.toLowerCase().includes('vat input') || r.account_name.toLowerCase().includes('vat receivable'))
        );
        const currentSet = new Set(currentLiabilities.map(r => r.account_id));
        const nonCurrentLiabilities = trialBalance.filter(r => r.account_type.toLowerCase() === 'liability' && !currentSet.has(r.account_id));
        const equity = trialBalance.filter(r => r.account_type.toLowerCase() === 'equity');
        const revenueRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
        const expenseRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat'));
        const totalRevenue = revenueRows.reduce((sum, r) => sum + r.balance, 0);
        const totalExpenses = expenseRows.reduce((sum, r) => sum + r.balance, 0);
        const netProfitForPeriod = totalRevenue - totalExpenses;
        const retainedIndex = equity.findIndex(r => r.account_name.toLowerCase().includes('retained earning'));
        const equityDisplay: any[] = [...equity];
        if (retainedIndex >= 0) {
          const retained = equity[retainedIndex];
          const adjusted = { ...retained, balance: retained.balance + netProfitForPeriod } as any;
          equityDisplay.splice(retainedIndex, 1, adjusted);
        } else {
          equityDisplay.push({ account_id: 'retained-synthetic', account_code: '—', account_name: 'Retained Earnings (adjusted)', account_type: 'equity', balance: netProfitForPeriod } as any);
        }
        const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0);
        const totalNonCurrentAssets = ppeBookValue;
        const totalAssets = totalCurrentAssets + ppeBookValue;
        const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0);
        const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
        const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
        const totalEquity = equityDisplay.reduce((sum, r) => sum + r.balance, 0);
        const data = [
          { account: 'ASSETS', amount: 0, type: 'header' },
          { account: 'Current Assets', amount: 0, type: 'subheader' },
          ...currentAssets.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'asset' })),
          { account: 'Total Current Assets', amount: totalCurrentAssets, type: 'subtotal' },
          { account: 'Non-current Assets', amount: 0, type: 'subheader' },
          ...nonCurrentAssets.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: nbvFor(r), type: 'asset' })),
          ...vatInputAsAssets.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'asset' })),
          { account: 'Property, Plant & Equipment (Book Value)', amount: ppeBookValue, type: 'asset' },
          { account: 'Total Non-current Assets', amount: totalNonCurrentAssets, type: 'subtotal' },
          { account: 'TOTAL ASSETS', amount: totalAssets, type: 'total' },
          { account: 'LIABILITIES', amount: 0, type: 'header' },
          { account: 'Current Liabilities', amount: 0, type: 'subheader' },
          ...currentLiabilities.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'liability' })),
          { account: 'Total Current Liabilities', amount: totalCurrentLiabilities, type: 'subtotal' },
          { account: 'Non-current Liabilities', amount: 0, type: 'subheader' },
          ...nonCurrentLiabilities.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'liability' })),
          { account: 'Total Non-current Liabilities', amount: totalNonCurrentLiabilities, type: 'subtotal' },
          { account: 'Total Liabilities', amount: totalLiabilities, type: 'subtotal' },
          { account: 'EQUITY', amount: 0, type: 'header' },
          ...equityDisplay.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'equity' })),
          { account: 'Total Equity', amount: totalEquity, type: 'subtotal' },
          { account: 'TOTAL LIABILITIES & EQUITY', amount: totalLiabilities + totalEquity, type: 'final' }
        ];
        const reportName = 'Statement of Financial Position';
        const periodLabel = `As at ${periodEnd}`;
        const filename = `Balance_Sheet_${periodEnd}`;
        if (type === 'pdf') {
          exportFinancialReportToPDF(data, reportName, periodLabel, filename);
        } else {
          exportFinancialReportToExcel(data, reportName, filename);
        }
        return;
      }
      if (report === 'pl') {
        const revenue = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
        const expenses = trialBalance.filter(r => String(r.account_type || '').toLowerCase() === 'expense');
        const costOfSales = expenses.filter(r => r.account_name.toLowerCase().includes('cost of') || r.account_code.startsWith('50'));
        const operatingExpenses = expenses
          .filter(r => !costOfSales.includes(r))
          .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'));
        const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
        const totalCostOfSales = costOfSales.reduce((sum, r) => sum + r.balance, 0);
        const grossProfit = totalRevenue - totalCostOfSales;
        const totalOperatingExpenses = operatingExpenses.reduce((sum, r) => sum + r.balance, 0);
        const netProfit = grossProfit - totalOperatingExpenses;
        const data = [
          { account: 'REVENUE', amount: 0, type: 'header' },
          ...revenue.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'income' })),
          { account: 'Total Revenue', amount: totalRevenue, type: 'subtotal' },
          { account: 'COST OF SALES', amount: 0, type: 'header' },
          ...costOfSales.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'expense' })),
          { account: 'Total Cost of Sales', amount: totalCostOfSales, type: 'subtotal' },
          { account: 'GROSS PROFIT', amount: grossProfit, type: 'subtotal' },
          { account: 'OPERATING EXPENSES', amount: 0, type: 'header' },
          ...operatingExpenses.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'expense' })),
          { account: 'Total Operating Expenses', amount: totalOperatingExpenses, type: 'subtotal' },
          { account: 'NET PROFIT/(LOSS)', amount: netProfit, type: 'final' }
        ];
        const reportName = 'Income Statement';
        const periodLabel = `For the period ${periodStart} to ${periodEnd}`;
        const filename = `Income_Statement_${periodStart}_to_${periodEnd}`;
        if (type === 'pdf') {
          exportFinancialReportToPDF(data, reportName, periodLabel, filename);
        } else {
          exportFinancialReportToExcel(data, reportName, filename);
        }
        return;
      }
      if (report === 'cf') {
        if (!cashFlow) return;
        const data = [
          { account: 'Operating Activities', amount: 0, type: 'header' },
          { account: 'Cash Inflows', amount: cashFlow.operating_inflows, type: 'income' },
          { account: 'Cash Outflows', amount: -Math.abs(cashFlow.operating_outflows), type: 'expense' },
          { account: 'Net Cash from Operations', amount: cashFlow.net_cash_from_operations, type: 'subtotal' },
          { account: 'Investing Activities', amount: 0, type: 'header' },
          { account: 'Cash Inflows', amount: cashFlow.investing_inflows, type: 'income' },
          { account: 'Cash Outflows', amount: -Math.abs(cashFlow.investing_outflows), type: 'expense' },
          { account: 'Net Cash from Investing', amount: cashFlow.net_cash_from_investing, type: 'subtotal' },
          { account: 'Financing Activities', amount: 0, type: 'header' },
          { account: 'Cash Inflows', amount: cashFlow.financing_inflows, type: 'income' },
          { account: 'Cash Outflows', amount: -Math.abs(cashFlow.financing_outflows), type: 'expense' },
          { account: 'Net Cash from Financing', amount: cashFlow.net_cash_from_financing, type: 'subtotal' },
          { account: 'NET CHANGE IN CASH', amount: cashFlow.net_change_in_cash, type: 'total' },
          { account: 'Opening Cash Balance', amount: cashFlow.opening_cash_balance, type: 'asset' },
          { account: 'Closing Cash Balance', amount: cashFlow.closing_cash_balance, type: 'final' }
        ];
        const reportName = 'Cash Flow Statement';
        const periodLabel = `For the period ${periodStart} to ${periodEnd}`;
        const filename = `Cash_Flow_${periodStart}_to_${periodEnd}`;
        if (type === 'pdf') {
          exportFinancialReportToPDF(data, reportName, periodLabel, filename);
        } else {
          exportFinancialReportToExcel(data, reportName, filename);
        }
        return;
      }
    } catch (e: any) {
      toast({ title: 'Export error', description: e.message || 'Could not export', variant: 'destructive' });
    }
  };

  async function loadCashFlow() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!profile?.company_id) return;
      // Try new RPC first
      try {
        const { data, error } = await supabase.rpc('get_cash_flow_statement' as any, {
          _company_id: profile.company_id,
          _period_start: periodStart,
          _period_end: periodEnd,
        });
        if (error) throw error;
        if (Array.isArray(data) && data.length > 0) {
          const cf = (data as any)[0];
          const opening = await computeOpeningCashOnly(profile.company_id, periodStart);
          const nets = (
            Number(cf.net_cash_from_operations || 0) +
            Number(cf.net_cash_from_investing || 0) +
            Number(cf.net_cash_from_financing || 0)
          );
          const updated = {
            ...cf,
            opening_cash_balance: opening,
            net_change_in_cash: nets,
            closing_cash_balance: opening + nets,
          };
          setCashFlow(updated);
          return;
        }
      } catch {}

      // Fallback to legacy RPC
      const { data: legacy, error: legacyErr } = await supabase.rpc('generate_cash_flow' as any, {
        _company_id: profile.company_id,
        _period_start: periodStart,
        _period_end: periodEnd,
      });
      if (legacyErr) throw legacyErr;
      if (Array.isArray(legacy) && legacy.length > 0) {
        const d: any = legacy[0] || {};
        const toNumber = (v: any) => {
          const n = typeof v === 'number' ? v : parseFloat(String(v || 0));
          return isNaN(n) ? 0 : n;
        };
        const oa = toNumber(d.operating_activities);
        const ia = toNumber(d.investing_activities);
        const fa = toNumber(d.financing_activities);
        const cf = {
          operating_inflows: toNumber(d.operating_inflows ?? (oa > 0 ? oa : 0)),
          operating_outflows: toNumber(d.operating_outflows ?? (oa < 0 ? -oa : 0)),
          net_cash_from_operations: toNumber(d.net_cash_from_operations ?? oa),
          investing_inflows: toNumber(d.investing_inflows ?? (ia > 0 ? ia : 0)),
          investing_outflows: toNumber(d.investing_outflows ?? (ia < 0 ? -ia : 0)),
          net_cash_from_investing: toNumber(d.net_cash_from_investing ?? ia),
          financing_inflows: toNumber(d.financing_inflows ?? (fa > 0 ? fa : 0)),
          financing_outflows: toNumber(d.financing_outflows ?? (fa < 0 ? -fa : 0)),
          net_cash_from_financing: toNumber(d.net_cash_from_financing ?? fa),
          opening_cash_balance: toNumber(d.opening_cash_balance ?? d.opening_cash),
          closing_cash_balance: toNumber(d.closing_cash_balance ?? d.closing_cash),
          net_change_in_cash: toNumber(d.net_change_in_cash ?? d.net_cash_flow),
        };
        const opening = await computeOpeningCashOnly(profile.company_id, periodStart);
        const nets = cf.net_cash_from_operations + cf.net_cash_from_investing + cf.net_cash_from_financing;
        const updated = { ...cf, opening_cash_balance: opening, net_change_in_cash: nets, closing_cash_balance: opening + nets };
        // If legacy returns zeros while we have transactions, compute a local fallback
        const isAllZero = [
          updated.operating_inflows,
          updated.operating_outflows,
          updated.net_cash_from_operations,
          updated.investing_inflows,
          updated.investing_outflows,
          updated.net_cash_from_investing,
          updated.financing_inflows,
          updated.financing_outflows,
          updated.net_cash_from_financing,
          updated.opening_cash_balance,
          updated.closing_cash_balance,
          updated.net_change_in_cash,
        ].every(v => Math.abs(v || 0) < 0.001);

        if (isAllZero) {
          const local = await computeCashFlowFallback(profile.company_id, periodStart, periodEnd);
          if (local) {
            setCashFlow(local);
            return;
          }
        }
        setCashFlow(updated);
      } else {
        // No data; compute local fallback
        const local = await computeCashFlowFallback(profile.company_id, periodStart, periodEnd);
        setCashFlow(local);
      }
    } catch (e: any) {
      console.error('Cash flow load error', e);
      toast({ title: 'Cash flow error', description: e.message || 'Could not load cash flow', variant: 'destructive' });
    }
  }

  const handleDrilldown = async (accountId: string, accountName: string) => {
    setDrilldownAccount(accountName);
    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('id, entry_date, description, debit, credit, reference_id')
        .eq('account_id', accountId)
        .gte('entry_date', periodStart)
        .lte('entry_date', periodEnd)
        .order('entry_date', { ascending: false });

      if (error) throw error;
      setLedgerEntries(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // GAAP Statement of Financial Position (Balance Sheet)
  const renderStatementOfFinancialPosition = () => {
    const currentAssets = trialBalance.filter(r =>
      r.account_type.toLowerCase() === 'asset' &&
      (r.account_name.toLowerCase().includes('cash') ||
       r.account_name.toLowerCase().includes('bank') ||
       r.account_name.toLowerCase().includes('receivable') ||
       r.account_name.toLowerCase().includes('inventory') ||
       parseInt(r.account_code) < 1500) &&
      !String(r.account_name || '').toLowerCase().includes('vat') &&
      !['1210','2110','2210'].includes(String(r.account_code || ''))
    );
    
    const nonCurrentAssetsAll = trialBalance.filter(r =>
      r.account_type.toLowerCase() === 'asset' && !currentAssets.includes(r)
    );
    const accDepRows = nonCurrentAssetsAll.filter(r => r.account_name.toLowerCase().includes('accumulated'));
    const nonCurrentAssets = nonCurrentAssetsAll.filter(r => !r.account_name.toLowerCase().includes('accumulated'));

    const normalizeName = (name: string) =>
      name.toLowerCase()
        .replace(/accumulated/g, '')
        .replace(/depreciation/g, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ') // collapse spaces
        .trim();

    const nbvFor = (assetRow: TrialBalanceRow) => {
      const base = normalizeName(assetRow.account_name);
      const related = accDepRows.filter(ad => {
        const adBase = normalizeName(ad.account_name);
        return adBase.includes(base) || base.includes(adBase);
      });
      const accTotal = related.reduce((sum, r) => sum + r.balance, 0);
      return assetRow.balance - accTotal;
    };
    
    const liabilitiesExVat = trialBalance.filter(r =>
      r.account_type.toLowerCase() === 'liability' &&
      !String(r.account_name || '').toLowerCase().includes('vat') &&
      !['2100','2200'].includes(String(r.account_code || ''))
    );
    const currentLiabilities = liabilitiesExVat.filter(r => {
      const name = String(r.account_name || '').toLowerCase();
      const code = String(r.account_code || '');
      const isLoan = name.includes('loan');
      const isLongLoan = isLoan && (code === '2400' || name.includes('long'));
      const isShortLoan = isLoan && (code === '2300' || name.includes('short'));
      const isPayableOrSars = name.includes('payable') || name.includes('sars');
      const isCodeCurrent = parseInt(code || '0', 10) < 2300;
      if (code === '2400') return false; // pin long-term loans to non-current
      return isShortLoan || ((isPayableOrSars || isCodeCurrent) && !isLongLoan);
    });
    const currentSet = new Set(currentLiabilities.map(r => r.account_id));
    const nonCurrentLiabilities = liabilitiesExVat.filter(r => !currentSet.has(r.account_id));
    
    const equity = trialBalance.filter(r => r.account_type.toLowerCase() === 'equity');

    // Compute net profit for the period to roll into retained earnings
    const revenueRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const expenseRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat'));
    const totalRevenue = revenueRows.reduce((sum, r) => sum + r.balance, 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + r.balance, 0);
    const netProfitForPeriod = totalRevenue - totalExpenses;

    // Prepare equity display rows with retained earnings adjusted by net profit
    const retainedIndex = equity.findIndex(r => r.account_name.toLowerCase().includes('retained earning'));
    const equityDisplay: any[] = [...equity];
    if (retainedIndex >= 0) {
      const retained = equity[retainedIndex];
      const adjusted = { ...retained, balance: retained.balance + netProfitForPeriod };
      equityDisplay.splice(retainedIndex, 1, adjusted);
    } else {
      const syntheticRetained: any = {
        account_id: 'retained-synthetic',
        account_code: '—',
        account_name: 'Retained Earnings (adjusted)',
        account_type: 'equity',
        normal_balance: 'credit',
        total_debits: 0,
        total_credits: 0,
        balance: netProfitForPeriod,
      };
      equityDisplay.push(syntheticRetained);
    }

    const openingIdx = equityDisplay.findIndex(r => String(r.account_code || '') === '3900' || String(r.account_name || '').toLowerCase().includes('opening balance equity'));
    if (openingIdx >= 0) {
      const row = equityDisplay[openingIdx];
      equityDisplay.splice(openingIdx, 1, { ...row, account_code: '3900', account_name: 'Opening Balance Equity', balance: openingEquityTotal });
    } else {
      equityDisplay.push({
        account_id: 'opening-equity-synthetic',
        account_code: '3900',
        account_name: 'Opening Balance Equity',
        account_type: 'equity',
        normal_balance: 'credit',
        total_debits: 0,
        total_credits: 0,
        balance: openingEquityTotal,
      });
    }

    const vatPayable = Math.max(0, vatNet);
    const vatReceivable = Math.max(0, -vatNet);
    const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0) + vatReceivable;
    const totalNonCurrentAssets = ppeBookValue;
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + vatPayable + totalNonCurrentLiabilities;
    
    const totalEquity = equityDisplay.reduce((sum, r) => sum + r.balance, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold">Statement of Financial Position</h2>
            <p className="text-muted-foreground">As at {periodEnd}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleStatementExport('bs','pdf')}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatementExport('bs','excel')}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        {/* ASSETS */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 pb-2">ASSETS</h3>
          
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Current Assets</h4>
            {currentAssets.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-1 px-2">
              <span>VAT Receivable</span>
              <span className="font-mono">R {vatReceivable.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Current Assets</span>
              <span className="font-mono">R {totalCurrentAssets.toLocaleString()}</span>
            </div>
          </div>

          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Non-current Assets</h4>
            <div className="flex justify-between py-1 px-2">
              <span>Property, Plant & Equipment (Book Value)</span>
              <span className="font-mono">R {ppeBookValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Non-current Assets</span>
              <span className="font-mono">R {totalNonCurrentAssets.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between py-2 text-lg font-bold border-t-2 border-b-2">
            <span>TOTAL ASSETS</span>
            <span className="font-mono">R {totalAssets.toLocaleString()}</span>
          </div>
        </div>

        {/* LIABILITIES */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold border-b-2 pb-2">LIABILITIES</h3>
          
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Current Liabilities</h4>
            {currentLiabilities.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-1 px-2">
              <span>VAT Payable</span>
              <span className="font-mono">R {vatPayable.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Current Liabilities</span>
              <span className="font-mono">R {(totalCurrentLiabilities + vatPayable).toLocaleString()}</span>
            </div>
          </div>

          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Non-current Liabilities</h4>
            {nonCurrentLiabilities.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Non-current Liabilities</span>
              <span className="font-mono">R {totalNonCurrentLiabilities.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between py-2 font-semibold border-t">
            <span>Total Liabilities</span>
            <span className="font-mono">R {totalLiabilities.toLocaleString()}</span>
          </div>
        </div>

        {/* EQUITY */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold border-b-2 pb-2">EQUITY</h3>
          <div className="pl-4">
            {equityDisplay.map(row => (
              <div key={row.account_id || row.account_code} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded">
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Equity</span>
              <span className="font-mono">R {totalEquity.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* TOTAL */}
        <div className="flex justify-between py-3 text-lg font-bold border-t-2 border-b-2 bg-primary/5">
          <span>TOTAL LIABILITIES & EQUITY</span>
          <span className="font-mono">R {(totalLiabilities + totalEquity).toLocaleString()}</span>
        </div>

        {/* Validation */}
        {accountingEquation && (
          <div className={`p-4 rounded-lg ${accountingEquation.is_valid ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
            <p className="font-semibold">{accountingEquation.error_message}</p>
            {!accountingEquation.is_valid && (
              <p className="text-sm mt-2">Assets: R {accountingEquation.total_assets.toLocaleString()} | Liabilities: R {accountingEquation.total_liabilities.toLocaleString()} | Equity: R {accountingEquation.total_equity.toLocaleString()}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // GAAP Income Statement
  const renderIncomeStatement = () => {
    const revenue = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const costOfSales = trialBalance.filter(r => (String(r.account_code || '')).startsWith('50') || (String(r.account_name || '').toLowerCase().includes('cost of')));
    const operatingExpenses = trialBalance
      .filter(r => (String(r.account_type || '').toLowerCase() === 'expense') && !costOfSales.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
    const totalCostOfSales = costOfSales.reduce((sum, r) => sum + r.balance, 0);
    const cogsValue = totalCostOfSales > 0 ? totalCostOfSales : fallbackCOGS;
    const grossProfit = totalRevenue - cogsValue;
    const totalOperatingExpenses = operatingExpenses.reduce((sum, r) => sum + r.balance, 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold">Income Statement</h2>
            <p className="text-muted-foreground">For the period {periodStart} to {periodEnd}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleStatementExport('pl','pdf')}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatementExport('pl','excel')}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 pb-2">REVENUE</h3>
          <div className="pl-4">
            {revenue.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Revenue</span>
              <span className="font-mono">R {totalRevenue.toLocaleString()}</span>
            </div>
          </div>

          <>
            <h3 className="text-xl font-bold border-b-2 pb-2">COST OF SALES</h3>
            <div className="pl-4">
              {costOfSales.length > 0 ? costOfSales.map(row => (
                <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                     onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                  <span>{row.account_code} - {row.account_name}</span>
                  <span className="font-mono">(R {row.balance.toLocaleString()})</span>
                </div>
              )) : (
                <div className="flex justify-between py-1 px-2">
                  <span>5000 - Cost of Sales</span>
                  <span className="font-mono">(R {cogsValue.toLocaleString()})</span>
                </div>
              )}
              <div className="flex justify-between py-2 font-semibold border-t mt-2">
                <span>Total Cost of Sales</span>
                <span className="font-mono">(R {cogsValue.toLocaleString()})</span>
              </div>
            </div>

            <div className="flex justify-between py-2 text-lg font-bold border-t-2">
              <span>GROSS PROFIT</span>
              <span className="font-mono">R {grossProfit.toLocaleString()}</span>
            </div>
          </>

          <h3 className="text-xl font-bold border-b-2 pb-2">OPERATING EXPENSES</h3>
          <div className="pl-4">
            {operatingExpenses.map(row => (
              <div key={row.account_id} className="flex justify-between py-1 hover:bg-accent/50 px-2 rounded cursor-pointer"
                   onClick={() => handleDrilldown(row.account_id, row.account_name)}>
                <span>{row.account_code} - {row.account_name}</span>
                <span className="font-mono">(R {row.balance.toLocaleString()})</span>
              </div>
            ))}
            <div className="flex justify-between py-2 font-semibold border-t mt-2">
              <span>Total Operating Expenses</span>
              <span className="font-mono">(R {totalOperatingExpenses.toLocaleString()})</span>
            </div>
          </div>

          <div className={`flex justify-between py-3 text-xl font-bold border-t-2 border-b-2 ${netProfit >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
            <span>NET PROFIT/(LOSS)</span>
            <span className="font-mono">R {netProfit.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderCashFlowStatement = () => {
    const cf = cashFlow || {
      operating_inflows: 0,
      operating_outflows: 0,
      net_cash_from_operations: 0,
      investing_inflows: 0,
      investing_outflows: 0,
      net_cash_from_investing: 0,
      financing_inflows: 0,
      financing_outflows: 0,
      net_cash_from_financing: 0,
      opening_cash_balance: 0,
      closing_cash_balance: 0,
      net_change_in_cash: 0,
    };
    const lowerTB = trialBalance.map(a => ({
      account_id: a.account_id,
      account_code: String(a.account_code || ''),
      account_name: String(a.account_name || '').toLowerCase(),
      account_type: String(a.account_type || '').toLowerCase(),
      balance: Number(a.balance || 0)
    }));
    const sum = (arr: any[]) => arr.reduce((s, x) => s + Number(x.balance || 0), 0);
    const revenueCF = trialBalance.filter(r => String(r.account_type || '').toLowerCase() === 'revenue' || String(r.account_type || '').toLowerCase() === 'income');
    const cogsCF = trialBalance.filter(r => (String(r.account_code || '')).startsWith('50') || (String(r.account_name || '').toLowerCase().includes('cost of')));
    const opexCF = trialBalance
      .filter(r => String(r.account_type || '').toLowerCase() === 'expense' && !cogsCF.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'));
    const totalRevenueCF = revenueCF.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    const totalCOGSCF = cogsCF.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    const cogsValueCF = totalCOGSCF > 0 ? totalCOGSCF : fallbackCOGS;
    const totalOpexCF = opexCF.reduce((sum, r) => sum + Number(r.balance || 0), 0);
    const profitBeforeTax = totalRevenueCF - cogsValueCF - totalOpexCF;
    const depAmort = sum(lowerTB.filter(a => a.account_type === 'expense' && (a.account_name.includes('depreciation') || a.account_name.includes('amortisation') || a.account_name.includes('amortization'))));
    const impairmentNet = sum(lowerTB.filter(a => a.account_name.includes('impairment')));
    const profitDisposal = sum(lowerTB.filter(a => (a.account_code === '9500') || (a.account_name.includes('gain on sale') || a.account_name.includes('disposal gain'))));
    const lossDisposal = sum(lowerTB.filter(a => (a.account_code === '9600') || (a.account_name.includes('loss on sale') || a.account_name.includes('disposal loss'))));
    const financeCosts = sum(lowerTB.filter(a => a.account_type === 'expense' && (a.account_name.includes('finance cost') || a.account_name.includes('interest expense'))));
    const interestIncome = sum(lowerTB.filter(a => (a.account_type === 'revenue' || a.account_type === 'income') && a.account_name.includes('interest')));
    const fxUnrealised = sum(lowerTB.filter(a => a.account_name.includes('unrealised') && (a.account_name.includes('foreign exchange') || a.account_name.includes('fx') || a.account_name.includes('currency'))));
    const provisionsMove = sum(lowerTB.filter(a => (a.account_type === 'liability' || a.account_type === 'expense') && a.account_name.includes('provision')));
    const fairValueAdj = sum(lowerTB.filter(a => a.account_name.includes('fair value')));
    const otherNonCash = sum(lowerTB.filter(a => a.account_name.includes('non-cash') || a.account_name.includes('non cash')));
    const interestReceivedCF = sum(lowerTB.filter(a => (a.account_type === 'revenue' || a.account_type === 'income') && a.account_name.includes('interest')));
    const interestPaidCF = sum(lowerTB.filter(a => a.account_type === 'expense' && (a.account_name.includes('interest') || a.account_name.includes('finance cost'))));
    const dividendsReceivedCF = sum(lowerTB.filter(a => (a.account_type === 'revenue' || a.account_type === 'income') && a.account_name.includes('dividend')));
    const dividendsPaidCF = sum(lowerTB.filter(a => (a.account_type === 'expense' || a.account_type === 'equity') && a.account_name.includes('dividend')));
    const taxPaidCF = sum(lowerTB.filter(a => (a.account_type === 'expense' || a.account_type === 'liability') && a.account_name.includes('tax') && !a.account_name.includes('vat')));
    const isAccumulated = (a: any) => a.account_name.includes('accumulated');
    const isPPE = (a: any) => a.account_type === 'asset' && !isAccumulated(a) && (a.account_name.includes('property') || a.account_name.includes('plant') || a.account_name.includes('equipment') || a.account_name.includes('machinery') || a.account_name.includes('vehicle'));
    const isIntangible = (a: any) => a.account_type === 'asset' && !isAccumulated(a) && (a.account_name.includes('intangible') || a.account_name.includes('software') || a.account_name.includes('patent') || a.account_name.includes('goodwill'));
    const isInvestment = (a: any) => a.account_type === 'asset' && a.account_name.includes('investment');
    const isLoanReceivable = (a: any) => a.account_type === 'asset' && (a.account_name.includes('loan') || a.account_name.includes('advance'));
    const ppeMovement = sum(lowerTB.filter(isPPE));
    const intangibleMovement = sum(lowerTB.filter(isIntangible));
    const investmentMovement = sum(lowerTB.filter(isInvestment));
    const loansMovement = sum(lowerTB.filter(isLoanReceivable));
    const isShareEquity = (a: any) => a.account_type === 'equity' && (a.account_name.includes('share') || a.account_name.includes('capital') || a.account_name.includes('share premium') || a.account_name.includes('treasury'));
    const sharesMovement = sum(lowerTB.filter(isShareEquity));
    const proceedsShares = Math.max(0, sharesMovement);
    const repurchaseShares = Math.max(0, -sharesMovement);
    const isLoanLiability = (a: any) => a.account_type === 'liability' && (a.account_name.includes('loan') || a.account_name.includes('borrow') || a.account_name.includes('debenture') || a.account_name.includes('note payable') || a.account_name.includes('overdraft'));
    const borrowingsMovement = sum(lowerTB.filter(isLoanLiability));
    const proceedsBorrowings = Math.max(0, borrowingsMovement);
    const repaymentBorrowings = Math.max(0, -borrowingsMovement);
    const isLeaseLiability = (a: any) => a.account_type === 'liability' && a.account_name.includes('lease');
    const leasesMovement = sum(lowerTB.filter(isLeaseLiability));
    const nz = (v: number) => Math.abs(v) > 0.0001;
    const purchasePPE = Math.max(0, ppeMovement);
    const proceedsPPE = ppeDisposalProceeds;
    const purchaseIntangible = Math.max(0, intangibleMovement);
    const proceedsIntangible = Math.max(0, -intangibleMovement);
    const investmentsPurchased = Math.max(0, investmentMovement);
    const investmentsProceeds = Math.max(0, -investmentMovement);
    const loansAdvanced = Math.max(0, loansMovement);
    const loansRepaid = Math.max(0, -loansMovement);
    const leasesPaid = Math.max(0, -leasesMovement);
    const financeCostsPaid = Math.abs(financeCosts);
    
    const isAsset = (a: any) => a.account_type === 'asset';
    const isLiability = (a: any) => a.account_type === 'liability';
    const isInventory = (a: any) => a.account_code === '1300' || a.account_name.includes('inventory') || a.account_name.includes('stock');
    const isTradeReceivable = (a: any) => isAsset(a) && (a.account_name.includes('trade receivable') || a.account_name.includes('accounts receivable') || a.account_name.includes('debtors'));
    const isOtherReceivable = (a: any) => isAsset(a) && (a.account_name.includes('other receivable') || a.account_name.includes('prepaid') || a.account_name.includes('deposit')) && !isTradeReceivable(a);
    const isTradePayable = (a: any) => isLiability(a) && (a.account_name.includes('trade payable') || a.account_name.includes('accounts payable') || a.account_name.includes('creditors'));
    const isOtherPayable = (a: any) => isLiability(a) && (a.account_name.includes('other payable') || a.account_name.includes('accrual') || a.account_name.includes('vat payable') || a.account_name.includes('tax payable')) && !isTradePayable(a);

    const tbTradeReceivables = lowerTB.filter(isTradeReceivable);
    const tbInventories = lowerTB.filter(isInventory);
    const tbOtherReceivables = lowerTB.filter(isOtherReceivable);
    const tbTradePayables = lowerTB.filter(isTradePayable);
    const tbOtherPayables = lowerTB.filter(isOtherPayable);

    const wcTradeReceivables = -sum(tbTradeReceivables);
    const wcInventories = -sum(tbInventories);
    const wcOtherReceivables = -sum(tbOtherReceivables);
    const wcTradePayables = sum(tbTradePayables);
    const wcOtherPayables = sum(tbOtherPayables);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-center w-full mb-2">
            <h2 className="text-2xl font-bold">Cash Flow Statement</h2>
            <p className="text-muted-foreground">For the period {periodStart} to {periodEnd}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleStatementExport('cf','pdf')}>
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleStatementExport('cf','excel')}>
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold">CASH FLOWS FROM OPERATING ACTIVITIES</h3>
            <div className="space-y-1 pl-2">
              <div className="flex justify-between"><span>Profit before tax</span><span className="font-mono">R {profitBeforeTax.toLocaleString()}</span></div>
              <div className="font-semibold mt-2">Adjustments for:</div>
              {nz(depAmort) && (<div className="flex justify-between"><span>Depreciation and amortisation</span><span className="font-mono">R {depAmort.toLocaleString()}</span></div>)}
              {nz(impairmentNet) && (<div className="flex justify-between"><span>Impairment losses / reversals</span><span className="font-mono">R {impairmentNet.toLocaleString()}</span></div>)}
              {nz(profitDisposal) && (<div className="flex justify-between"><span>Profit on disposal of assets</span><span className="font-mono">R {profitDisposal.toLocaleString()}</span></div>)}
              {nz(lossDisposal) && (<div className="flex justify-between"><span>Loss on disposal of assets</span><span className="font-mono">R {lossDisposal.toLocaleString()}</span></div>)}
              {nz(financeCosts) && (<div className="flex justify-between"><span>Finance costs</span><span className="font-mono">R {financeCosts.toLocaleString()}</span></div>)}
              {nz(interestIncome) && (<div className="flex justify-between"><span>Interest income</span><span className="font-mono">R {interestIncome.toLocaleString()}</span></div>)}
              {nz(fxUnrealised) && (<div className="flex justify-between"><span>Unrealised foreign exchange differences</span><span className="font-mono">R {fxUnrealised.toLocaleString()}</span></div>)}
              {nz(provisionsMove) && (<div className="flex justify-between"><span>Movements in provisions</span><span className="font-mono">R {provisionsMove.toLocaleString()}</span></div>)}
              {nz(fairValueAdj) && (<div className="flex justify-between"><span>Fair value adjustments</span><span className="font-mono">R {fairValueAdj.toLocaleString()}</span></div>)}
              {nz(otherNonCash) && (<div className="flex justify-between"><span>Other non-cash items</span><span className="font-mono">R {otherNonCash.toLocaleString()}</span></div>)}
              <div className="font-semibold mt-2">Changes in working capital:</div>
              {nz(wcTradeReceivables) && (<div className="flex justify-between"><span>(Increase)/Decrease in trade receivables</span><span className="font-mono">R {wcTradeReceivables.toLocaleString()}</span></div>)}
              {nz(wcInventories) && (<div className="flex justify-between"><span>(Increase)/Decrease in inventories</span><span className="font-mono">R {wcInventories.toLocaleString()}</span></div>)}
              {nz(wcOtherReceivables) && (<div className="flex justify-between"><span>(Increase)/Decrease in other receivables</span><span className="font-mono">R {wcOtherReceivables.toLocaleString()}</span></div>)}
              {nz(wcTradePayables) && (<div className="flex justify-between"><span>Increase/(Decrease) in trade payables</span><span className="font-mono">R {wcTradePayables.toLocaleString()}</span></div>)}
              <div className="flex justify-between font-semibold border-t pt-2"><span>Cash generated from operations</span><span className="font-mono">R {cf.net_cash_from_operations.toLocaleString()}</span></div>
              {nz(interestReceivedCF) && (<div className="flex justify-between"><span>Interest received</span><span className="font-mono">R {interestReceivedCF.toLocaleString()}</span></div>)}
              {nz(interestPaidCF) && (<div className="flex justify-between"><span>Interest paid</span><span className="font-mono">(R {Math.abs(interestPaidCF).toLocaleString()})</span></div>)}
              {nz(dividendsReceivedCF) && (<div className="flex justify-between"><span>Dividends received</span><span className="font-mono">R {dividendsReceivedCF.toLocaleString()}</span></div>)}
              {nz(dividendsPaidCF) && (<div className="flex justify-between"><span>Dividends paid</span><span className="font-mono">(R {Math.abs(dividendsPaidCF).toLocaleString()})</span></div>)}
              {nz(taxPaidCF) && (<div className="flex justify-between"><span>Tax paid</span><span className="font-mono">(R {Math.abs(taxPaidCF).toLocaleString()})</span></div>)}
              <div className="flex justify-between py-2 text-lg font-semibold border-t"><span>Net cash from operating activities</span><span className="font-mono">R {cf.net_cash_from_operations.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">CASH FLOWS FROM INVESTING ACTIVITIES</h3>
            <div className="space-y-1 pl-2">
              {nz(purchasePPE) && (<div className="flex justify-between"><span>Purchase of property, plant and equipment</span><span className="font-mono">(R {purchasePPE.toLocaleString()})</span></div>)}
              {nz(proceedsPPE) && (<div className="flex justify-between"><span>Proceeds from disposal of property, plant and equipment</span><span className="font-mono">R {proceedsPPE.toLocaleString()}</span></div>)}
              {nz(purchaseIntangible) && (<div className="flex justify-between"><span>Purchase of intangible assets</span><span className="font-mono">(R {purchaseIntangible.toLocaleString()})</span></div>)}
              {nz(proceedsIntangible) && (<div className="flex justify-between"><span>Proceeds from sale of intangible assets</span><span className="font-mono">R {proceedsIntangible.toLocaleString()}</span></div>)}
              {nz(investmentsPurchased) && (<div className="flex justify-between"><span>Investments purchased</span><span className="font-mono">(R {investmentsPurchased.toLocaleString()})</span></div>)}
              {nz(investmentsProceeds) && (<div className="flex justify-between"><span>Proceeds from sale/maturity of investments</span><span className="font-mono">R {investmentsProceeds.toLocaleString()}</span></div>)}
              {nz(loansAdvanced) && (<div className="flex justify-between"><span>Loans advanced to other parties</span><span className="font-mono">(R {loansAdvanced.toLocaleString()})</span></div>)}
              {nz(loansRepaid) && (<div className="flex justify-between"><span>Loans repaid to the entity</span><span className="font-mono">R {loansRepaid.toLocaleString()}</span></div>)}
              <div className="flex justify-between py-2 text-lg font-semibold border-t"><span>Net cash used in / from investing activities</span><span className="font-mono">R {cf.net_cash_from_investing.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">CASH FLOWS FROM FINANCING ACTIVITIES</h3>
            <div className="space-y-1 pl-2">
              {nz(proceedsShares) && (<div className="flex justify-between"><span>Proceeds from issue of shares</span><span className="font-mono">R {proceedsShares.toLocaleString()}</span></div>)}
              {nz(repurchaseShares) && (<div className="flex justify-between"><span>Repurchase of shares</span><span className="font-mono">(R {repurchaseShares.toLocaleString()})</span></div>)}
              {nz(proceedsBorrowings) && (<div className="flex justify-between"><span>Proceeds from borrowings</span><span className="font-mono">R {proceedsBorrowings.toLocaleString()}</span></div>)}
              {nz(repaymentBorrowings) && (<div className="flex justify-between"><span>Repayment of borrowings</span><span className="font-mono">(R {repaymentBorrowings.toLocaleString()})</span></div>)}
              {nz(leasesPaid) && (<div className="flex justify-between"><span>Lease liabilities paid (IFRS 16)</span><span className="font-mono">(R {leasesPaid.toLocaleString()})</span></div>)}
              {nz(financeCostsPaid) && (<div className="flex justify-between"><span>Finance costs paid (if treated as financing)</span><span className="font-mono">(R {financeCostsPaid.toLocaleString()})</span></div>)}
              <div className="flex justify-between py-2 text-lg font-semibold border-t"><span>Net cash from / used in financing activities</span><span className="font-mono">R {cf.net_cash_from_financing.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">NET INCREASE / (DECREASE) IN CASH AND CASH EQUIVALENTS</h3>
            <div className="space-y-1 pl-2">
              <div className="flex justify-between"><span>Cash at the beginning of the period</span><span className="font-mono">R {cf.opening_cash_balance.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Net increase / (decrease) in cash</span><span className="font-mono">R {cf.net_change_in_cash.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Effect of exchange rate changes on cash</span><span className="font-mono">R 0</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Cash and cash equivalents at end of period</span><span className="font-mono">R {cf.closing_cash_balance.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">GAAP Financial Statements</h1>
            <p className="text-muted-foreground">Annual Financial Statements with drill-down</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh AFS
            </Button>
            <Button variant="outline" onClick={() => setShowFilters(v => !v)}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </Button>
          </div>
        </div>

      {showFilters && (
      <Card>
        <CardHeader>
          <CardTitle>Reporting Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>Mode</Label>
            <div className="flex gap-2">
              <Button variant={periodMode === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setPeriodMode('monthly')}>Monthly</Button>
              <Button variant={periodMode === 'annual' ? 'default' : 'outline'} size="sm" onClick={() => setPeriodMode('annual')}>Annual</Button>
            </div>
          </div>

          {periodMode === 'monthly' ? (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="selectedMonth">Month</Label>
                <Input id="selectedMonth" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="selectedYear">Year</Label>
                <Input id="selectedYear" type="number" min={1900} max={2100} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))} />
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="balance-sheet">Statement of Financial Position</TabsTrigger>
          <TabsTrigger value="income">Income Statement</TabsTrigger>
          <TabsTrigger value="cash-flow">Cash Flow Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet">
          <Card>
            <CardContent className="pt-6">
              {renderStatementOfFinancialPosition()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="income">
          <Card>
            <CardContent className="pt-6">
              {renderIncomeStatement()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash-flow">
          <Card>
            <CardContent className="pt-6">
              {renderCashFlowStatement()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-down modal */}
      {drilldownAccount && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Ledger Entries: {drilldownAccount}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setDrilldownAccount(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledgerEntries.map(entry => (
                <div key={entry.id} className="flex justify-between border-b pb-2">
                  <div>
                    <p className="font-semibold">{entry.description}</p>
                    <p className="text-sm text-muted-foreground">{entry.entry_date} | Ref: {entry.reference_id}</p>
                  </div>
                  <div className="text-right font-mono">
                    {entry.debit > 0 && <p>Dr: R {entry.debit.toLocaleString()}</p>}
                    {entry.credit > 0 && <p>Cr: R {entry.credit.toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Period-scoped trial balance computation using transaction_entries joined to transactions.transaction_date
// Function to calculate total inventory value from products
const calculateTotalInventoryValue = async (companyId: string) => {
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
    console.error('Error calculating inventory value:', error);
    return 0;
  }
};

const fetchTrialBalanceForPeriod = async (companyId: string, start: string, end: string) => {
  const startDateObj = new Date(start);
  const startISO = startDateObj.toISOString();
  const endDateObj = new Date(end);
  endDateObj.setHours(23, 59, 59, 999);
  const endISO = endDateObj.toISOString();

  // Get all active accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('chart_of_accounts')
    .select('id, account_code, account_name, account_type')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('account_code');

  if (accountsError) throw accountsError;

  // Get transaction entries
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
    .gte('transactions.transaction_date', startISO)
    .lte('transactions.transaction_date', endISO);

  if (txError) throw txError;

  // Get ledger entries
  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('ledger_entries')
    .select('transaction_id, account_id, debit, credit, entry_date')
    .eq('company_id', companyId)
    .gte('entry_date', startISO)
    .lte('entry_date', endISO);

  if (ledgerError) throw ledgerError;

  const trialBalance: Array<{ account_id: string; account_code: string; account_name: string; account_type: string; balance: number; }> = [];

  // Calculate total inventory value from products
  const totalInventoryValue = await calculateTotalInventoryValue(companyId);

  // Process each account
  const ledgerTxIds = new Set<string>((ledgerEntries || []).map((e: any) => String(e.transaction_id || '')));
  const filteredTxEntries = (txEntries || []).filter((e: any) => !ledgerTxIds.has(String(e.transaction_id || '')));

  (accounts || []).forEach((acc: any) => {
    let sumDebit = 0;
    let sumCredit = 0;

    // Sum transaction entries
    (filteredTxEntries || []).forEach((entry: any) => {
      if (entry.account_id === acc.id) {
        sumDebit += Number(entry.debit || 0);
        sumCredit += Number(entry.credit || 0);
      }
    });

    // Sum ledger entries
    (ledgerEntries || []).forEach((entry: any) => {
      if (entry.account_id === acc.id) {
        sumDebit += Number(entry.debit || 0);
        sumCredit += Number(entry.credit || 0);
      }
    });

    const type = (acc.account_type || '').toLowerCase();
    const naturalDebit = type === 'asset' || type === 'expense';
    let balance = naturalDebit ? (sumDebit - sumCredit) : (sumCredit - sumDebit);

    // Special handling for inventory account - use actual product values (only account 1300)
    if (acc.account_code === '1300') {
      balance = totalInventoryValue;
      console.log(`Inventory account ${acc.account_code} - Using total product value: R ${totalInventoryValue}`);
    }

    const isInventoryName = (acc.account_name || '').toLowerCase().includes('inventory');
    const isPrimaryInventory = acc.account_code === '1300';
    const shouldShow = Math.abs(balance) > 0.01 && (!isInventoryName || isPrimaryInventory);
    if (shouldShow) {
      trialBalance.push({
        account_id: acc.id,
        account_code: acc.account_code,
        account_name: acc.account_name,
        account_type: acc.account_type,
        balance
      });
    }
  });

  return trialBalance;
};

const calculateCOGSFromInvoices = async (companyId: string, start: string, end: string) => {
  try {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_date, sent_at, status')
      .eq('company_id', companyId)
      .in('status', ['sent','paid','approved','posted']);
    const startDt = new Date(start);
    const endDt = new Date(end);
    endDt.setHours(23,59,59,999);
    const inPeriod = (inv: any) => {
      const dStr = inv.sent_at || inv.invoice_date;
      if (!dStr) return false;
      const d = new Date(dStr);
      return d >= startDt && d <= endDt;
    };
    const ids = (invoices || []).filter(inPeriod).map((i: any) => i.id);
    if (!ids.length) return 0;
    const { data: items } = await supabase
      .from('invoice_items')
      .select('invoice_id, description, quantity, unit_price, item_type')
      .in('invoice_id', ids as any);
    const onlyProducts = (items || []).filter((it: any) => String(it.item_type || '').toLowerCase() === 'product');
    let total = 0;
    const { data: prodByName } = await supabase
      .from('items')
      .select('name, cost_price')
      .eq('company_id', companyId)
      .eq('item_type', 'product');
    const catalog = (prodByName || []).map((p: any) => ({ name: String(p.name || '').toLowerCase().trim(), cost: Number(p.cost_price || 0) }));
    onlyProducts.forEach((it: any) => {
      const desc = String(it.description || '').toLowerCase().trim();
      let cp = 0;
      const exact = catalog.find(c => c.name === desc);
      if (exact) cp = exact.cost;
      else {
        const contains = catalog.find(c => desc.includes(c.name) || c.name.includes(desc));
        if (contains) cp = contains.cost;
      }
      if (!cp || cp <= 0) cp = Number(it.unit_price || 0);
      const qty = Number(it.quantity || 0);
      total += (cp * qty);
    });
    return total;
  } catch {
    return 0;
  }
};

const computeCashFlowFallback = async (companyId: string, start: string, end: string) => {
  try {
    const startDateObj = new Date(start);
    const startISO = startDateObj.toISOString();
    const endDateObj = new Date(end);
    endDateObj.setHours(23, 59, 59, 999);
    const endISO = endDateObj.toISOString();

    // Fetch period entries with account metadata
    const { data: periodEntries } = await supabase
      .from('transaction_entries')
      .select(`
        debit, credit,
        transactions!inner ( transaction_date, company_id, status ),
        chart_of_accounts!inner ( id, account_name, account_type, is_cash_equivalent )
      `)
      .eq('transactions.company_id', companyId)
      .eq('transactions.status', 'posted')
      .gte('transactions.transaction_date', startISO)
      .lte('transactions.transaction_date', endISO);

    const sumBy = (pred: (row: any) => boolean, fn: (row: any) => number) =>
      (periodEntries || []).filter(pred).reduce((s, row) => s + fn(row), 0);

    const isIncome = (t: string) => {
      const v = (t || '').toLowerCase();
      return v === 'income' || v === 'revenue';
    };

    const isExpense = (t: string) => (t || '').toLowerCase() === 'expense';

    const incomeSum = sumBy(
      (row) => isIncome(row.chart_of_accounts?.account_type || ''),
      (row) => Number(row.credit || 0) - Number(row.debit || 0)
    );

    const expenseSum = sumBy(
      (row) => isExpense(row.chart_of_accounts?.account_type || ''),
      (row) => Number(row.debit || 0) - Number(row.credit || 0)
    );

    const v_net_profit = incomeSum - expenseSum;

    const v_depreciation = sumBy(
      (row) => String(row.chart_of_accounts?.account_name || '').toLowerCase().includes('depreciation'),
      (row) => Number(row.debit || 0)
    );

    const v_receivables_change = sumBy(
      (row) => String(row.chart_of_accounts?.account_name || '').toLowerCase().includes('receivable'),
      (row) => Number(row.debit || 0) - Number(row.credit || 0)
    );

    const v_payables_change = sumBy(
      (row) => String(row.chart_of_accounts?.account_name || '').toLowerCase().includes('payable'),
      (row) => Number(row.credit || 0) - Number(row.debit || 0)
    );

    const v_operating = v_net_profit + v_depreciation - v_receivables_change + v_payables_change;

    const v_investing = sumBy(
      (row) => String(row.chart_of_accounts?.account_name || '').toLowerCase().includes('fixed asset'),
      (row) => (Number(row.debit || 0) - Number(row.credit || 0)) * -1
    );

    const v_financing = sumBy(
      (row) => {
        const name = String(row.chart_of_accounts?.account_name || '').toLowerCase();
        return name.includes('loan') || name.includes('capital');
      },
      (row) => Number(row.credit || 0) - Number(row.debit || 0)
    );

    // Opening cash: entries before period on cash-equivalent accounts
    const { data: openingEntries } = await supabase
      .from('transaction_entries')
      .select(`
        debit, credit,
        transactions!inner ( transaction_date, company_id, status ),
        chart_of_accounts!inner ( is_cash_equivalent )
      `)
      .eq('transactions.company_id', companyId)
      .eq('transactions.status', 'posted')
      .lt('transactions.transaction_date', startISO)
      .eq('chart_of_accounts.is_cash_equivalent', true);

    const v_opening_cash = (openingEntries || []).reduce(
      (s, row) => s + (Number(row.debit || 0) - Number(row.credit || 0)),
      0
    );

    const v_closing_cash = v_opening_cash + v_operating + v_investing + v_financing;

    return {
      operating_inflows: v_operating > 0 ? v_operating : 0,
      operating_outflows: v_operating < 0 ? -v_operating : 0,
      net_cash_from_operations: v_operating,
      investing_inflows: v_investing > 0 ? v_investing : 0,
      investing_outflows: v_investing < 0 ? -v_investing : 0,
      net_cash_from_investing: v_investing,
      financing_inflows: v_financing > 0 ? v_financing : 0,
      financing_outflows: v_financing < 0 ? -v_financing : 0,
      net_cash_from_financing: v_financing,
      opening_cash_balance: v_opening_cash,
      closing_cash_balance: v_closing_cash,
      net_change_in_cash: v_operating + v_investing + v_financing,
    };
  } catch (e) {
    console.error('Fallback cash flow error', e);
    return null;
  }
};

const computeOpeningCashOnly = async (companyId: string, start: string) => {
  const { data: banks } = await supabase
    .from('bank_accounts')
    .select('opening_balance')
    .eq('company_id', companyId);
  const totalOpening = (banks || []).reduce((s: number, b: any) => s + Number(b.opening_balance || 0), 0);
  return totalOpening;
};
