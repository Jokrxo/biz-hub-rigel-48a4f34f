import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download, Eye, Calendar, FileDown, Scale, Activity, ArrowLeftRight, History, PieChart, BarChart3, Filter, CheckCircle2, AlertTriangle, FileText, Info, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { exportFinancialReportToExcel, exportFinancialReportToPDF, exportComparativeCashFlowToExcel, exportComparativeCashFlowToPDF } from "@/lib/export-utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { systemOverview, accountingPrimer } from "@/components/Stella/knowledge";
import StellaAdvisor from "@/components/Stella/StellaAdvisor";
import { PPEStatement } from "./PPEStatement";
import { calculateTotalPPEAsOf, calculateDepreciationExpenseForPeriod, calculateAccumulatedDepreciationAsOf } from "@/components/FixedAssets/DepreciationCalculator";
import { useFiscalYear } from "@/hooks/use-fiscal-year";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const { fiscalStartMonth: fyStart, selectedFiscalYear, setSelectedFiscalYear, loading: fyLoading, getFiscalYearDates, lockFiscalYear, defaultFiscalYear } = useFiscalYear();
  const [activeTab, setActiveTab] = useState<string>('balance-sheet');
  const [periodStart, setPeriodStart] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1); // January 1st
    return date.toISOString().split('T')[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split('T')[0]);
  const [showCashFlowAudit, setShowCashFlowAudit] = useState(false);
  const [auditDiscrepancy, setAuditDiscrepancy] = useState(0);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [drilldownAccount, setDrilldownAccount] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [traceResolved, setTraceResolved] = useState<TrialBalanceRow | null>(null);
  const [traceCFMonthly, setTraceCFMonthly] = useState<Record<string, number> | null>(null);
  const [traceCFLoading, setTraceCFLoading] = useState(false);
  const [traceLabel, setTraceLabel] = useState<string | null>(null);
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
  const [depExpensePeriod, setDepExpensePeriod] = useState<number>(0);
  const [compDepCurr, setCompDepCurr] = useState<number>(0);
  const [compDepPrev, setCompDepPrev] = useState<number>(0);
  const [cashFlowPrev, setCashFlowPrev] = useState<{
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
  const [cashFlowCurrComparative, setCashFlowCurrComparative] = useState<{
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
  const [trialBalancePrev, setTrialBalancePrev] = useState<TrialBalanceRow[]>([]);
  const [trialBalancePrevPrev, setTrialBalancePrevPrev] = useState<TrialBalanceRow[]>([]);
  const [trialBalanceCompAsOfA, setTrialBalanceCompAsOfA] = useState<TrialBalanceRow[]>([]);
  const [trialBalanceCompAsOfB, setTrialBalanceCompAsOfB] = useState<TrialBalanceRow[]>([]);
  const [fallbackCOGSPrev, setFallbackCOGSPrev] = useState<number>(0);
  const [comparativeLoading, setComparativeLoading] = useState(false);
  const [comparativeYearA, setComparativeYearA] = useState<number>(() => new Date().getFullYear());
  const [comparativeYearB, setComparativeYearB] = useState<number>(() => new Date().getFullYear() - 1);
  const [compCFYearA, setCompCFYearA] = useState<any | null>(null);
  const [compCFYearB, setCompCFYearB] = useState<any | null>(null);
  const [ppeBookValue, setPpeBookValue] = useState<number>(0);
  const [openingEquityTotal, setOpeningEquityTotal] = useState<number>(0);
  const [fallbackCOGS, setFallbackCOGS] = useState<number>(0);
  const [vatNet, setVatNet] = useState<number>(0);
  const [ppeDisposalProceeds, setPpeDisposalProceeds] = useState<number>(0);
  const [investingPurchasesCurr, setInvestingPurchasesCurr] = useState<number>(0);
  const [investingPurchasesPrev, setInvestingPurchasesPrev] = useState<number>(0);
  const [investingProceedsCurr, setInvestingProceedsCurr] = useState<number>(0);
  const [investingProceedsPrev, setInvestingProceedsPrev] = useState<number>(0);
  const [loanFinancedAcqCurr, setLoanFinancedAcqCurr] = useState<number>(0);
  const [loanFinancedAcqPrev, setLoanFinancedAcqPrev] = useState<number>(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdviceModal, setShowAdviceModal] = useState(false);
  const [trialBalanceAsOf, setTrialBalanceAsOf] = useState<TrialBalanceRow[]>([]);
  const [retainedOpeningYTD, setRetainedOpeningYTD] = useState<number>(0);
  const [netProfitPeriod, setNetProfitPeriod] = useState<number>(0);
  const [vatReceivableAsOf, setVatReceivableAsOf] = useState<number>(0);
  const [vatPayableAsOf, setVatPayableAsOf] = useState<number>(0);
  const [monthlyAFSError, setMonthlyAFSError] = useState<string | null>(null);
  const [monthlyAFSData, setMonthlyAFSData] = useState<any[]>([]);
  const [monthlyAFSLoading, setMonthlyAFSLoading] = useState(false);
  const [ppeValueFromModule, setPpeValueFromModule] = useState<number>(0);
  const [fiscalStartMonth, setFiscalStartMonth] = useState<number>(1);

  useEffect(() => { loadFinancialData(); }, [periodStart, periodEnd]);

  useEffect(() => {
    if (periodMode === 'monthly') {
      const [y, m] = selectedMonth.split('-').map((v) => parseInt(v, 10));
      if (y !== selectedYear) setSelectedYear(y);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    } else {
      const start = new Date(selectedYear, (fyStart || fiscalStartMonth) - 1, 1);
      const end = new Date(selectedYear + ((fyStart || fiscalStartMonth) === 1 ? 0 : 1), (fyStart || fiscalStartMonth) - 1, 0);
      setPeriodStart(start.toISOString().split('T')[0]);
      setPeriodEnd(end.toISOString().split('T')[0]);
    }
  }, [periodMode, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!fyLoading) {
      setFiscalStartMonth(fyStart || 1);
      if (typeof selectedFiscalYear === 'number') {
        setSelectedYear(selectedFiscalYear);
      }
      if (lockFiscalYear && typeof defaultFiscalYear === 'number') {
        setSelectedFiscalYear(defaultFiscalYear);
        setSelectedYear(defaultFiscalYear);
      }
    }
  }, [fyLoading, fyStart, selectedFiscalYear, lockFiscalYear, defaultFiscalYear]);

  // Load cash flow whenever cash-flow tab is active or period changes
  useEffect(() => { if (activeTab === 'cash-flow') { loadCashFlow(); } }, [activeTab, periodStart, periodEnd]);
  useEffect(() => { if (activeTab === 'comparative') { loadComparativeData(); } }, [activeTab, comparativeYearA, comparativeYearB]);
  useEffect(() => {
    if (periodMode === 'annual' && activeTab === 'cash-flow') {
      loadComparativeData();
    }
  }, [activeTab, periodMode, selectedYear]);
  useEffect(() => { loadMonthlyAFS(); }, [selectedYear, fiscalStartMonth]);

  useEffect(() => {
    (async () => {
      try {
        if (!periodStart || !periodEnd) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();
        const companyId = (profile as any)?.company_id;
        if (!companyId) return;
        const { data: v } = await supabase.rpc('validate_trial_balance' as any, {
          _company_id: companyId,
          _period_start: periodStart,
          _period_end: periodEnd,
        });
        const res = Array.isArray(v) ? v[0] : null;
        if (res && res.is_balanced === false) {
          toast({ title: 'Trial balance not balanced', description: `Difference: ${Number(res.difference || 0).toFixed(2)}`, variant: 'destructive' });
        }
      } catch {}
    })();
  }, [periodStart, periodEnd]);

  useEffect(() => {
    (async () => {
      try {
        setFiscalStartMonth(fyStart || 1);
        if (typeof selectedFiscalYear === 'number') {
          setSelectedYear(selectedFiscalYear);
        }
      } catch {}
    })();
  }, [selectedFiscalYear, fyStart]);

  useEffect(() => {
    const toLower = (s: string) => String(s || '').toLowerCase();
    const assets = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset');
    const liabilities = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'liability');
    const equityRows = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'equity');
    const isCurrentAsset = (r: any) => (
      toLower(r.account_type) === 'asset' && (
        toLower(r.account_name).includes('cash') ||
        toLower(r.account_name).includes('bank') ||
        toLower(r.account_name).includes('receivable') ||
        toLower(r.account_name).includes('inventory') ||
        parseInt(String(r.account_code || '0'), 10) < 1500
      ) && !toLower(r.account_name).includes('vat') && !['1210','2110','2210'].includes(String(r.account_code || '')) && (!toLower(r.account_name).includes('inventory') || String(r.account_code || '') === '1300')
    );
    const currentAssets = assets.filter(isCurrentAsset);
    const totalCurrentAssets = currentAssets.reduce((s, r) => s + Number(r.balance || 0), 0) + Math.max(0, -vatNet);
    const nonCurrentAssetsAll = assets.filter(r => !currentAssets.includes(r));
    const accDepRowsEq = nonCurrentAssetsAll.filter(r => String(r.account_name || '').toLowerCase().includes('accumulated'));
    const nonCurrentAssetsEq = nonCurrentAssetsAll.filter(r => !String(r.account_name || '').toLowerCase().includes('accumulated'));
    const normalizeNameEq = (name: string) => String(name || '').toLowerCase().replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const nbvForEq = (assetRow: any) => {
      const base = normalizeNameEq(assetRow.account_name);
      const related = accDepRowsEq.filter(ad => {
        const adBase = normalizeNameEq(ad.account_name);
        return adBase.includes(base) || base.includes(adBase);
      });
      const accTotal = related.reduce((sum, r) => sum + Number(r.balance || 0), 0);
      return Number(assetRow.balance || 0) - accTotal;
    };
    const totalNonCurrentAssets = nonCurrentAssetsEq.reduce((s, a) => s + nbvForEq(a), 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

    const liabilitiesExVat = liabilities.filter(r => !toLower(r.account_name).includes('vat') && !['2100','2200'].includes(String(r.account_code || '')));
    const currentLiabilities = liabilitiesExVat.filter(r => {
      const name = toLower(r.account_name);
      const code = String(r.account_code || '');
      const isLoan = name.includes('loan');
      const isLongLoan = isLoan && (code === '2400' || name.includes('long'));
      const isShortLoan = isLoan && (code === '2300' || name.includes('short'));
      const isPayableOrSars = name.includes('payable') || name.includes('sars');
      const isCodeCurrent = parseInt(code || '0', 10) < 2300;
      if (code === '2400') return false;
      return isShortLoan || ((isPayableOrSars || isCodeCurrent) && !isLongLoan);
    });
    const currentSet = new Set(currentLiabilities.map(r => r.account_id));
    const nonCurrentLiabilities = liabilitiesExVat.filter(r => !currentSet.has(r.account_id));
    const totalCurrentLiabilities = currentLiabilities.reduce((s, r) => s + Number(r.balance || 0), 0) + Math.max(0, vatNet);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

    const revenueRowsPeriod = trialBalance.filter(r => toLower(r.account_type) === 'revenue' || toLower(r.account_type) === 'income');
    const expenseRowsPeriod = trialBalance.filter(r => toLower(r.account_type) === 'expense' && !toLower(r.account_name).includes('vat'));
    const totalRevenue = revenueRowsPeriod.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalExpenses = expenseRowsPeriod.reduce((s, r) => s + Number(r.balance || 0), 0);
    const netProfitForPeriod = totalRevenue - totalExpenses;
    const totalEquityBase = equityRows.reduce((s, r) => s + Number(r.balance || 0), 0);
    const totalEquity = totalEquityBase + netProfitForPeriod + openingEquityTotal;

    const diff = totalAssets - (totalLiabilities + totalEquity);
    const ok = Math.abs(diff) < 0.01;
    setAccountingEquation({
      is_valid: ok,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      difference: diff,
      error_message: ok ? 'Accounting equation holds for selected period' : `ERROR: Assets (${totalAssets}) ≠ Liabilities (${totalLiabilities}) + Equity (${totalEquity}) | Difference: ${diff}`,
    });
  }, [trialBalance, trialBalanceAsOf, vatNet, ppeBookValue, openingEquityTotal, periodEnd]);

  const [loadingProgress, setLoadingProgress] = useState(0);

  async function loadFinancialData() {
    setLoading(true);
    setLoadingProgress(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: companyProfile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!companyProfile?.company_id) throw new Error("Company not found");
      
      setLoadingProgress(20);

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
      
      setLoadingProgress(40);

      const revRowsPeriod = normalized.filter((r: any) => String(r.account_type || '').toLowerCase() === 'revenue' || String(r.account_type || '').toLowerCase() === 'income');
      const expRowsPeriod = normalized.filter((r: any) => String(r.account_type || '').toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat'));
      const cogsRowsPeriod = expRowsPeriod.filter((r: any) => String(r.account_name || '').toLowerCase().includes('cost of') || String(r.account_code || '').startsWith('50'));
      const opexRowsPeriod = expRowsPeriod
        .filter((r: any) => !cogsRowsPeriod.includes(r))
        .filter((r: any) => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));
      const totalRevenuePeriod = revRowsPeriod.reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
      const totalCOGSPeriod = cogsRowsPeriod.reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
      const grossProfitPeriod = totalRevenuePeriod - totalCOGSPeriod;
      const totalOpexPeriod = opexRowsPeriod.reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
      setNetProfitPeriod(grossProfitPeriod - totalOpexPeriod);

      setLoadingProgress(60);

      // Fetch cumulative trial balance as of period end for balance sheet
      const tbAsOf = await fetchTrialBalanceAsOf(companyProfile.company_id, periodEnd);
      const normalizedAsOf = (tbAsOf || []).map((r: any) => ({
        account_id: String(r.account_id || ''),
        account_code: String(r.account_code || ''),
        account_name: String(r.account_name || ''),
        account_type: String(r.account_type || ''),
        normal_balance: String(r.normal_balance || 'debit'),
        total_debits: Number(r.total_debits || 0),
        total_credits: Number(r.total_credits || 0),
        balance: Number(r.balance || 0),
      }));
      setTrialBalanceAsOf(normalizedAsOf);
      
      setLoadingProgress(80);

      const vatRecvSum = normalizedAsOf
        .filter((r: any) => String(r.account_type || '').toLowerCase() === 'asset' && (String(r.account_name || '').toLowerCase().includes('vat input') || String(r.account_name || '').toLowerCase().includes('vat receivable')))
        .reduce((sum: number, r: any) => sum + Number(r.balance || 0), 0);
      const vatPaySum = normalizedAsOf
        .filter((r: any) => String(r.account_type || '').toLowerCase() === 'liability' && String(r.account_name || '').toLowerCase().includes('vat'))
        .reduce((sum: number, r: any) => sum + Number(r.balance || 0), 0);
      setVatReceivableAsOf(vatRecvSum);
      setVatPayableAsOf(vatPaySum);
      
      if (periodMode === 'monthly') {
        const startObj = new Date(periodStart);
        const base = fiscalStartMonth - 1;
        const ytdYear = startObj.getMonth() < base ? startObj.getFullYear() - 1 : startObj.getFullYear();
        const ytdStartObj = new Date(ytdYear, base, 1);
        const prevEndObj = new Date(startObj);
        prevEndObj.setDate(prevEndObj.getDate() - 1);
        prevEndObj.setHours(23, 59, 59, 999);
        const ytdStart = ytdStartObj.toISOString().split('T')[0];
        const prevEnd = prevEndObj.toISOString().split('T')[0];
        const tbYTD = await fetchTrialBalanceForPeriod(companyProfile.company_id, ytdStart, prevEnd);
        const normalizedYTD = (tbYTD || []).map((r: any) => ({
          account_id: String(r.account_id || ''),
          account_code: String(r.account_code || ''),
          account_name: String(r.account_name || ''),
          account_type: String(r.account_type || ''),
          normal_balance: String(r.normal_balance || 'credit'),
          total_debits: Number(r.total_debits || 0),
          total_credits: Number(r.total_credits || 0),
          balance: Number(r.balance || 0),
        }));
        const totalRevYTD = normalizedYTD.filter((r: any) => String(r.account_type || '').toLowerCase() === 'revenue' || String(r.account_type || '').toLowerCase() === 'income').reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
        const totalExpYTD = normalizedYTD.filter((r: any) => String(r.account_type || '').toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat')).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
        setRetainedOpeningYTD(totalRevYTD - totalExpYTD);
      } else {
        setRetainedOpeningYTD(0);
      }

      const cogsFallback = await calculateCOGSFromInvoices(companyProfile.company_id, periodStart, periodEnd);
      setFallbackCOGS(cogsFallback);
      
      setLoadingProgress(100);

      const assetsAsOf = normalizedAsOf.filter((r: any) => String(r.account_type || '').toLowerCase() === 'asset');
      const accDepRowsAsOf = assetsAsOf.filter((r: any) => String(r.account_name || '').toLowerCase().includes('accumulated'));
      const nonCurrentAssetsAsOf = assetsAsOf.filter((r: any) => !String(r.account_name || '').toLowerCase().includes('accumulated') && parseInt(String(r.account_code || '0'), 10) >= 1500);
      const normalizeNameAsOf = (name: string) => String(name || '').toLowerCase().replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
      const nbvForAsOf = (assetRow: any) => {
        const base = normalizeNameAsOf(assetRow.account_name);
        const related = accDepRowsAsOf.filter((ad: any) => {
          const adBase = normalizeNameAsOf(ad.account_name);
          return adBase.includes(base) || base.includes(adBase);
        });
        const accTotal = related.reduce((sum: number, r: any) => sum + Number(r.balance || 0), 0);
        return Number(assetRow.balance || 0) - accTotal;
      };
      const ppeSum = await calculateTotalPPEAsOf(supabase, companyProfile.company_id, periodEnd);
      setPpeValueFromModule(ppeSum);
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
      const depExp = await calculateDepreciationExpenseForPeriod(supabase, companyProfile.company_id, periodStart, periodEnd);
      setDepExpensePeriod(depExp);
      setNetProfitPeriod(grossProfitPeriod - (totalOpexPeriod + Number(depExp || 0)));
      
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

  async function loadComparativeData() {
    if (periodMode !== 'annual') {
      return;
    }
    setComparativeLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: companyProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!companyProfile?.company_id) return;
      const { startStr: yAStart, endStr: yAEnd } = getFiscalYearDates(comparativeYearA);
      const { startStr: yBStart, endStr: yBEnd } = getFiscalYearDates(comparativeYearB);
      const tbYearBPeriod = await fetchTrialBalanceForPeriod(companyProfile.company_id, yBStart, yBEnd);
      const normalizedPrev = (tbYearBPeriod || []).map((r: any) => ({
        account_id: String(r.account_id || ''),
        account_code: String(r.account_code || ''),
        account_name: String(r.account_name || ''),
        account_type: String(r.account_type || ''),
        normal_balance: String(r.normal_balance || 'debit'),
        total_debits: Number(r.total_debits || 0),
        total_credits: Number(r.total_credits || 0),
        balance: Number(r.balance || 0),
      }));
      setTrialBalancePrev(normalizedPrev);
      const tbYearAPeriod = await fetchTrialBalanceForPeriod(companyProfile.company_id, yAStart, yAEnd);
      const normalizedYearA = (tbYearAPeriod || []).map((r: any) => ({
        account_id: String(r.account_id || ''),
        account_code: String(r.account_code || ''),
        account_name: String(r.account_name || ''),
        account_type: String(r.account_type || ''),
        normal_balance: String(r.normal_balance || 'debit'),
        total_debits: Number(r.total_debits || 0),
        total_credits: Number(r.total_credits || 0),
        balance: Number(r.balance || 0),
      }));
      setTrialBalance(normalizedYearA);
      const tbYearAAsOf = await fetchTrialBalanceAsOf(companyProfile.company_id, yAEnd);
      const tbYearBAsOf = await fetchTrialBalanceAsOf(companyProfile.company_id, yBEnd);
      const normalizedAsOfA = (tbYearAAsOf || []).map((r: any) => ({
        account_id: String(r.account_id || ''),
        account_code: String(r.account_code || ''),
        account_name: String(r.account_name || ''),
        account_type: String(r.account_type || ''),
        normal_balance: String(r.normal_balance || 'debit'),
        total_debits: Number(r.total_debits || 0),
        total_credits: Number(r.total_credits || 0),
        balance: Number(r.balance || 0),
      }));
      const normalizedAsOfB = (tbYearBAsOf || []).map((r: any) => ({
        account_id: String(r.account_id || ''),
        account_code: String(r.account_code || ''),
        account_name: String(r.account_name || ''),
        account_type: String(r.account_type || ''),
        normal_balance: String(r.normal_balance || 'debit'),
        total_debits: Number(r.total_debits || 0),
        total_credits: Number(r.total_credits || 0),
        balance: Number(r.balance || 0),
      }));
      setTrialBalanceCompAsOfA(normalizedAsOfA);
      setTrialBalanceCompAsOfB(normalizedAsOfB);
      setTrialBalancePrevPrev([]);
      const cogsPrev = await calculateCOGSFromInvoices(companyProfile.company_id, yBStart, yBEnd);
      setFallbackCOGSPrev(cogsPrev);
      const cfYearB = await getCashFlowForPeriod(companyProfile.company_id, yBStart, yBEnd);
      const cfYearA = await getCashFlowForPeriod(companyProfile.company_id, yAStart, yAEnd);
      setCashFlowPrev(cfYearB);
      setCashFlowCurrComparative(cfYearA);
      setCompCFYearB(cfYearB);
      setCompCFYearA(cfYearA);
      try {
        const depPrev = await calculateDepreciationExpenseForPeriod(supabase, companyProfile.company_id, yBStart, yBEnd);
        const depCurr = await calculateDepreciationExpenseForPeriod(supabase, companyProfile.company_id, yAStart, yAEnd);
        setCompDepPrev(depPrev);
        setCompDepCurr(depCurr);
      } catch {}
      try {
        const { data: invPrevPurch } = await supabase
          .from('transactions')
          .select('total_amount, status')
          .eq('company_id', companyProfile.company_id)
          .eq('transaction_type', 'asset_purchase')
          .gte('transaction_date', yBStart)
          .lte('transaction_date', yBEnd)
          .in('status', ['approved','posted','pending']);
        const { data: invPrevProc } = await supabase
          .from('transactions')
          .select('total_amount, status')
          .eq('company_id', companyProfile.company_id)
          .eq('transaction_type', 'asset_disposal')
          .gte('transaction_date', yBStart)
          .lte('transaction_date', yBEnd)
          .in('status', ['approved','posted','pending']);
        const { data: invCurrPurch } = await supabase
          .from('transactions')
          .select('total_amount, status')
          .eq('company_id', companyProfile.company_id)
          .eq('transaction_type', 'asset_purchase')
          .gte('transaction_date', yAStart)
          .lte('transaction_date', yAEnd)
          .in('status', ['approved','posted','pending']);
        const { data: invCurrProc } = await supabase
          .from('transactions')
          .select('total_amount, status')
          .eq('company_id', companyProfile.company_id)
          .eq('transaction_type', 'asset_disposal')
          .gte('transaction_date', yAStart)
          .lte('transaction_date', yAEnd)
          .in('status', ['approved','posted','pending']);
        const sumAmt = (arr: any[] | null | undefined) => (arr || []).reduce((s: number, t: any) => s + Math.max(0, Number(t.total_amount || 0)), 0);
        setInvestingPurchasesPrev(sumAmt(invPrevPurch));
        setInvestingProceedsPrev(sumAmt(invPrevProc));
        setInvestingPurchasesCurr(sumAmt(invCurrPurch));
        setInvestingProceedsCurr(sumAmt(invCurrProc));
        try {
          const { data: accounts } = await supabase
            .from('chart_of_accounts')
            .select('id, account_name, account_type')
            .eq('company_id', companyProfile.company_id);
          const accMap = new Map<string, { name: string; type: string }>((accounts || []).map((a: any) => [String(a.id), { name: String(a.account_name || ''), type: String(a.account_type || '') }]));
          const computeLoanFinanced = async (s: string, e: string) => {
            const { data: entries } = await supabase
              .from('transaction_entries')
              .select(`transaction_id, account_id, debit, credit, transactions!inner ( transaction_date, transaction_type, company_id )`)
              .eq('transactions.company_id', companyProfile.company_id)
              .eq('transactions.transaction_type', 'asset_purchase')
              .gte('transactions.transaction_date', s)
              .lte('transactions.transaction_date', e);
            const byTx = new Map<string, any[]>();
            (entries || []).forEach((e: any) => {
              const tid = String(e.transaction_id || '');
              if (!byTx.has(tid)) byTx.set(tid, []);
              byTx.get(tid)!.push(e);
            });
            let total = 0;
            byTx.forEach((rows) => {
              const hasLoanCredit = rows.some((r: any) => {
                const acc = accMap.get(String(r.account_id || ''));
                const t = String(acc?.type || '').toLowerCase();
                const n = String(acc?.name || '').toLowerCase();
                return Number(r.credit || 0) > 0 && t === 'liability' && (n.includes('loan') || n.includes('borrow'));
              });
              if (hasLoanCredit) {
                const assetDebit = rows.filter((r: any) => {
                  const acc = accMap.get(String(r.account_id || ''));
                  const t = String(acc?.type || '').toLowerCase();
                  const n = String(acc?.name || '').toLowerCase();
                  const isPpe = t === 'asset' && (n.includes('property') || n.includes('plant') || n.includes('equipment') || n.includes('machinery') || n.includes('vehicle'));
                  const isInt = t === 'asset' && (n.includes('intangible') || n.includes('software') || n.includes('patent') || n.includes('goodwill'));
                  return Number(r.debit || 0) > 0 && (isPpe || isInt);
                }).reduce((s: number, r: any) => s + Number(r.debit || 0), 0);
                total += assetDebit;
              }
            });
            return total;
          };
          const prevLoanFin = await computeLoanFinanced(yBStart, yBEnd);
          const currLoanFin = await computeLoanFinanced(yAStart, yAEnd);
          setLoanFinancedAcqPrev(prevLoanFin);
          setLoanFinancedAcqCurr(currLoanFin);
        } catch {}
      } catch {}
    } catch {
    } finally {
      setComparativeLoading(false);
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

  const buildMonthlyRanges = (year: number, startMonth: number) => {
    const base = startMonth - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const mi = (base + i) % 12;
      const y = year + (mi < base ? 1 : 0);
      const start = new Date(y, mi, 1);
      const end = new Date(y, mi + 1, 0);
      const label = start.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
      return {
        label,
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    });
  };

  const loadMonthlyAFS = async () => {
    setMonthlyAFSError(null);
    setMonthlyAFSLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: companyProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!companyProfile?.company_id) throw new Error('Company not found');

      const ranges = buildMonthlyRanges(selectedYear, fiscalStartMonth);
      const rows = await Promise.all(ranges.map(async (r) => {
        const [tbPeriod, tbAsOf, cogs, cf, ppeSum, depMonth, accDepClose] = await Promise.all([
          fetchTrialBalanceForPeriod(companyProfile.company_id, r.start, r.end),
          fetchTrialBalanceAsOf(companyProfile.company_id, r.end),
          calculateCOGSFromInvoices(companyProfile.company_id, r.start, r.end),
          getCashFlowForPeriod(companyProfile.company_id, r.start, r.end),
          calculateTotalPPEAsOf(supabase, companyProfile.company_id, r.end),
          calculateDepreciationExpenseForPeriod(supabase, companyProfile.company_id, r.start, r.end),
          calculateAccumulatedDepreciationAsOf(supabase, companyProfile.company_id, r.end)
        ]);
        const startObj = new Date(r.start);
        const base = fiscalStartMonth - 1;
        const ytdYear = startObj.getMonth() < base ? startObj.getFullYear() - 1 : startObj.getFullYear();
        const ytdStartObj = new Date(ytdYear, base, 1);
        const prevEndObj = new Date(startObj);
        prevEndObj.setDate(prevEndObj.getDate() - 1);
        const ytdStartForMonth = ytdStartObj.toISOString().split('T')[0];
        const prevEndForMonth = prevEndObj.toISOString().split('T')[0];
        const tbYTDForMonth = await fetchTrialBalanceForPeriod(companyProfile.company_id, ytdStartForMonth, prevEndForMonth);
        const totalRevYTDForMonth = (tbYTDForMonth || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'revenue' || String(x.account_type || '').toLowerCase() === 'income').reduce((s: number, x: any) => s + Number(x.balance || 0), 0);
        const totalExpYTDForMonth = (tbYTDForMonth || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'expense' && !String(x.account_name || '').toLowerCase().includes('vat')).reduce((s: number, x: any) => s + Number(x.balance || 0), 0);
        const openingREForMonth = totalRevYTDForMonth - totalExpYTDForMonth;
        const toLower = (s: string) => String(s || '').toLowerCase();
        
        // Define filters for assets
        const isCurrentAsset = (x: any) => (
            toLower(x.account_type) === 'asset' &&
            (
              toLower(x.account_name).includes('cash') ||
              toLower(x.account_name).includes('bank') ||
              toLower(x.account_name).includes('receivable') ||
              toLower(x.account_name).includes('inventory') ||
              parseInt(String(x.account_code || '0'), 10) < 1500
            ) &&
            !toLower(x.account_name).includes('vat') &&
            !['1210','2110','2210'].includes(String(x.account_code || '')) &&
            (!toLower(x.account_name).includes('inventory') || String(x.account_code || '') === '1300')
        );

        const currentAssetsItems = (tbAsOf || [])
          .filter(isCurrentAsset)
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));

      const nonCurrentAssetsAll = (tbAsOf || [])
          .filter((x: any) => toLower(x.account_type) === 'asset' && !isCurrentAsset(x) && !toLower(x.account_name).includes('vat'));
        
        const accDepRows = nonCurrentAssetsAll.filter((r: any) => String(r.account_name || '').toLowerCase().includes('accumulated'));
        const nonCurrentAssets = nonCurrentAssetsAll.filter((r: any) => !String(r.account_name || '').toLowerCase().includes('accumulated'));
        const normalizeName = (name: string) => String(name || '').toLowerCase().replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const nbvFor = (assetRow: any) => {
            const base = normalizeName(assetRow.account_name);
            const related = accDepRows.filter((ad: any) => {
                const adBase = normalizeName(ad.account_name);
                return adBase.includes(base) || base.includes(adBase);
            });
            const accTotal = related.reduce((sum: number, r: any) => sum + Number(r.balance || 0), 0);
            return Number(assetRow.balance || 0) - accTotal;
        };
        const isInvestmentName = (name: string) => {
          const n = String(name || '').toLowerCase();
          return n.includes('investment') || n.includes('fixed deposit') || n.includes('term deposit') || n.includes('bond');
        };
        const invBase = nonCurrentAssets.filter((x: any) => isInvestmentName(x.account_name));

        const nonCurrentAssetsItems = [
           { label: 'Property, Plant and Equipment', amount: ppeSum }
        ];
        
        const longTermInvestmentItems = invBase.map((x: any) => ({
          label: `${x.account_code} - ${x.account_name}`,
          amount: Number(x.balance || 0)
        }));

        const vatReceivableItem = {
          label: 'VAT Receivable',
          amount: (tbAsOf || [])
            .filter((x: any) => toLower(x.account_type) === 'asset' && (toLower(x.account_name).includes('vat input') || toLower(x.account_name).includes('vat receivable')))
            .reduce((s: number, x: any) => s + Number(x.balance || 0), 0),
        };
        const liabilitiesExVat = (tbAsOf || [])
          .filter((x: any) => toLower(x.account_type) === 'liability' && !toLower(x.account_name).includes('vat') && !['2100','2200'].includes(String(x.account_code || '')));
        const currentLiabilitiesItems = liabilitiesExVat
          .filter((x: any) => {
            const name = toLower(x.account_name);
            const code = String(x.account_code || '');
            const isLoan = name.includes('loan');
            const isLongLoan = isLoan && (code === '2400' || name.includes('long'));
            const isShortLoan = isLoan && (code === '2300' || name.includes('short'));
            const isPayableOrSars = name.includes('payable') || name.includes('sars');
            const isCodeCurrent = parseInt(code || '0', 10) < 2300;
            if (code === '2400') return false;
            return isShortLoan || ((isPayableOrSars || isCodeCurrent) && !isLongLoan);
          })
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));
        const vatPayableItem = {
          label: 'VAT Payable',
          amount: (tbAsOf || [])
            .filter((x: any) => toLower(x.account_type) === 'liability' && toLower(x.account_name).includes('vat'))
            .reduce((s: number, x: any) => s + Number(x.balance || 0), 0),
        };
        const currentSet = new Set(currentLiabilitiesItems.map(i => i.label));
        const nonCurrentLiabilitiesItems = (tbAsOf || [])
          .filter((x: any) => toLower(x.account_type) === 'liability')
          .filter((x: any) => !currentSet.has(`${x.account_code} - ${x.account_name}`))
          .filter((x: any) => !toLower(x.account_name).includes('vat'))
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));
        const sum = (arr: any[]) => (arr || []).reduce((s, e) => s + Number(e.balance || 0), 0);

        // Calculate YTD Net Profit from tbAsOf for Retained Earnings adjustment
        const ytdRevenue = sum((tbAsOf || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'revenue' || String(x.account_type || '').toLowerCase() === 'income'));
        const ytdExpenses = sum((tbAsOf || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'expense' && !String(x.account_name || '').toLowerCase().includes('vat')));
        const ytdNetProfit = ytdRevenue - ytdExpenses;

        const equityItems = (tbAsOf || [])
          .filter((x: any) => toLower(x.account_type) === 'equity')
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));
        
        const retainedIndex = equityItems.findIndex((x: any) => x.label.toLowerCase().includes('retained earning'));
        if (retainedIndex >= 0) {
            equityItems[retainedIndex].amount += ytdNetProfit;
        } else {
            equityItems.push({ label: 'Retained Earnings', amount: openingREForMonth + ytdNetProfit });
        }

        const revenueRows = (tbPeriod || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'revenue' || String(x.account_type || '').toLowerCase() === 'income');
        const expenseRows = (tbPeriod || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'expense');
        const costOfSalesRows = expenseRows.filter((x: any) => String(x.account_name || '').toLowerCase().includes('cost of') || String(x.account_code || '').startsWith('50'));
        const opexRows = expenseRows
          .filter((x: any) => !costOfSalesRows.includes(x))
          .filter((x: any) => !String(x.account_name || '').toLowerCase().includes('vat'))
          .filter((x: any) => !(String(x.account_code || '') === '5600' || String(x.account_name || '').toLowerCase().includes('depreciation')));
        const revenue = sum(revenueRows);
        const costOfSalesRaw = sum(costOfSalesRows);
        const costOfSales = costOfSalesRaw > 0 ? costOfSalesRaw : cogs;
        const grossProfit = revenue - costOfSales;
        const opex = sum(opexRows) + Number(depMonth || 0);
        const netProfit = grossProfit - opex;
        const bs = bsGroups(tbAsOf || []);
        bs.totalEquity += ytdNetProfit;
        return {
          label: r.label,
          bs,
          bsDetail: {
            nonCurrentAssetsItems,
            longTermInvestmentItems,
            currentAssetsItems: [...currentAssetsItems, vatReceivableItem],
            currentLiabilitiesItems: [...currentLiabilitiesItems, vatPayableItem],
            nonCurrentLiabilitiesItems,
            equityItems,
          },
          audit: {
             unmappedAccounts: (tbAsOf || []).filter((x: any) => {
                 const label = `${x.account_code} - ${x.account_name}`;
                 const used = new Set([
                     ...nonCurrentAssetsItems.map((i: any) => i.label),
                     ...currentAssetsItems.map((i: any) => i.label),
                     vatReceivableItem.label,
                     ...currentLiabilitiesItems.map((i: any) => i.label),
                     vatPayableItem.label,
                     ...nonCurrentLiabilitiesItems.map((i: any) => i.label),
                     ...equityItems.map((i: any) => i.label)
                 ]);
                 // Also exclude Accumulated Dep accounts as they are netted off
                 if (toLower(x.account_name).includes('accumulated')) return false;
                 // Exclude VAT accounts as they are aggregated
                 if (toLower(x.account_name).includes('vat')) return false;
                 // Exclude PPE accounts as they are sourced from module now
                 if (toLower(x.account_type) === 'asset' && parseInt(String(x.account_code || '0'), 10) >= 1500 && parseInt(String(x.account_code || '0'), 10) < 2000 && !toLower(x.account_name).includes('investment')) return false;
                 
                 return !used.has(label) && Math.abs(Number(x.balance || 0)) > 0.01;
             }).map((x: any) => ({
                 code: x.account_code,
                 name: x.account_name,
                 type: x.account_type,
                 balance: Number(x.balance || 0)
             })),
             tbBalance: sum(tbAsOf || []),
             retainedEarningsCalcs: {
                ytdRevenue,
                ytdExpenses,
                ytdNetProfit,
                retainedOpeningYTD: openingREForMonth
             }
          },
          pl: { revenue, costOfSales, grossProfit, opex, netProfit },
          plDetail: {
            revenueItems: (revenueRows || []).map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) })),
            cogsItems: (costOfSalesRows || []).map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) })),
            opexItems: [
              ...(opexRows || []).map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) })),
              { label: 'Monthly Depreciation', amount: Number(depMonth || 0) }
            ],
          },
        
          cf: {
            netOperating: Number(cf?.net_cash_from_operations || 0),
            netInvesting: Number(cf?.net_cash_from_investing || 0),
            netFinancing: Number(cf?.net_cash_from_financing || 0),
            netChange: Number(cf?.net_change_in_cash || 0),
            opening: Number(cf?.opening_cash_balance || 0),
            closing: Number(cf?.closing_cash_balance || 0),
          },
        } as any;
      }));
      setMonthlyAFSData(rows);
    } catch (e: any) {
      setMonthlyAFSError(e.message || 'Failed to load monthly AFS');
    } finally {
      setMonthlyAFSLoading(false);
    }
  };

  const handleStatementExport = async (report: 'bs' | 'pl' | 'cf', type: 'pdf' | 'excel') => {
    try {
      if (report === 'bs') {
        const currentAssets = trialBalance
          .filter(r =>
            r.account_type.toLowerCase() === 'asset' &&
            (
              r.account_name.toLowerCase().includes('cash') ||
              r.account_name.toLowerCase().includes('bank') ||
              r.account_name.toLowerCase().includes('receivable') ||
              r.account_name.toLowerCase().includes('inventory') ||
              parseInt(String(r.account_code || '0'), 10) < 1500
            )
          )
          .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
          .filter(r => !['1210','2110','2210'].includes(String(r.account_code || '')))
          .filter(r => (!String(r.account_name || '').toLowerCase().includes('inventory') || String(r.account_code || '') === '1300'));
        const nonCurrentAssetsAll = trialBalance
          .filter(r => r.account_type.toLowerCase() === 'asset' && !currentAssets.includes(r))
          .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'));
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
        const isInvestmentName = (name: string) => {
          const n = String(name || '').toLowerCase();
          return n.includes('investment') || n.includes('fixed deposit') || n.includes('term deposit') || n.includes('bond');
        };
        const ppeBase = nonCurrentAssets.filter((x: any) => !isInvestmentName(x.account_name));
        const invBase = nonCurrentAssets.filter((x: any) => isInvestmentName(x.account_name));
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
        const vatInputAsAssets = trialBalanceAsOf.filter(r =>
          (String(r.account_name || '').toLowerCase().includes('vat input') || String(r.account_name || '').toLowerCase().includes('vat receivable'))
        );
        const currentSet = new Set(currentLiabilities.map(r => r.account_id));
        const nonCurrentLiabilities = trialBalance.filter(r => r.account_type.toLowerCase() === 'liability' && !currentSet.has(r.account_id));
        const equity = trialBalance.filter(r => r.account_type.toLowerCase() === 'equity');
        const revenueRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
        const expenseRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat'));
        const costOfSalesRows = expenseRows.filter(r => r.account_name.toLowerCase().includes('cost of') || String(r.account_code || '').startsWith('50'));
        const operatingExpenseRows = expenseRows
          .filter(r => !costOfSalesRows.includes(r))
          .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));
        const totalRevenue = revenueRows.reduce((sum, r) => sum + r.balance, 0);
        const totalCostOfSales = costOfSalesRows.reduce((sum, r) => sum + r.balance, 0);
        const grossProfit = totalRevenue - totalCostOfSales;
        const opexBase = operatingExpenseRows.reduce((sum, r) => sum + r.balance, 0);
        const netProfitForPeriod = grossProfit - (opexBase + Number(depExpensePeriod || 0));
        let equityDisplay: any[] = [...equity];
        if (periodMode === 'monthly') {
          equityDisplay = equityDisplay.filter(r => !String(r.account_name || '').toLowerCase().includes('retained earning'));
          equityDisplay.push({ account_id: 'retained-opening-synthetic', account_code: '—', account_name: 'Retained Earnings (opening)', account_type: 'equity', normal_balance: 'credit', total_debits: 0, total_credits: 0, balance: retainedOpeningYTD } as any);
          equityDisplay.push({ account_id: 'retained-during-synthetic', account_code: '—', account_name: 'Retained Earnings (during)', account_type: 'equity', normal_balance: 'credit', total_debits: 0, total_credits: 0, balance: netProfitPeriod } as any);
        } else {
          const retainedIndex = equityDisplay.findIndex(r => String(r.account_name || '').toLowerCase().includes('retained earning'));
          if (retainedIndex >= 0) {
            const retained = equityDisplay[retainedIndex];
            const adjusted = { ...retained, balance: retained.balance + netProfitForPeriod } as any;
            equityDisplay.splice(retainedIndex, 1, adjusted);
          } else {
            equityDisplay.push({ account_id: 'retained-synthetic', account_code: '—', account_name: 'Retained Earnings (adjusted)', account_type: 'equity', balance: netProfitForPeriod } as any);
          }
        }
        const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0) + vatReceivableAsOf;
        const totalFixedAssetsNBV = ppeBase.reduce((sum: number, r: any) => sum + nbvFor(r), 0);
        const totalLongTermInvestments = invBase.reduce((sum: number, r: any) => sum + r.balance, 0);
        const totalNonCurrentAssets = totalFixedAssetsNBV + totalLongTermInvestments;
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
        const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0) + vatPayableAsOf;
        const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
        const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
        const totalEquity = equityDisplay.reduce((sum, r) => sum + r.balance, 0);
        const data = [
          { account: 'ASSETS', amount: 0, type: 'header' },
          { account: 'Current Assets', amount: 0, type: 'subheader' },
          ...currentAssets.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'asset' })),
          { account: 'VAT Receivable', amount: vatReceivableAsOf, type: 'asset' },
          { account: 'Total Current Assets', amount: totalCurrentAssets, type: 'subtotal' },
          { account: 'Non-current Assets', amount: 0, type: 'subheader' },
          ...ppeBase.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: nbvFor(r), type: 'asset' })),
          { account: 'Fixed Assets (PPE) - NBV', amount: totalFixedAssetsNBV, type: 'asset' },
          ...invBase.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'asset' })),
          { account: 'Long-term Investments', amount: totalLongTermInvestments, type: 'asset' },
          { account: 'Total Non-current Assets', amount: totalNonCurrentAssets, type: 'subtotal' },
          { account: 'TOTAL ASSETS', amount: totalAssets, type: 'total' },
          { account: 'LIABILITIES', amount: 0, type: 'header' },
          { account: 'Current Liabilities', amount: 0, type: 'subheader' },
          ...currentLiabilities.map(r => ({ account: `${r.account_code} - ${r.account_name}`, amount: r.balance, type: 'liability' })),
          { account: 'VAT Payable', amount: vatPayableAsOf, type: 'liability' },
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: companyProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        if (!companyProfile?.company_id) return;
        const revenue = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
        const expenses = trialBalance.filter(r => String(r.account_type || '').toLowerCase() === 'expense');
        const costOfSales = expenses.filter(r => r.account_name.toLowerCase().includes('cost of') || r.account_code.startsWith('50'));
        const operatingExpenses = expenses
          .filter(r => !costOfSales.includes(r))
          .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
          .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));
        const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
        const totalCostOfSales = costOfSales.reduce((sum, r) => sum + r.balance, 0);
        const grossProfit = totalRevenue - totalCostOfSales;
        const totalOperatingExpenses = operatingExpenses.reduce((sum, r) => sum + r.balance, 0);
        const depExp = await calculateDepreciationExpenseForPeriod(supabase, companyProfile.company_id, periodStart, periodEnd);
        const totalOperatingExpensesWithDep = totalOperatingExpenses + Number(depExp || 0);
        const netProfit = grossProfit - totalOperatingExpensesWithDep;
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
          { account: 'Monthly Depreciation', amount: Number(depExp || 0), type: 'expense' },
          { account: 'Total Operating Expenses', amount: totalOperatingExpensesWithDep, type: 'subtotal' },
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

  const openTrace = (label: string) => {
    setTraceLabel(label);
  };

  const resolveAccountFromLabel = (lab: string): TrialBalanceRow | null => {
    const parts = String(lab || '').split(' - ');
    if (parts.length < 2) return null;
    const code = parts[0].trim();
    const name = parts.slice(1).join(' - ').trim();
    const findIn = (arr: TrialBalanceRow[]) => arr.find(r => String(r.account_code || '') === code && String(r.account_name || '') === name) || null;
    return findIn(trialBalanceAsOf) || findIn(trialBalance) || null;
  };

  const loadTraceCFMonthlyByAccount = async (accountId: string) => {
    try {
      setTraceCFLoading(true);
      const ranges = buildMonthlyRanges(selectedYear, fiscalStartMonth);
      const start = ranges[0]?.start;
      const end = ranges[ranges.length - 1]?.end;
      if (!start || !end) { setTraceCFMonthly(null); setTraceCFLoading(false); return; }
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('entry_date,debit,credit')
        .eq('account_id', accountId)
        .gte('entry_date', start)
        .lte('entry_date', end);
      if (error) throw error;
      const vals: Record<string, number> = {};
      ranges.forEach(r => { vals[r.label] = 0; });
      (data || []).forEach((e: any) => {
        const d = new Date(String(e.entry_date || '')); const mi = d.getMonth();
        const lab = ranges[mi]?.label; if (!lab) return;
        const debit = Number(e.debit || 0); const credit = Number(e.credit || 0);
        const net = debit - credit;
        vals[lab] = (vals[lab] || 0) + net;
      });
      setTraceCFMonthly(vals);
    } catch (e: any) {
      toast({ title: 'Trace error', description: e.message || 'Could not load monthly movements', variant: 'destructive' });
      setTraceCFMonthly(null);
    } finally {
      setTraceCFLoading(false);
    }
  };

  useEffect(() => {
    if (!traceLabel) { setTraceResolved(null); setTraceCFMonthly(null); return; }
    const r = resolveAccountFromLabel(traceLabel);
    setTraceResolved(r);
    if (r?.account_id) {
      loadTraceCFMonthlyByAccount(r.account_id);
    } else {
      setTraceCFMonthly(null);
    }
  }, [traceLabel, selectedYear, trialBalanceAsOf, trialBalance]);

  // GAAP Statement of Financial Position (Balance Sheet)
  const renderStatementOfFinancialPosition = () => {
    const currentAssets = trialBalanceAsOf.filter(r =>
      r.account_type.toLowerCase() === 'asset' &&
      (r.account_name.toLowerCase().includes('cash') ||
       r.account_name.toLowerCase().includes('bank') ||
       r.account_name.toLowerCase().includes('receivable') ||
       r.account_name.toLowerCase().includes('inventory') ||
       parseInt(r.account_code) < 1500) &&
      !String(r.account_name || '').toLowerCase().includes('vat') &&
      !['1210','2110','2210'].includes(String(r.account_code || ''))
    );
    
    const nonCurrentAssetsAll = trialBalanceAsOf.filter(r =>
      r.account_type.toLowerCase() === 'asset' &&
      !currentAssets.includes(r) &&
      !String(r.account_name || '').toLowerCase().includes('vat')
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
    
    const liabilitiesExVat = trialBalanceAsOf.filter(r =>
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
    
    const equity = trialBalanceAsOf.filter(r => r.account_type.toLowerCase() === 'equity');

    // Compute net profit for the period to roll into retained earnings
    const revenueRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const expenseRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat'));
    const totalRevenue = revenueRows.reduce((sum, r) => sum + r.balance, 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + r.balance, 0);
    const netProfitForPeriod = totalRevenue - totalExpenses;

    let equityDisplay: any[] = [...equity];
    if (periodMode === 'monthly') {
      equityDisplay = equityDisplay.filter(r => !String(r.account_name || '').toLowerCase().includes('retained earning'));
      equityDisplay.push({ account_id: 'retained-opening-synthetic', account_code: '—', account_name: 'Retained Earnings (opening)', account_type: 'equity', normal_balance: 'credit', total_debits: 0, total_credits: 0, balance: retainedOpeningYTD });
      equityDisplay.push({ account_id: 'retained-during-synthetic', account_code: '—', account_name: 'Retained Earnings (during)', account_type: 'equity', normal_balance: 'credit', total_debits: 0, total_credits: 0, balance: netProfitPeriod });
    } else {
      const retainedIndex = equityDisplay.findIndex(r => String(r.account_name || '').toLowerCase().includes('retained earning'));
      if (retainedIndex >= 0) {
        const retained = equityDisplay[retainedIndex];
        const adjusted = { ...retained, balance: retained.balance + netProfitForPeriod };
        equityDisplay.splice(retainedIndex, 1, adjusted);
      } else {
        equityDisplay.push({ account_id: 'retained-synthetic', account_code: '—', account_name: 'Retained Earnings (adjusted)', account_type: 'equity', normal_balance: 'credit', total_debits: 0, total_credits: 0, balance: netProfitForPeriod });
      }
    }

    if (periodMode !== 'monthly') {
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
    }

    const vatPayable = Math.max(0, vatPayableAsOf);
    const vatReceivable = Math.max(0, vatReceivableAsOf);
    const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0) + vatReceivable;
    // const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, r) => sum + nbvFor(r), 0);

    // Split non-current assets into Investments and Fixed Assets
    const longTermInvestmentRows = nonCurrentAssets.filter(r => 
      r.account_name.toLowerCase().includes('investment')
    );
    const totalLongTermInvestments = longTermInvestmentRows.reduce((sum, r) => sum + nbvFor(r), 0);
    
    // Sourced from Fixed Assets Module
    const totalFixedAssetsNBV = ppeValueFromModule;
    
    // Recalculate Total Non-Current Assets using the module value for PPE
    const totalNonCurrentAssetsCalc = totalFixedAssetsNBV + totalLongTermInvestments;

    const totalAssets = totalCurrentAssets + totalNonCurrentAssetsCalc;
    
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + vatPayable + totalNonCurrentLiabilities;
    
    const totalEquity = equityDisplay.reduce((sum, r) => sum + r.balance, 0);

    // Helper to get note number
    const getNoteNumber = (row: any) => {
      const name = String(row.account_name || '').toLowerCase();
      const code = String(row.account_code || '');
      
      if (name.includes('inventory')) return '3';
      if (name.includes('receivable') || name.includes('impairment')) return '4';
      if (name.includes('cash') || name.includes('bank')) return '5';
      if (name.includes('payable') || name.includes('accrual')) return '6';
      if (row.account_type === 'equity') return '11';
      
      return '';
    };

    const handleNoteClick = (noteId: string) => {
      if (!noteId) return;
      setActiveTab('ifrs-notes');
      setTimeout(() => {
        const el = document.getElementById(`note-${noteId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Optional: Add highlight
          el.style.backgroundColor = 'rgba(var(--primary), 0.1)';
          setTimeout(() => el.style.backgroundColor = '', 2000);
        }
      }, 200);
    };

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

        {/* Header Row */}
        <div className="grid grid-cols-[1fr_80px_150px] border-b pb-2 mb-4 font-semibold text-sm text-muted-foreground">
            <div>Description</div>
            <div className="text-center">Note</div>
            <div className="text-right">Amount</div>
        </div>

        {/* ASSETS */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold border-b-2 pb-2">ASSETS</h3>
          
          {/* Fixed Assets (PPE) - MOVED FIRST */}
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Fixed Assets (PPE)</h4>
            <div className="grid grid-cols-[1fr_80px_150px] py-1 px-2 items-center hover:bg-accent/50 rounded">
              <span>Total Fixed Assets (NBV)</span>
              <span 
                className="text-center text-sm text-primary underline cursor-pointer hover:text-primary/80"
                onClick={() => handleNoteClick('2')}
              >
                2
              </span>
              <span className="font-mono text-right">R {totalFixedAssetsNBV.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[1fr_80px_150px] py-1 px-2 items-center hover:bg-accent/50 rounded">
              <span>Long-term Investments</span>
              <span></span>
              <span className="font-mono text-right">R {totalLongTermInvestments.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[1fr_80px_150px] py-2 font-semibold border-t mt-2">
              <span>Total Non-current Assets</span>
              <span></span>
              <span className="font-mono text-right">R {totalNonCurrentAssetsCalc.toLocaleString()}</span>
            </div>
          </div>

          {/* Current Assets - MOVED SECOND */}
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Current Assets</h4>
            {currentAssets.map(row => (
              <div key={row.account_id} className="grid grid-cols-[1fr_80px_150px] py-1 hover:bg-accent/50 px-2 rounded group items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span 
                    className="cursor-pointer truncate"
                    onClick={() => handleDrilldown(row.account_id, row.account_name)}
                  >
                    {row.account_code} - {row.account_name}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded-full hover:bg-primary/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDrilldown(row.account_id, row.account_name);
                          }}
                        >
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View source transactions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span 
                  className="text-center text-sm text-primary underline cursor-pointer hover:text-primary/80"
                  onClick={() => handleNoteClick(getNoteNumber(row))}
                >
                  {getNoteNumber(row)}
                </span>
                <span className="font-mono text-right">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_80px_150px] py-1 px-2 items-center">
              <span>VAT Receivable</span>
              <span></span>
              <span className="font-mono text-right">R {vatReceivable.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[1fr_80px_150px] py-2 font-semibold border-t mt-2">
              <span>Total Current Assets</span>
              <span></span>
              <span className="font-mono text-right">R {totalCurrentAssets.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_80px_150px] py-2 text-lg font-bold border-t-2 border-b-2 text-emerald-700 bg-emerald-50/30 px-2">
            <span>TOTAL ASSETS</span>
            <span></span>
            <span className="font-mono text-right">R {totalAssets.toLocaleString()}</span>
          </div>
        </div>

        {/* LIABILITIES */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold border-b-2 pb-2">LIABILITIES</h3>
          
          {/* Non-current Liabilities - MOVED FIRST */}
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Non-current Liabilities</h4>
            {nonCurrentLiabilities.map(row => (
              <div key={row.account_id} className="grid grid-cols-[1fr_80px_150px] py-1 hover:bg-accent/50 px-2 rounded group items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span 
                    className="cursor-pointer truncate"
                    onClick={() => handleDrilldown(row.account_id, row.account_name)}
                  >
                    {row.account_code} - {row.account_name}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded-full hover:bg-primary/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDrilldown(row.account_id, row.account_name);
                          }}
                        >
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View source transactions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span 
                  className="text-center text-sm text-primary underline cursor-pointer hover:text-primary/80"
                  onClick={() => handleNoteClick(getNoteNumber(row))}
                >
                  {getNoteNumber(row)}
                </span>
                <span className="font-mono text-right">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_80px_150px] py-2 font-semibold border-t mt-2">
              <span>Total Non-current Liabilities</span>
              <span></span>
              <span className="font-mono text-right">R {totalNonCurrentLiabilities.toLocaleString()}</span>
            </div>
          </div>

          {/* Current Liabilities - MOVED SECOND */}
          <div className="pl-4">
            <h4 className="font-semibold text-lg mb-2">Current Liabilities</h4>
            {currentLiabilities.map(row => (
              <div key={row.account_id} className="grid grid-cols-[1fr_80px_150px] py-1 hover:bg-accent/50 px-2 rounded group items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span 
                    className="cursor-pointer truncate"
                    onClick={() => handleDrilldown(row.account_id, row.account_name)}
                  >
                    {row.account_code} - {row.account_name}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded-full hover:bg-primary/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDrilldown(row.account_id, row.account_name);
                          }}
                        >
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View source transactions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span 
                  className="text-center text-sm text-primary underline cursor-pointer hover:text-primary/80"
                  onClick={() => handleNoteClick(getNoteNumber(row))}
                >
                  {getNoteNumber(row)}
                </span>
                <span className="font-mono text-right">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_80px_150px] py-1 px-2 items-center">
              <span>VAT Payable</span>
              <span></span>
              <span className="font-mono text-right">R {vatPayable.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[1fr_80px_150px] py-2 font-semibold border-t mt-2">
              <span>Total Current Liabilities</span>
              <span></span>
              <span className="font-mono text-right">R {(totalCurrentLiabilities + vatPayable).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_80px_150px] py-2 font-semibold border-t px-2">
            <span>Total Liabilities</span>
            <span></span>
            <span className="font-mono text-right">R {totalLiabilities.toLocaleString()}</span>
          </div>
        </div>

        {/* EQUITY */}
        <div className="space-y-4 mt-8">
          <h3 className="text-xl font-bold border-b-2 pb-2">EQUITY</h3>
          <div className="pl-4">
            {equityDisplay.map(row => (
              <div key={row.account_id || row.account_code} className="grid grid-cols-[1fr_80px_150px] py-1 hover:bg-accent/50 px-2 rounded group items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span 
                    className="cursor-pointer truncate"
                    onClick={() => handleDrilldown(row.account_id, row.account_name)}
                  >
                    {row.account_code} - {row.account_name}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded-full hover:bg-primary/10 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDrilldown(row.account_id, row.account_name);
                          }}
                        >
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View source transactions</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span 
                  className="text-center text-sm text-primary underline cursor-pointer hover:text-primary/80"
                  onClick={() => handleNoteClick(getNoteNumber(row))}
                >
                  {getNoteNumber(row)}
                </span>
                <span className="font-mono text-right">R {row.balance.toLocaleString()}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_80px_150px] py-2 font-semibold border-t mt-2">
              <span>Total Equity</span>
              <span></span>
              <span className="font-mono text-right">R {totalEquity.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* TOTAL LIAB & EQUITY */}
        <div className="grid grid-cols-[1fr_80px_150px] py-3 text-lg font-bold border-t-2 border-b-2 bg-purple-50/30 text-purple-700 px-2">
          <span>TOTAL LIABILITIES & EQUITY</span>
          <span></span>
          <span className="font-mono text-right">R {(totalLiabilities + totalEquity).toLocaleString()}</span>
        </div>


        {/* Validation / Statement Balanced */}
        {accountingEquation && (
          <div className={`p-4 rounded-lg mt-4 flex items-center justify-center ${accountingEquation.is_valid ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
             <div className="flex items-center gap-2 font-bold">
                {accountingEquation.is_valid ? (
                    <div className="flex items-center gap-2 text-emerald-700">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <span>Statement is Balanced</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1 text-red-700">
                         <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                            <span>Statement is Unbalanced</span>
                        </div>
                        <span className="text-sm font-normal">Difference: R {formatRand(accountingEquation.difference)}</span>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderIFRSNotes = () => {
    // Helper to sum accounts
    const sum = (arr: TrialBalanceRow[]) => arr.reduce((s, r) => s + Number(r.balance || 0), 0);
    const toLower = (s: string) => String(s || '').toLowerCase();
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
    
    // --- DATA PREPARATION ---
    // Balance Sheet items use 'trialBalanceAsOf' (Cumulative)
    // P&L items use 'trialBalance' (Period Movement)

    // 2. PPE (BS)
    const nonCurrentAssets = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset' && parseInt(String(r.account_code || '0'), 10) >= 1500);
    const ppeItems = nonCurrentAssets.filter(r => !toLower(r.account_name).includes('accumulated') && !toLower(r.account_name).includes('intangible') && !toLower(r.account_name).includes('investment'));
    const accDepItems = nonCurrentAssets.filter(r => toLower(r.account_name).includes('accumulated'));
    
    const getAccumulatedFor = (name: string) => {
        const base = toLower(name).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
        return accDepItems.filter(ad => {
            const adBase = toLower(ad.account_name).replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
            return adBase.includes(base) || base.includes(adBase);
        }).reduce((s, r) => s + r.balance, 0);
    };

    // 3. Inventory (BS)
    const inventoryItems = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset' && toLower(r.account_name).includes('inventory'));

    // 4. Receivables (BS)
    const tradeReceivables = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset' && (toLower(r.account_name).includes('trade receivable') || toLower(r.account_name).includes('accounts receivable')));
    const impairment = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset' && toLower(r.account_name).includes('impairment'));
    const otherReceivables = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset' && !tradeReceivables.includes(r) && !inventoryItems.includes(r) && !ppeItems.includes(r) && !toLower(r.account_name).includes('bank') && !toLower(r.account_name).includes('cash') && parseInt(String(r.account_code || '0'), 10) < 1500);

    // 5. Cash (BS)
    const cashItems = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'asset' && (toLower(r.account_name).includes('cash') || toLower(r.account_name).includes('bank')));
    
    // 6. Payables (BS)
    const tradePayables = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'liability' && (toLower(r.account_name).includes('trade payable') || toLower(r.account_name).includes('accounts payable')));
    const otherPayables = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'liability' && !tradePayables.includes(r) && !toLower(r.account_name).includes('tax') && !toLower(r.account_name).includes('vat'));

    // 7. Revenue (P&L)
    const revenueItems = trialBalance.filter(r => toLower(r.account_type) === 'revenue' || toLower(r.account_type) === 'income');
    
    // 8. Cost of Sales (P&L)
    const cogsItems = trialBalance.filter(r => (String(r.account_code || '')).startsWith('50') || toLower(r.account_name).includes('cost of') || toLower(r.account_name).includes('purchases'));

    // 9. Operating Expenses (P&L)
    const expenseItems = trialBalance.filter(r => toLower(r.account_type) === 'expense' && !cogsItems.includes(r) && !toLower(r.account_name).includes('tax'));

    // 10. Taxation (P&L)
    const taxItems = trialBalance.filter(r => toLower(r.account_type) === 'expense' && toLower(r.account_name).includes('tax'));

    // 11. Equity (BS)
    const equityItems = trialBalanceAsOf.filter(r => toLower(r.account_type) === 'equity');

    return (
      <div className="space-y-8 p-4">
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold text-center">Notes to the Financial Statements</h2>
          <p className="text-center text-muted-foreground">For the period ended {format(new Date(periodEnd), 'dd MMMM yyyy')}</p>
        </div>

        {/* 1. Basis of Preparation */}
        <div id="note-1" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">1. Basis of Preparation</h3>
          <p className="text-sm text-muted-foreground">
            Financial statements are prepared on the accrual basis in accordance with IFRS for SMEs and on a going-concern assumption.
          </p>
        </div>

        {/* 2. Property, Plant & Equipment */}
        <div id="note-2" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">2. Property, Plant & Equipment</h3>
          <p className="text-sm text-muted-foreground mb-2">Shows PPE cost, additions, depreciation, and carrying amount.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Accumulated Depreciation</TableHead>
                <TableHead className="text-right">Carrying Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ppeItems.map(item => {
                const cost = item.balance;
                const accDep = getAccumulatedFor(item.account_name); 
                return (
                  <TableRow key={item.account_code}>
                    <TableCell>{item.account_name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(accDep)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(cost + accDep)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(ppeItems))}</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(accDepItems))}</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(ppeItems) + sum(accDepItems))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 3. Inventory */}
        <div id="note-3" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">3. Inventory</h3>
          <p className="text-sm text-muted-foreground mb-2">Inventory measured at lower of cost and NRV.</p>
          <Table>
            <TableBody>
              {inventoryItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Inventory</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(inventoryItems))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 4. Trade Receivables */}
        <div id="note-4" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">4. Trade Receivables</h3>
          <p className="text-sm text-muted-foreground mb-2">Shows receivables balance and impairment (ECL) if any.</p>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Trade Receivables (Gross)</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(tradeReceivables))}</TableCell>
              </TableRow>
              {impairment.length > 0 && (
                 <TableRow>
                  <TableCell>Less: Impairment (ECL)</TableCell>
                  <TableCell className="text-right">{formatCurrency(sum(impairment))}</TableCell>
                </TableRow>
              )}
              {otherReceivables.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Net Trade and Other Receivables</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(tradeReceivables) + sum(impairment) + sum(otherReceivables))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 5. Cash & Cash Equivalents */}
        <div id="note-5" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">5. Cash & Cash Equivalents</h3>
          <p className="text-sm text-muted-foreground mb-2">Bank and cash on hand.</p>
          <Table>
            <TableBody>
              {cashItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}
               <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Cash and Cash Equivalents</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(cashItems))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 6. Trade Payables */}
        <div id="note-6" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">6. Trade Payables</h3>
          <p className="text-sm text-muted-foreground mb-2">Closing balance of payables.</p>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Trade Payables</TableCell>
                <TableCell className="text-right">{formatCurrency(Math.abs(sum(tradePayables)))}</TableCell>
              </TableRow>
               {otherPayables.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Math.abs(item.balance))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Trade and Other Payables</TableCell>
                <TableCell className="text-right">{formatCurrency(Math.abs(sum(tradePayables) + sum(otherPayables)))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 7. Revenue */}
        <div id="note-7" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">7. Revenue</h3>
          <p className="text-sm text-muted-foreground mb-2">Total revenue for the year.</p>
          <Table>
            <TableBody>
              {revenueItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Math.abs(item.balance))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Revenue</TableCell>
                <TableCell className="text-right">{formatCurrency(Math.abs(sum(revenueItems)))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 8. Cost of Sales */}
        <div id="note-8" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">8. Cost of Sales</h3>
          <p className="text-sm text-muted-foreground mb-2">Opening inventory, purchases, closing inventory.</p>
          <Table>
            <TableBody>
              {cogsItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Cost of Sales</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(cogsItems))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 9. Operating Expenses */}
        <div id="note-9" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">9. Operating Expenses</h3>
          <p className="text-sm text-muted-foreground mb-2">Grouped total of expenses.</p>
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Operating Expenses</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(expenseItems))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* 10. Taxation */}
        <div id="note-10" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">10. Taxation</h3>
          <p className="text-sm text-muted-foreground mb-2">Current tax expense and tax rate used.</p>
          <Table>
            <TableBody>
              {taxItems.length > 0 ? taxItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">No tax expense recorded for this period.</TableCell>
                </TableRow>
              )}
              {taxItems.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total Taxation</TableCell>
                    <TableCell className="text-right">{formatCurrency(sum(taxItems))}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 11. Equity */}
        <div id="note-11" className="space-y-4 scroll-mt-24">
          <h3 className="text-lg font-semibold">11. Equity</h3>
          <p className="text-sm text-muted-foreground mb-2">Opening balance, contributions, withdrawals, closing balance.</p>
          <Table>
            <TableBody>
              {equityItems.map(item => (
                <TableRow key={item.account_code}>
                  <TableCell>{item.account_name}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>Total Equity</TableCell>
                <TableCell className="text-right">{formatCurrency(sum(equityItems))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const bsGroups = (tb: Pick<TrialBalanceRow, 'account_id' | 'account_code' | 'account_name' | 'account_type' | 'balance'>[]) => {
    const currentAssets = tb.filter(r =>
      r.account_type.toLowerCase() === 'asset' &&
      (r.account_name.toLowerCase().includes('cash') ||
       r.account_name.toLowerCase().includes('bank') ||
       r.account_name.toLowerCase().includes('receivable') ||
       r.account_name.toLowerCase().includes('inventory') ||
       parseInt(r.account_code) < 1500) &&
      !String(r.account_name || '').toLowerCase().includes('vat') &&
      !['1210','2110','2210'].includes(String(r.account_code || '')) &&
      (!String(r.account_name || '').toLowerCase().includes('inventory') || String(r.account_code || '') === '1300')
    );
    const nonCurrentAssetsAll = tb.filter(r => r.account_type.toLowerCase() === 'asset' && !currentAssets.includes(r));
    const accDepRows = nonCurrentAssetsAll.filter(r => String(r.account_name || '').toLowerCase().includes('accumulated'));
    const nonCurrentAssets = nonCurrentAssetsAll.filter(r => !String(r.account_name || '').toLowerCase().includes('accumulated'));
    const normalizeName = (name: string) => name.toLowerCase().replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const nbvFor = (assetRow: Pick<TrialBalanceRow, 'account_id' | 'account_code' | 'account_name' | 'account_type' | 'balance'>) => {
      const base = normalizeName(assetRow.account_name);
      const related = accDepRows.filter(ad => {
        const adBase = normalizeName(ad.account_name);
        return adBase.includes(base) || base.includes(adBase);
      });
      const accTotal = related.reduce((sum, r) => sum + r.balance, 0);
      return assetRow.balance - accTotal;
    };
    const isInvestment = (row: Pick<TrialBalanceRow, 'account_id' | 'account_code' | 'account_name' | 'account_type' | 'balance'>) => {
      const n = String(row.account_name || '').toLowerCase();
      return n.includes('investment') || n.includes('fixed deposit') || n.includes('term deposit') || n.includes('bond');
    };
    const ppeAssets = nonCurrentAssets.filter(r => !isInvestment(r));
    const longTermInvestments = nonCurrentAssets.filter(r => isInvestment(r));
    const vatInputAsAssets = tb.filter(r => (String(r.account_name || '').toLowerCase().includes('vat input') || String(r.account_name || '').toLowerCase().includes('vat receivable')));
    const vatPayableRows = tb.filter(r => r.account_type.toLowerCase() === 'liability' && String(r.account_name || '').toLowerCase().includes('vat'));
    const vatReceivable = vatInputAsAssets.reduce((s, r) => s + r.balance, 0);
    const vatPayable = vatPayableRows.reduce((s, r) => s + r.balance, 0);
    const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0) + vatReceivable;
    const totalFixedAssetsNBV = ppeAssets.reduce((sum, r) => sum + nbvFor(r), 0);
    const totalLongTermInvestments = longTermInvestments.reduce((sum, r) => sum + r.balance, 0);
    const totalNonCurrentAssets = totalFixedAssetsNBV + totalLongTermInvestments;
    const liabilitiesExVat = tb.filter(r => r.account_type.toLowerCase() === 'liability' && !String(r.account_name || '').toLowerCase().includes('vat') && !['2100','2200'].includes(String(r.account_code || '')));
    const currentLiabilities = liabilitiesExVat.filter(r => {
      const name = String(r.account_name || '').toLowerCase();
      const code = String(r.account_code || '');
      const isLoan = name.includes('loan');
      const isLongLoan = isLoan && (code === '2400' || name.includes('long'));
      const isShortLoan = isLoan && (code === '2300' || name.includes('short'));
      const isPayableOrTax = (name.includes('payable') || name.includes('sars'));
      return (isPayableOrTax && !isLongLoan) || isShortLoan;
    });
    const currentSet = new Set(currentLiabilities.map(r => r.account_id));
    const nonCurrentLiabilities = tb.filter(r => r.account_type.toLowerCase() === 'liability' && !currentSet.has(r.account_id) && !String(r.account_name || '').toLowerCase().includes('vat'));
    const equity = tb.filter(r => r.account_type.toLowerCase() === 'equity');
    const totalEquity = equity.reduce((sum, r) => sum + r.balance, 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0) + vatPayable;
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
    return {
      totalCurrentAssets,
      totalNonCurrentAssets,
      totalFixedAssetsNBV,
      totalLongTermInvestments,
      totalAssets,
      totalCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      totalEquity,
      vatReceivable,
      vatPayable,
    };
  };

  const percentChange = (curr: number, prev: number) => {
    const p = Math.abs(prev);
    if (p < 0.00001) return 0;
    return ((curr - prev) / p) * 100;
  };

  const formatRand = (n: number) => Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatAccounting = (n: number) => {
    const v = Number(n || 0);
    const s = formatRand(Math.abs(v));
    return { display: v < 0 ? `(R ${s})` : `R ${s}`, negative: v < 0 };
  };
  const pctClass = (v: number) => (v > 0 ? 'text-green-600 dark:text-green-400' : v < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground');
  const handleComparativeExport = (type: 'pdf' | 'excel') => {
    try {
      const yA = comparativeYearA;
      const yB = comparativeYearB;
      const rows = (() => {
        const r: { label: string; yearA: number; yearB: number; percent?: number; bold?: boolean }[] = [];
        const cfCurr = cashFlowCurrComparative || { net_cash_from_operations: 0, net_cash_from_investing: 0, net_cash_from_financing: 0, net_change_in_cash: 0, opening_cash_balance: 0 } as any;
        const cfPrev = cashFlowPrev || { net_cash_from_operations: 0, net_cash_from_investing: 0, net_cash_from_financing: 0, net_change_in_cash: 0, opening_cash_balance: 0 } as any;
        const pct = (a: number, b: number) => percentChange(a, b);
        r.push({ label: 'Net cash from operating activities', yearA: Number(cfCurr.net_cash_from_operations || 0), yearB: Number(cfPrev.net_cash_from_operations || 0), percent: pct(Number(cfCurr.net_cash_from_operations || 0), Number(cfPrev.net_cash_from_operations || 0)), bold: true });
        r.push({ label: 'Net cash used in / from investing activities', yearA: Number(cfCurr.net_cash_from_investing || 0), yearB: Number(cfPrev.net_cash_from_investing || 0), percent: pct(Number(cfCurr.net_cash_from_investing || 0), Number(cfPrev.net_cash_from_investing || 0)), bold: true });
        r.push({ label: 'Net cash from / used in financing activities', yearA: Number(cfCurr.net_cash_from_financing || 0), yearB: Number(cfPrev.net_cash_from_financing || 0), percent: pct(Number(cfCurr.net_cash_from_financing || 0), Number(cfPrev.net_cash_from_financing || 0)), bold: true });
        r.push({ label: 'Net increase / (decrease) in cash', yearA: Number(cfCurr.net_change_in_cash || 0), yearB: Number(cfPrev.net_change_in_cash || 0), percent: pct(Number(cfCurr.net_change_in_cash || 0), Number(cfPrev.net_change_in_cash || 0)), bold: true });
        r.push({ label: 'Cash and cash equivalents at beginning of period', yearA: Number(cfCurr.opening_cash_balance || 0), yearB: Number(cfPrev.opening_cash_balance || 0) });
        r.push({ label: 'Cash and cash equivalents at end of period', yearA: Number(cfCurr.opening_cash_balance || 0) + Number(cfCurr.net_change_in_cash || 0), yearB: Number(cfPrev.opening_cash_balance || 0) + Number(cfPrev.net_change_in_cash || 0), bold: true });
        return r;
      })();
      if (type === 'pdf') {
        exportComparativeCashFlowToPDF(rows, yA, yB, `Comparative_Cash_Flow_${yA}_vs_${yB}`);
      } else {
        exportComparativeCashFlowToExcel(rows, yA, yB, `Comparative_Cash_Flow_${yA}_vs_${yB}`);
      }
    } catch {}
  };

  const renderComparativeBalanceSheet = () => {
    const y = comparativeYearA;
    const py = comparativeYearB;
    const normalizeName = (name: string) => name.toLowerCase().replace(/accumulated/g, '').replace(/depreciation/g, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const buildMap = (tb: TrialBalanceRow[]) => new Map(tb.map(r => [String(r.account_code || r.account_id), r]));
    const mapCurr = buildMap(trialBalanceCompAsOfA);
    const mapPrev = buildMap(trialBalanceCompAsOfB);
    const listCurrentAssets = (tb: TrialBalanceRow[]) => tb.filter(r => r.account_type.toLowerCase() === 'asset' && (r.account_name.toLowerCase().includes('cash') || r.account_name.toLowerCase().includes('bank') || r.account_name.toLowerCase().includes('receivable') || r.account_name.toLowerCase().includes('inventory') || parseInt(r.account_code) < 1500) && !String(r.account_name || '').toLowerCase().includes('vat'));
    const vatReceivableFor = (tb: TrialBalanceRow[]) => tb.filter(r => String(r.account_name || '').toLowerCase().includes('vat input') || String(r.account_name || '').toLowerCase().includes('vat receivable')).reduce((s, r) => s + r.balance, 0);
    const nonCurrentAssetsAll = (tb: TrialBalanceRow[]) => tb.filter(r => r.account_type.toLowerCase() === 'asset' && !listCurrentAssets(tb).includes(r));
    const accDepRows = (tb: TrialBalanceRow[]) => nonCurrentAssetsAll(tb).filter(r => String(r.account_name || '').toLowerCase().includes('accumulated'));
    const nonCurrentAssets = (tb: TrialBalanceRow[]) => nonCurrentAssetsAll(tb).filter(r => !String(r.account_name || '').toLowerCase().includes('accumulated'));
    const nbvFor = (tb: TrialBalanceRow[], assetRow: TrialBalanceRow) => {
      const base = normalizeName(assetRow.account_name);
      const related = accDepRows(tb).filter(ad => {
        const adBase = normalizeName(ad.account_name);
        return adBase.includes(base) || base.includes(adBase);
      });
      const accTotal = related.reduce((sum, r) => sum + r.balance, 0);
      return assetRow.balance - accTotal;
    };
    const vatPayableFor = (tb: TrialBalanceRow[]) => tb.filter(r => r.account_type.toLowerCase() === 'liability' && String(r.account_name || '').toLowerCase().includes('vat')).reduce((s, r) => s + r.balance, 0);
    const currentLiabilitiesList = (tb: TrialBalanceRow[]) => {
      const rows = tb.filter(r => r.account_type.toLowerCase() === 'liability' && !String(r.account_name || '').toLowerCase().includes('vat'));
      return rows.filter(r => {
        const name = String(r.account_name || '').toLowerCase();
        const code = String(r.account_code || '');
        const isLoan = name.includes('loan');
        const isLongLoan = isLoan && (code === '2400' || name.includes('long'));
        const isShortLoan = isLoan && (code === '2300' || name.includes('short'));
        const isPayableOrTax = name.includes('payable') || name.includes('sars');
        return (isPayableOrTax && !isLongLoan) || isShortLoan;
      });
    };
    const prevSetCurrentLiab = new Set(currentLiabilitiesList(trialBalanceCompAsOfB).map(r => r.account_id));
    const nonCurrentLiabilitiesList = (tb: TrialBalanceRow[]) => tb.filter(r => r.account_type.toLowerCase() === 'liability' && !prevSetCurrentLiab.has(r.account_id));
    const equityList = (tb: TrialBalanceRow[]) => tb.filter(r => r.account_type.toLowerCase() === 'equity');
    const mergeCodes = Array.from(new Set([...trialBalanceCompAsOfA.map(r => String(r.account_code || r.account_id)), ...trialBalanceCompAsOfB.map(r => String(r.account_code || r.account_id))]));
    const rows: Array<{ label: string; curr: number; prev: number; bold?: boolean }> = [];
    rows.push({ label: 'ASSETS', curr: 0, prev: 0, bold: true });
    rows.push({ label: 'VAT Receivable', curr: vatReceivableFor(trialBalanceCompAsOfA), prev: vatReceivableFor(trialBalanceCompAsOfB) });
    rows.push({ label: 'Current Assets', curr: 0, prev: 0, bold: true });
    listCurrentAssets(trialBalanceCompAsOfA).forEach(a => {
      const key = String(a.account_code || a.account_id);
      const prevRow = mapPrev.get(key);
      rows.push({ label: `${a.account_code} - ${a.account_name}`, curr: a.balance, prev: prevRow ? prevRow.balance : 0 });
    });
    const currCA = rows.filter(r => !r.bold && (listCurrentAssets(trialBalanceCompAsOfA).some(a => `${a.account_code} - ${a.account_name}` === r.label))).reduce((s, r) => s + r.curr, 0) + vatReceivableFor(trialBalanceCompAsOfA);
    const prevCA = rows.filter(r => !r.bold && (listCurrentAssets(trialBalanceCompAsOfB).some(a => `${a.account_code} - ${a.account_name}` === r.label))).reduce((s, r) => s + r.prev, 0) + vatReceivableFor(trialBalanceCompAsOfB);
    rows.push({ label: 'Total Current Assets', curr: currCA, prev: prevCA, bold: true });
    rows.push({ label: 'Non-current Assets (NBV)', curr: 0, prev: 0, bold: true });
    nonCurrentAssets(trialBalanceCompAsOfA).forEach(a => {
      const key = String(a.account_code || a.account_id);
      const prevRow = mapPrev.get(key);
      const currNbv = nbvFor(trialBalanceCompAsOfA, a);
      const prevNbv = prevRow ? nbvFor(trialBalanceCompAsOfB, prevRow) : 0;
      rows.push({ label: `${a.account_code} - ${a.account_name}`, curr: currNbv, prev: prevNbv });
    });
    const currNCA = nonCurrentAssets(trialBalanceCompAsOfA).reduce((s, a) => s + nbvFor(trialBalanceCompAsOfA, a), 0);
    const prevNCA = nonCurrentAssets(trialBalanceCompAsOfB).reduce((s, a) => s + nbvFor(trialBalanceCompAsOfB, a), 0);
    rows.push({ label: 'Total Non-current Assets', curr: currNCA, prev: prevNCA, bold: true });
    rows.push({ label: 'TOTAL ASSETS', curr: currCA + currNCA, prev: prevCA + prevNCA, bold: true });
    rows.push({ label: 'LIABILITIES', curr: 0, prev: 0, bold: true });
    rows.push({ label: 'VAT Payable', curr: vatPayableFor(trialBalanceCompAsOfA), prev: vatPayableFor(trialBalanceCompAsOfB) });
    rows.push({ label: 'Current Liabilities', curr: 0, prev: 0, bold: true });
    currentLiabilitiesList(trialBalanceCompAsOfA).forEach(l => {
      const key = String(l.account_code || l.account_id);
      const prevRow = mapPrev.get(key);
      rows.push({ label: `${l.account_code} - ${l.account_name}`, curr: l.balance, prev: prevRow ? prevRow.balance : 0 });
    });
    const currCL = currentLiabilitiesList(trialBalanceCompAsOfA).reduce((s, r) => s + r.balance, 0) + vatPayableFor(trialBalanceCompAsOfA);
    const prevCL = currentLiabilitiesList(trialBalanceCompAsOfB).reduce((s, r) => s + r.balance, 0) + vatPayableFor(trialBalanceCompAsOfB);
    rows.push({ label: 'Total Current Liabilities', curr: currCL, prev: prevCL, bold: true });
    rows.push({ label: 'Non-current Liabilities', curr: 0, prev: 0, bold: true });
    nonCurrentLiabilitiesList(trialBalanceCompAsOfA).forEach(l => {
      const key = String(l.account_code || l.account_id);
      const prevRow = mapPrev.get(key);
      rows.push({ label: `${l.account_code} - ${l.account_name}`, curr: l.balance, prev: prevRow ? prevRow.balance : 0 });
    });
    const currNCL = nonCurrentLiabilitiesList(trialBalanceCompAsOfA).reduce((s, r) => s + r.balance, 0);
    const prevNCL = nonCurrentLiabilitiesList(trialBalanceCompAsOfB).reduce((s, r) => s + r.balance, 0);
    rows.push({ label: 'Total Non-current Liabilities', curr: currNCL, prev: prevNCL, bold: true });
    rows.push({ label: 'TOTAL LIABILITIES', curr: currCL + currNCL, prev: prevCL + prevNCL, bold: true });
    rows.push({ label: 'EQUITY', curr: 0, prev: 0, bold: true });
    equityList(trialBalanceCompAsOfA).forEach(e => {
      const key = String(e.account_code || e.account_id);
      const prevRow = mapPrev.get(key);
      rows.push({ label: `${e.account_code} - ${e.account_name}`, curr: e.balance, prev: prevRow ? prevRow.balance : 0 });
    });
    const currEQ = equityList(trialBalanceCompAsOfA).reduce((s, r) => s + r.balance, 0);
    const prevEQ = equityList(trialBalanceCompAsOfB).reduce((s, r) => s + r.balance, 0);
    rows.push({ label: 'Total Equity', curr: currEQ, prev: prevEQ, bold: true });
    rows.push({ label: 'TOTAL L & E', curr: currCL + currNCL + currEQ, prev: prevCL + prevNCL + prevEQ, bold: true });
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Comparative Statement of Financial Position</h3>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-semibold">Item</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{y}</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{py}</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">% Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`bs-comp-${i}-${r.label}`} className="border-b hover:bg-muted/50">
                  <td className={`p-2 ${r.bold ? 'font-semibold' : ''}`}>{r.label}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-semibold' : ''}`}>R {r.curr.toLocaleString()}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-semibold' : ''}`}>R {r.prev.toLocaleString()}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${pctClass(percentChange(r.curr, r.prev))} ${r.bold ? 'font-semibold' : ''}`}>
                    {percentChange(r.curr, r.prev).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderComparativeIncomeStatement = () => {
    const y = comparativeYearA;
    const py = comparativeYearB;
    const revenueCurr = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const revenuePrev = trialBalancePrev.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const expensesCurr = trialBalance.filter(r => String(r.account_type || '').toLowerCase() === 'expense');
    const expensesPrev = trialBalancePrev.filter(r => String(r.account_type || '').toLowerCase() === 'expense');
    const costOfSalesCurr = expensesCurr.filter(r => r.account_name.toLowerCase().includes('cost of') || String(r.account_code || '').startsWith('50'));
    const costOfSalesPrev = expensesPrev.filter(r => r.account_name.toLowerCase().includes('cost of') || String(r.account_code || '').startsWith('50'));
    const operatingExpensesCurr = expensesCurr
      .filter(r => !costOfSalesCurr.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
      .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));
    const operatingExpensesPrev = expensesPrev
      .filter(r => !costOfSalesPrev.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
      .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));
    const sum = (arr: TrialBalanceRow[]) => arr.reduce((s, r) => s + r.balance, 0);
    const totalRevenueCurr = sum(revenueCurr);
    const totalRevenuePrev = sum(revenuePrev);
    const totalCostOfSalesCurrRaw = sum(costOfSalesCurr);
    const totalCostOfSalesPrevRaw = sum(costOfSalesPrev);
    const totalCostOfSalesCurr = totalCostOfSalesCurrRaw > 0 ? totalCostOfSalesCurrRaw : fallbackCOGS;
    const totalCostOfSalesPrev = totalCostOfSalesPrevRaw > 0 ? totalCostOfSalesPrevRaw : fallbackCOGSPrev;
    const grossProfitCurr = totalRevenueCurr - totalCostOfSalesCurr;
    const grossProfitPrev = totalRevenuePrev - totalCostOfSalesPrev;
    const totalOperatingExpensesCurr = sum(operatingExpensesCurr) + Number(compDepCurr || 0);
    const totalOperatingExpensesPrev = sum(operatingExpensesPrev) + Number(compDepPrev || 0);
    const netProfitCurr = grossProfitCurr - totalOperatingExpensesCurr;
    const netProfitPrev = grossProfitPrev - totalOperatingExpensesPrev;
    const rows: Array<{ label: string; curr: number; prev: number; bold?: boolean }> = [];
    rows.push({ label: 'REVENUE', curr: 0, prev: 0, bold: true });
    revenueCurr.forEach(r => {
      const prevMatch = revenuePrev.find(p => p.account_code === r.account_code);
      rows.push({ label: `${r.account_code} - ${r.account_name}`, curr: r.balance, prev: prevMatch ? prevMatch.balance : 0 });
    });
    rows.push({ label: 'Total Revenue', curr: totalRevenueCurr, prev: totalRevenuePrev, bold: true });
    rows.push({ label: 'COST OF SALES', curr: 0, prev: 0, bold: true });
    costOfSalesCurr.forEach(r => {
      const prevMatch = costOfSalesPrev.find(p => p.account_code === r.account_code);
      rows.push({ label: `${r.account_code} - ${r.account_name}`, curr: r.balance, prev: prevMatch ? prevMatch.balance : 0 });
    });
    rows.push({ label: 'Total Cost of Sales', curr: totalCostOfSalesCurr, prev: totalCostOfSalesPrev, bold: true });
    rows.push({ label: 'GROSS PROFIT', curr: grossProfitCurr, prev: grossProfitPrev, bold: true });
    rows.push({ label: 'OPERATING EXPENSES', curr: 0, prev: 0, bold: true });
    operatingExpensesCurr.forEach(r => {
      const prevMatch = operatingExpensesPrev.find(p => p.account_code === r.account_code);
      rows.push({ label: `${r.account_code} - ${r.account_name}`, curr: r.balance, prev: prevMatch ? prevMatch.balance : 0 });
    });
    rows.push({ label: 'Monthly Depreciation', curr: Number(compDepCurr || 0), prev: Number(compDepPrev || 0) });
    rows.push({ label: 'Total Operating Expenses', curr: totalOperatingExpensesCurr, prev: totalOperatingExpensesPrev, bold: true });
    rows.push({ label: 'NET PROFIT/(LOSS)', curr: netProfitCurr, prev: netProfitPrev, bold: true });
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Comparative Income Statement</h3>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-semibold">Item</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{y}</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{py}</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">% Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`cf-comp-${i}-${r.label}`} className="border-b hover:bg-muted/50">
                  <td className={`p-2 ${r.bold ? 'font-semibold' : ''}`}>{r.label}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-semibold' : ''}`}>R {r.curr.toLocaleString()}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-semibold' : ''}`}>R {r.prev.toLocaleString()}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${pctClass(percentChange(r.curr, r.prev))} ${r.bold ? 'font-semibold' : ''}`}>
                    {percentChange(r.curr, r.prev).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderComparativeCashFlow = () => {
    const cfCurr = cashFlowCurrComparative || { operating_inflows: 0, operating_outflows: 0, net_cash_from_operations: 0, investing_inflows: 0, investing_outflows: 0, net_cash_from_investing: 0, financing_inflows: 0, financing_outflows: 0, net_cash_from_financing: 0, opening_cash_balance: 0, closing_cash_balance: 0, net_change_in_cash: 0 };
    const cfPrev = cashFlowPrev || { operating_inflows: 0, operating_outflows: 0, net_cash_from_operations: 0, investing_inflows: 0, investing_outflows: 0, net_cash_from_investing: 0, financing_inflows: 0, financing_outflows: 0, net_cash_from_financing: 0, opening_cash_balance: 0, closing_cash_balance: 0, net_change_in_cash: 0 };
    const y = comparativeYearA;
    const py = comparativeYearB;
    const buildLower = (tb: TrialBalanceRow[]) => tb.map(a => ({ account_id: a.account_id, account_code: String(a.account_code || ''), account_name: String(a.account_name || '').toLowerCase(), account_type: String(a.account_type || '').toLowerCase(), balance: Number(a.balance || 0) }));
    const lowerCurr = buildLower(trialBalance);
    const lowerPrev = buildLower(trialBalancePrev);
    const lowerPrevPrev = buildLower(trialBalancePrevPrev);
    const sum = (arr: any[]) => arr.reduce((s, x) => s + Number(x.balance || 0), 0);
    const revenueBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'revenue' || a.account_type === 'income'));
    const cogsBal = (arr: any[]) => sum(arr.filter(a => (String(a.account_code || '')).startsWith('50') || a.account_name.includes('cost of')));
    const opexBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'expense' && !((String(a.account_code || '')).startsWith('50') || a.account_name.includes('cost of'))).filter(a => !a.account_name.includes('vat')));
    const depAmortBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'expense' && (a.account_name.includes('depreciation') || a.account_name.includes('amortisation') || a.account_name.includes('amortization'))));
    const impairmentBal = (arr: any[]) => sum(arr.filter(a => a.account_name.includes('impairment')));
    const profitDisposalBal = (arr: any[]) => sum(arr.filter(a => (a.account_code === '9500') || (a.account_name.includes('gain on sale') || a.account_name.includes('disposal gain'))));
    const lossDisposalBal = (arr: any[]) => sum(arr.filter(a => (a.account_code === '9600') || (a.account_name.includes('loss on sale') || a.account_name.includes('disposal loss'))));
    const financeCostsBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'expense' && (a.account_name.includes('finance cost') || a.account_name.includes('interest expense'))));
    const interestIncomeBal = (arr: any[]) => sum(arr.filter(a => (a.account_type === 'revenue' || a.account_type === 'income') && a.account_name.includes('interest')));
    const fxUnrealisedBal = (arr: any[]) => sum(arr.filter(a => a.account_name.includes('unrealised') && (a.account_name.includes('foreign exchange') || a.account_name.includes('fx') || a.account_name.includes('currency'))));
    const provisionsMoveBal = (arr: any[]) => sum(arr.filter(a => (a.account_type === 'liability' || a.account_type === 'expense') && a.account_name.includes('provision')));
    const fairValueAdjBal = (arr: any[]) => sum(arr.filter(a => a.account_name.includes('fair value')));
    const otherNonCashBal = (arr: any[]) => sum(arr.filter(a => a.account_name.includes('non-cash') || a.account_name.includes('non cash')));
    const interestReceivedBal = (arr: any[]) => interestIncomeBal(arr);
    const interestPaidBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'expense' && (a.account_name.includes('interest') || a.account_name.includes('finance cost'))));
    const dividendsReceivedBal = (arr: any[]) => sum(arr.filter(a => (a.account_type === 'revenue' || a.account_type === 'income') && a.account_name.includes('dividend')));
    const dividendsPaidBal = (arr: any[]) => sum(arr.filter(a => (a.account_type === 'expense' || a.account_type === 'equity') && a.account_name.includes('dividend')));
    const taxPaidBal = (arr: any[]) => sum(arr.filter(a => (a.account_type === 'expense' || a.account_type === 'liability') && a.account_name.includes('tax') && !a.account_name.includes('vat')));
    const receivablesBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'asset' && (a.account_name.includes('receivable') || a.account_name.includes('debtors') || a.account_name.includes('accounts receivable'))).filter(a => !a.account_name.includes('vat')));
    const inventoriesBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'asset' && (a.account_name.includes('inventory') || a.account_name.includes('stock'))));
    const payablesBal = (arr: any[]) => sum(arr.filter(a => a.account_type === 'liability' && (a.account_name.includes('payable') || a.account_name.includes('creditors') || a.account_name.includes('accounts payable'))).filter(a => !a.account_name.includes('vat')).filter(a => !a.account_name.includes('loan')));
    const profitBeforeTaxCurr = revenueBal(lowerCurr) - (cogsBal(lowerCurr) > 0 ? cogsBal(lowerCurr) : fallbackCOGS) - opexBal(lowerCurr);
    const profitBeforeTaxPrev = revenueBal(lowerPrev) - (cogsBal(lowerPrev) > 0 ? cogsBal(lowerPrev) : fallbackCOGSPrev) - opexBal(lowerPrev);
    const receivablesChangeCurr = receivablesBal(lowerCurr) - receivablesBal(lowerPrev);
    const inventoriesChangeCurr = inventoriesBal(lowerCurr) - inventoriesBal(lowerPrev);
    const payablesChangeCurr = payablesBal(lowerCurr) - payablesBal(lowerPrev);
    const receivablesChangePrev = receivablesBal(lowerPrev) - receivablesBal(lowerPrevPrev);
    const inventoriesChangePrev = inventoriesBal(lowerPrev) - inventoriesBal(lowerPrevPrev);
    const payablesChangePrev = payablesBal(lowerPrev) - payablesBal(lowerPrevPrev);
    const workingCapitalCurr = -receivablesChangeCurr + -inventoriesChangeCurr + payablesChangeCurr;
    const workingCapitalPrev = -receivablesChangePrev + -inventoriesChangePrev + payablesChangePrev;
    const adjustmentsCurr = depAmortBal(lowerCurr) + impairmentBal(lowerCurr) - profitDisposalBal(lowerCurr) + lossDisposalBal(lowerCurr) + financeCostsBal(lowerCurr) - interestIncomeBal(lowerCurr) + fxUnrealisedBal(lowerCurr) + provisionsMoveBal(lowerCurr) + fairValueAdjBal(lowerCurr) + otherNonCashBal(lowerCurr);
    const adjustmentsPrev = depAmortBal(lowerPrev) + impairmentBal(lowerPrev) - profitDisposalBal(lowerPrev) + lossDisposalBal(lowerPrev) + financeCostsBal(lowerPrev) - interestIncomeBal(lowerPrev) + fxUnrealisedBal(lowerPrev) + provisionsMoveBal(lowerPrev) + fairValueAdjBal(lowerPrev) + otherNonCashBal(lowerPrev);
    const cashGeneratedCurr = profitBeforeTaxCurr + adjustmentsCurr + workingCapitalCurr;
    const cashGeneratedPrev = profitBeforeTaxPrev + adjustmentsPrev + workingCapitalPrev;
    const netOperatingCurr = cashGeneratedCurr + interestReceivedBal(lowerCurr) - Math.abs(interestPaidBal(lowerCurr)) + dividendsReceivedBal(lowerCurr) - Math.abs(dividendsPaidBal(lowerCurr)) - Math.abs(taxPaidBal(lowerCurr));
    const netOperatingPrev = cashGeneratedPrev + interestReceivedBal(lowerPrev) - Math.abs(interestPaidBal(lowerPrev)) + dividendsReceivedBal(lowerPrev) - Math.abs(dividendsPaidBal(lowerPrev)) - Math.abs(taxPaidBal(lowerPrev));
    const isLoanLiability = (a: any) => a.account_type === 'liability' && (a.account_name.includes('loan') || a.account_name.includes('borrow') || a.account_name.includes('debenture') || a.account_name.includes('note payable') || a.account_name.includes('overdraft'));
    const isShareEquity = (a: any) => a.account_type === 'equity' && (a.account_name.includes('share') || a.account_name.includes('capital') || a.account_name.includes('share premium') || a.account_name.includes('treasury'));
    const isLeaseLiability = (a: any) => a.account_type === 'liability' && a.account_name.includes('lease');
    const borrowingsCurr = sum(lowerCurr.filter(isLoanLiability));
    const borrowingsPrev = sum(lowerPrev.filter(isLoanLiability));
    const borrowingsPrevPrev = sum(lowerPrevPrev.filter(isLoanLiability));
    const borrowingsChangeCurr = borrowingsCurr - borrowingsPrev;
    const borrowingsChangePrev = borrowingsPrev - borrowingsPrevPrev;
    const proceedsBorrowingsCurr = Math.max(0, borrowingsChangeCurr);
    const repaymentBorrowingsCurr = Math.max(0, -borrowingsChangeCurr);
    const proceedsBorrowingsPrev = Math.max(0, borrowingsChangePrev);
    const repaymentBorrowingsPrev = Math.max(0, -borrowingsChangePrev);
    const sharesCurr = sum(lowerCurr.filter(isShareEquity));
    const sharesPrev = sum(lowerPrev.filter(isShareEquity));
    const sharesPrevPrev = sum(lowerPrevPrev.filter(isShareEquity));
    const sharesChangeCurr = sharesCurr - sharesPrev;
    const sharesChangePrev = sharesPrev - sharesPrevPrev;
    const proceedsSharesCurr = Math.max(0, sharesChangeCurr);
    const repurchaseSharesCurr = Math.max(0, -sharesChangeCurr);
    const proceedsSharesPrev = Math.max(0, sharesChangePrev);
    const repurchaseSharesPrev = Math.max(0, -sharesChangePrev);
    const leasesCurr = sum(lowerCurr.filter(isLeaseLiability));
    const leasesPrev = sum(lowerPrev.filter(isLeaseLiability));
    const leasesPrevPrev = sum(lowerPrevPrev.filter(isLeaseLiability));
    const leasesChangeCurr = leasesCurr - leasesPrev;
    const leasesChangePrev = leasesPrev - leasesPrevPrev;
    const leasesPaidCurr = Math.max(0, -leasesChangeCurr);
    const leasesPaidPrev = Math.max(0, -leasesChangePrev);
    const netInvestingCurr = investingProceedsCurr - (Math.abs(investingPurchasesCurr) + Math.abs(loanFinancedAcqCurr));
    const netInvestingPrev = investingProceedsPrev - (Math.abs(investingPurchasesPrev) + Math.abs(loanFinancedAcqPrev));
    const netFinancingCurr = proceedsSharesCurr + proceedsBorrowingsCurr - repurchaseSharesCurr - repaymentBorrowingsCurr - leasesPaidCurr;
    const netFinancingPrev = proceedsSharesPrev + proceedsBorrowingsPrev - repurchaseSharesPrev - repaymentBorrowingsPrev - leasesPaidPrev;
    const netChangeCurr = netOperatingCurr + netInvestingCurr + netFinancingCurr;
    const netChangePrev = netOperatingPrev + netInvestingPrev + netFinancingPrev;
    const rows: Array<{ label: string; curr: number; prev: number; bold?: boolean }> = [];
    rows.push({ label: 'CASH FLOWS FROM OPERATING ACTIVITIES', curr: 0, prev: 0, bold: true });
    rows.push({ label: 'Profit before tax', curr: profitBeforeTaxCurr, prev: profitBeforeTaxPrev });
    rows.push({ label: 'Depreciation and amortisation', curr: depAmortBal(lowerCurr), prev: depAmortBal(lowerPrev) });
    rows.push({ label: 'Impairment losses / reversals', curr: impairmentBal(lowerCurr), prev: impairmentBal(lowerPrev) });
    rows.push({ label: 'Profit on disposal of assets', curr: -Math.abs(profitDisposalBal(lowerCurr)), prev: -Math.abs(profitDisposalBal(lowerPrev)) });
    rows.push({ label: 'Loss on disposal of assets', curr: Math.abs(lossDisposalBal(lowerCurr)), prev: Math.abs(lossDisposalBal(lowerPrev)) });
    rows.push({ label: 'Finance costs', curr: financeCostsBal(lowerCurr), prev: financeCostsBal(lowerPrev) });
    rows.push({ label: 'Interest income', curr: -Math.abs(interestIncomeBal(lowerCurr)), prev: -Math.abs(interestIncomeBal(lowerPrev)) });
    rows.push({ label: 'Unrealised foreign exchange differences', curr: fxUnrealisedBal(lowerCurr), prev: fxUnrealisedBal(lowerPrev) });
    rows.push({ label: 'Movements in provisions', curr: provisionsMoveBal(lowerCurr), prev: provisionsMoveBal(lowerPrev) });
    rows.push({ label: 'Fair value adjustments', curr: fairValueAdjBal(lowerCurr), prev: fairValueAdjBal(lowerPrev) });
    rows.push({ label: 'Other non-cash items', curr: otherNonCashBal(lowerCurr), prev: otherNonCashBal(lowerPrev) });
    rows.push({ label: 'Changes in working capital:', curr: workingCapitalCurr, prev: workingCapitalPrev, bold: true });
    rows.push({ label: '(Increase)/Decrease in trade receivables', curr: -receivablesChangeCurr, prev: -receivablesChangePrev });
    rows.push({ label: '(Increase)/Decrease in inventories', curr: -inventoriesChangeCurr, prev: -inventoriesChangePrev });
    rows.push({ label: 'Increase/(Decrease) in trade payables', curr: payablesChangeCurr, prev: payablesChangePrev });
    rows.push({ label: 'Cash generated from operations', curr: cashGeneratedCurr, prev: cashGeneratedPrev, bold: true });
    rows.push({ label: 'Interest received', curr: interestReceivedBal(lowerCurr), prev: interestReceivedBal(lowerPrev) });
    rows.push({ label: 'Interest paid', curr: -Math.abs(interestPaidBal(lowerCurr)), prev: -Math.abs(interestPaidBal(lowerPrev)) });
    rows.push({ label: 'Dividends received', curr: dividendsReceivedBal(lowerCurr), prev: dividendsReceivedBal(lowerPrev) });
    rows.push({ label: 'Dividends paid', curr: -Math.abs(dividendsPaidBal(lowerCurr)), prev: -Math.abs(dividendsPaidBal(lowerPrev)) });
    rows.push({ label: 'Tax paid', curr: -Math.abs(taxPaidBal(lowerCurr)), prev: -Math.abs(taxPaidBal(lowerPrev)) });
    rows.push({ label: 'Net cash from operating activities', curr: netOperatingCurr, prev: netOperatingPrev, bold: true });
    rows.push({ label: 'CASH FLOWS FROM INVESTING ACTIVITIES', curr: 0, prev: 0, bold: true });
    rows.push({ label: 'Purchase of property, plant and equipment', curr: -(Math.abs(investingPurchasesCurr) + Math.abs(loanFinancedAcqCurr)), prev: -(Math.abs(investingPurchasesPrev) + Math.abs(loanFinancedAcqPrev)) });
    rows.push({ label: 'Proceeds from disposal of property, plant and equipment', curr: investingProceedsCurr, prev: investingProceedsPrev });
    rows.push({ label: 'Net cash from investing activities', curr: netInvestingCurr, prev: netInvestingPrev, bold: true });
    rows.push({ label: 'CASH FLOWS FROM FINANCING ACTIVITIES', curr: 0, prev: 0, bold: true });
    rows.push({ label: 'Proceeds from issue of shares', curr: proceedsSharesCurr, prev: proceedsSharesPrev });
    rows.push({ label: 'Repurchase of shares', curr: -Math.abs(repurchaseSharesCurr), prev: -Math.abs(repurchaseSharesPrev) });
    rows.push({ label: 'Proceeds from borrowings', curr: proceedsBorrowingsCurr, prev: proceedsBorrowingsPrev });
    rows.push({ label: 'Repayment of borrowings', curr: -Math.abs(repaymentBorrowingsCurr), prev: -Math.abs(repaymentBorrowingsPrev) });
    rows.push({ label: 'Lease liabilities paid (IFRS 16)', curr: -Math.abs(leasesPaidCurr), prev: -Math.abs(leasesPaidPrev) });
    rows.push({ label: 'Net cash from financing activities', curr: netFinancingCurr, prev: netFinancingPrev, bold: true });
    rows.push({ label: 'Net change in cash and cash equivalents', curr: netChangeCurr, prev: netChangePrev, bold: true });
    rows.push({ label: 'Cash and cash equivalents at beginning of period', curr: cfCurr.opening_cash_balance, prev: cfPrev.opening_cash_balance });
    rows.push({ label: 'Cash and cash equivalents at end of period', curr: cfCurr.opening_cash_balance + netChangeCurr, prev: cfPrev.opening_cash_balance + netChangePrev, bold: true });
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Comparative Cash Flow Statement</h3>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-semibold">Item</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{y}</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{py}</th>
                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">% Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`pl-comp-${i}-${r.label}`} className="border-b hover:bg-muted/50">
                  <td className={`p-2 ${r.bold ? 'font-semibold' : ''}`}>{r.label}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-semibold' : ''}`}>R {r.curr.toLocaleString()}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-semibold' : ''}`}>R {r.prev.toLocaleString()}</td>
                  <td className={`p-2 text-right border-l border-muted-foreground/20 ${pctClass(percentChange(r.curr, r.prev))} ${r.bold ? 'font-semibold' : ''}`}>
                    {percentChange(r.curr, r.prev).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderComparativeRetainedEarnings = () => {
    const y = comparativeYearA;
    const py = comparativeYearB;
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
    const sum = (arr: TrialBalanceRow[]) => arr.reduce((s, r) => s + Number(r.balance || 0), 0);

    // Calculate Net Profit for Year A
    const revenueCurr = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const expensesCurr = trialBalance.filter(r => String(r.account_type || '').toLowerCase() === 'expense');
    const costOfSalesCurr = expensesCurr.filter(r => r.account_name.toLowerCase().includes('cost of') || String(r.account_code || '').startsWith('50'));
    const operatingExpensesCurr = expensesCurr
      .filter(r => !costOfSalesCurr.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
      .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));
    
    const totalRevenueCurr = sum(revenueCurr);
    const totalCostOfSalesCurrRaw = sum(costOfSalesCurr);
    const totalCostOfSalesCurr = totalCostOfSalesCurrRaw > 0 ? totalCostOfSalesCurrRaw : fallbackCOGS;
    const grossProfitCurr = totalRevenueCurr - totalCostOfSalesCurr;
    const totalOperatingExpensesCurr = sum(operatingExpensesCurr);
    const netProfitCurr = grossProfitCurr - totalOperatingExpensesCurr;

    // Calculate Net Profit for Year B
    const revenuePrev = trialBalancePrev.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const expensesPrev = trialBalancePrev.filter(r => String(r.account_type || '').toLowerCase() === 'expense');
    const costOfSalesPrev = expensesPrev.filter(r => r.account_name.toLowerCase().includes('cost of') || String(r.account_code || '').startsWith('50'));
    const operatingExpensesPrev = expensesPrev
      .filter(r => !costOfSalesPrev.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
      .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));

    const totalRevenuePrev = sum(revenuePrev);
    const totalCostOfSalesPrevRaw = sum(costOfSalesPrev);
    const totalCostOfSalesPrev = totalCostOfSalesPrevRaw > 0 ? totalCostOfSalesPrevRaw : fallbackCOGSPrev;
    const grossProfitPrev = totalRevenuePrev - totalCostOfSalesPrev;
    const totalOperatingExpensesPrev = sum(operatingExpensesPrev);
    const netProfitPrev = grossProfitPrev - totalOperatingExpensesPrev;

    // Dividends & Drawings
    const getDividends = (tb: TrialBalanceRow[]) => tb
      .filter(r => String(r.account_type || '').toLowerCase() === 'equity' && (String(r.account_code || '') === '3500' || String(r.account_name || '').toLowerCase().includes('dividend')))
      .reduce((sum, r) => sum + Math.abs(Number(r.balance || 0)), 0);
    
    const getDrawings = (tb: TrialBalanceRow[]) => tb
      .filter(r => String(r.account_type || '').toLowerCase() === 'equity' && (String(r.account_code || '') === '3400' || String(r.account_name || '').toLowerCase().includes('drawings')))
      .reduce((sum, r) => sum + Math.abs(Number(r.balance || 0)), 0);

    const dividendsCurr = getDividends(trialBalance);
    const drawingsCurr = getDrawings(trialBalance);
    const dividendsPrev = getDividends(trialBalancePrev);
    const drawingsPrev = getDrawings(trialBalancePrev);

    // Opening Retained Earnings logic:
    // If periodMode is monthly, we use retainedOpeningYTD for current year.
    // For Previous Year in monthly mode, it's harder to get exact opening without full history.
    // However, usually: Opening = Closing (from BS) - Net Profit + Dividends + Drawings
    
    // Let's rely on Closing RE from Balance Sheet As Of end date
    const getClosingRE = (tbAsOf: TrialBalanceRow[]) => {
        const row = tbAsOf.find(r => String(r.account_type || '').toLowerCase() === 'equity' && String(r.account_name || '').toLowerCase().includes('retained earning'));
        return Number(row?.balance || 0);
    };

    const closingRECurr = getClosingRE(trialBalanceCompAsOfA);
    const closingREPrev = getClosingRE(trialBalanceCompAsOfB);

    // Back-calculate Opening RE to ensure the statement flows correctly
    const openingRECurr = closingRECurr - netProfitCurr + dividendsCurr + drawingsCurr;
    const openingREPrev = closingREPrev - netProfitPrev + dividendsPrev + drawingsPrev;

    const rows = [
        { label: 'Opening Retained Earnings', curr: openingRECurr, prev: openingREPrev },
        { label: 'Add: Net Profit/(Loss) for the period', curr: netProfitCurr, prev: netProfitPrev },
        { label: 'Less: Dividends Declared', curr: -dividendsCurr, prev: -dividendsPrev },
        { label: 'Less: Drawings', curr: -drawingsCurr, prev: -drawingsPrev },
        { label: 'Closing Retained Earnings', curr: closingRECurr, prev: closingREPrev, bold: true, borderTop: true }
    ];

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold">Comparative Statement of Changes in Equity (Retained Earnings)</h3>
            <div className="rounded-md border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/50">
                            <th className="p-2 text-left font-semibold">Item</th>
                            <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{y}</th>
                            <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{py}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={`re-comp-${i}`} className={`border-b hover:bg-muted/50 ${r.borderTop ? 'border-t-2' : ''}`}>
                                <td className={`p-2 ${r.bold ? 'font-bold' : ''}`}>{r.label}</td>
                                <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-bold' : ''}`}>{formatCurrency(r.curr)}</td>
                                <td className={`p-2 text-right border-l border-muted-foreground/20 ${r.bold ? 'font-bold' : ''}`}>{formatCurrency(r.prev)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const renderComparativeNotes = () => {
    const y = comparativeYearA;
    const py = comparativeYearB;
    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
    const sum = (arr: TrialBalanceRow[]) => arr.reduce((s, r) => s + Number(r.balance || 0), 0);
    const toLower = (s: string) => String(s || '').toLowerCase();

    // Helper to get rows for a specific year
    const getData = (tbAsOf: TrialBalanceRow[], tbMovement: TrialBalanceRow[]) => {
        const nonCurrentAssets = tbAsOf.filter(r => toLower(r.account_type) === 'asset' && parseInt(String(r.account_code || '0'), 10) >= 1500);
        const ppeItems = nonCurrentAssets.filter(r => !toLower(r.account_name).includes('accumulated') && !toLower(r.account_name).includes('intangible') && !toLower(r.account_name).includes('investment'));
        const accDepItems = nonCurrentAssets.filter(r => toLower(r.account_name).includes('accumulated'));
        
        const inventoryItems = tbAsOf.filter(r => toLower(r.account_type) === 'asset' && toLower(r.account_name).includes('inventory'));

        const tradeReceivables = tbAsOf.filter(r => toLower(r.account_type) === 'asset' && (toLower(r.account_name).includes('trade receivable') || toLower(r.account_name).includes('accounts receivable')));
        const impairment = tbAsOf.filter(r => toLower(r.account_type) === 'asset' && toLower(r.account_name).includes('impairment'));
        const otherReceivables = tbAsOf.filter(r => toLower(r.account_type) === 'asset' && !tradeReceivables.includes(r) && !inventoryItems.includes(r) && !ppeItems.includes(r) && !toLower(r.account_name).includes('bank') && !toLower(r.account_name).includes('cash') && parseInt(String(r.account_code || '0'), 10) < 1500);

        const cashItems = tbAsOf.filter(r => toLower(r.account_type) === 'asset' && (toLower(r.account_name).includes('cash') || toLower(r.account_name).includes('bank')));
        
        const tradePayables = tbAsOf.filter(r => toLower(r.account_type) === 'liability' && (toLower(r.account_name).includes('trade payable') || toLower(r.account_name).includes('accounts payable')));
        const otherPayables = tbAsOf.filter(r => toLower(r.account_type) === 'liability' && !tradePayables.includes(r) && !toLower(r.account_name).includes('tax') && !toLower(r.account_name).includes('vat'));

        const revenueItems = tbMovement.filter(r => toLower(r.account_type) === 'revenue' || toLower(r.account_type) === 'income');
        
        const cogsItems = tbMovement.filter(r => (String(r.account_code || '')).startsWith('50') || toLower(r.account_name).includes('cost of') || toLower(r.account_name).includes('purchases'));

        const expenseItems = tbMovement.filter(r => toLower(r.account_type) === 'expense' && !cogsItems.includes(r) && !toLower(r.account_name).includes('tax'));

        const taxItems = tbMovement.filter(r => toLower(r.account_type) === 'expense' && toLower(r.account_name).includes('tax'));

        const equityItems = tbAsOf.filter(r => toLower(r.account_type) === 'equity');

        return { ppeItems, accDepItems, inventoryItems, tradeReceivables, impairment, otherReceivables, cashItems, tradePayables, otherPayables, revenueItems, cogsItems, expenseItems, taxItems, equityItems };
    };

    const dataA = getData(trialBalanceCompAsOfA, trialBalance);
    const dataB = getData(trialBalanceCompAsOfB, trialBalancePrev);

    const renderTable = (title: string, itemsA: TrialBalanceRow[], itemsB: TrialBalanceRow[], totalLabel: string) => {
        const allCodes = Array.from(new Set([...itemsA.map(i => i.account_code), ...itemsB.map(i => i.account_code)]));
        const rows = allCodes.map(code => {
            const itemA = itemsA.find(i => i.account_code === code);
            const itemB = itemsB.find(i => i.account_code === code);
            const name = itemA?.account_name || itemB?.account_name || 'Unknown Account';
            const valA = itemA?.balance || 0;
            const valB = itemB?.balance || 0;
            return { code, name, valA, valB };
        }).sort((a, b) => a.code.localeCompare(b.code));

        const totalA = rows.reduce((s, r) => s + r.valA, 0);
        const totalB = rows.reduce((s, r) => s + r.valB, 0);

        return (
            <div className="space-y-4 break-inside-avoid">
                <h3 className="text-lg font-semibold">{title}</h3>
                <div className="rounded-md border">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="p-2 text-left font-semibold">Description</th>
                                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{y}</th>
                                <th className="p-2 text-right font-semibold border-l border-muted-foreground/20">{py}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.code} className="border-b hover:bg-muted/50">
                                    <td className="p-2">{row.name}</td>
                                    <td className="p-2 text-right border-l border-muted-foreground/20">{formatCurrency(Math.abs(row.valA))}</td>
                                    <td className="p-2 text-right border-l border-muted-foreground/20">{formatCurrency(Math.abs(row.valB))}</td>
                                </tr>
                            ))}
                            <tr className="bg-muted/50 font-bold">
                                <td className="p-2">{totalLabel}</td>
                                <td className="p-2 text-right border-l border-muted-foreground/20">{formatCurrency(Math.abs(totalA))}</td>
                                <td className="p-2 text-right border-l border-muted-foreground/20">{formatCurrency(Math.abs(totalB))}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 p-4 mt-8 border-t-4 border-double pt-8">
            <div className="border-b pb-4">
                <h2 className="text-2xl font-bold text-center">Notes to the Comparative Financial Statements</h2>
                <p className="text-center text-muted-foreground">Detailed breakdown for {y} and {py}</p>
            </div>

            {renderTable('1. Property, Plant & Equipment', dataA.ppeItems, dataB.ppeItems, 'Total PPE')}
            {renderTable('2. Inventory', dataA.inventoryItems, dataB.inventoryItems, 'Total Inventory')}
            {renderTable('3. Trade Receivables', dataA.tradeReceivables, dataB.tradeReceivables, 'Total Trade Receivables')}
            {renderTable('4. Cash & Cash Equivalents', dataA.cashItems, dataB.cashItems, 'Total Cash & Equivalents')}
            {renderTable('5. Trade Payables', dataA.tradePayables, dataB.tradePayables, 'Total Trade Payables')}
            {renderTable('6. Revenue', dataA.revenueItems, dataB.revenueItems, 'Total Revenue')}
            {renderTable('7. Cost of Sales', dataA.cogsItems, dataB.cogsItems, 'Total Cost of Sales')}
            {renderTable('8. Operating Expenses', dataA.expenseItems, dataB.expenseItems, 'Total Operating Expenses')}
            {renderTable('9. Taxation', dataA.taxItems, dataB.taxItems, 'Total Taxation')}
            {renderTable('10. Equity', dataA.equityItems, dataB.equityItems, 'Total Equity')}
        </div>
    );
  };

  const renderRetainedEarnings = () => {
    const dividendsDuring = trialBalance
      .filter(r => String(r.account_type || '').toLowerCase() === 'equity' && (String(r.account_code || '') === '3500' || String(r.account_name || '').toLowerCase().includes('dividend')))
      .reduce((sum, r) => sum + Math.abs(Number(r.balance || 0)), 0);
    const drawingsDuring = trialBalance
      .filter(r => String(r.account_type || '').toLowerCase() === 'equity' && (String(r.account_code || '') === '3400' || String(r.account_name || '').toLowerCase().includes('drawings')))
      .reduce((sum, r) => sum + Math.abs(Number(r.balance || 0)), 0);
    const retainedRow = trialBalanceAsOf.find(r => String(r.account_type || '').toLowerCase() === 'equity' && String(r.account_name || '').toLowerCase().includes('retained earning'));
    const opening = periodMode === 'monthly' ? retainedOpeningYTD : Number(retainedRow?.balance || 0);
    const during = netProfitPeriod;
    const closing = opening + during - dividendsDuring - drawingsDuring;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center w-full">
            <h2 className="text-2xl font-bold">Retained Earnings</h2>
            <p className="text-muted-foreground">Movement for selected period</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between py-1 px-2">
            <span>Opening Retained Earnings</span>
            <span className="font-mono">R {opening.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1 px-2">
            <span>Add: Net Profit/(Loss) for the period</span>
            <span className="font-mono">R {during.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1 px-2">
            <span>Less: Dividends Declared</span>
            <span className="font-mono">R {dividendsDuring.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1 px-2">
            <span>Less: Drawings</span>
            <span className="font-mono">R {drawingsDuring.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-2 font-semibold border-t mt-2">
            <span>Closing Retained Earnings</span>
            <span className="font-mono">R {closing.toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // GAAP Income Statement
  const renderIncomeStatement = () => {
    const revenue = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
    const costOfSales = trialBalance.filter(r => (String(r.account_code || '')).startsWith('50') || (String(r.account_name || '').toLowerCase().includes('cost of')));
    const operatingExpenses = trialBalance
      .filter(r => (String(r.account_type || '').toLowerCase() === 'expense') && !costOfSales.includes(r))
      .filter(r => !String(r.account_name || '').toLowerCase().includes('vat'))
      .filter(r => !(String(r.account_code || '') === '5600' || String(r.account_name || '').toLowerCase().includes('depreciation')));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0);
    const totalCostOfSales = costOfSales.reduce((sum, r) => sum + r.balance, 0);
    const cogsValue = totalCostOfSales > 0 ? totalCostOfSales : fallbackCOGS;
    const grossProfit = totalRevenue - cogsValue;
    const totalOperatingExpenses = operatingExpenses.reduce((sum, r) => sum + r.balance, 0);
    const totalOperatingExpensesWithDep = totalOperatingExpenses + Number(depExpensePeriod || 0);
    const netProfit = grossProfit - totalOperatingExpensesWithDep;

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
          <div className="flex justify-between py-1 px-2">
            <span>Monthly Depreciation</span>
            <span className="font-mono">(R {Number(depExpensePeriod || 0).toLocaleString()})</span>
          </div>
          <div className="flex justify-between py-2 font-semibold border-t mt-2">
            <span>Total Operating Expenses</span>
            <span className="font-mono">(R {totalOperatingExpensesWithDep.toLocaleString()})</span>
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
    const buildLower = (arr: any[]) => arr.map(a => ({ account_id: a.account_id, account_code: String(a.account_code || ''), account_name: String(a.account_name || '').toLowerCase(), account_type: String(a.account_type || '').toLowerCase(), balance: Number(a.balance || 0) }));
    const lowerPrevTB = buildLower(trialBalancePrev || []);
    const useComparativeWC = periodMode === 'annual' && lowerPrevTB.length > 0;
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
    const adjustmentsTotal = depAmort + impairmentNet - Math.abs(profitDisposal) + Math.abs(lossDisposal) + financeCosts - Math.abs(interestIncome) + fxUnrealised + provisionsMove + fairValueAdj + otherNonCash;
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
    const sharesCurr = sum(lowerTB.filter(isShareEquity));
    const sharesPrev = sum(lowerPrevTB.filter(isShareEquity));
    const sharesChange = sharesCurr - sharesPrev;
    const proceedsShares = Math.max(0, sharesChange);
    const repurchaseShares = Math.max(0, -sharesChange);
    const isLoanLiability = (a: any) => a.account_type === 'liability' && (a.account_name.includes('loan') || a.account_name.includes('borrow') || a.account_name.includes('debenture') || a.account_name.includes('note payable') || a.account_name.includes('overdraft'));
    const borrowingsCurr = sum(lowerTB.filter(isLoanLiability));
    const borrowingsPrev = sum(lowerPrevTB.filter(isLoanLiability));
    const borrowingsChange = borrowingsCurr - borrowingsPrev;
    const proceedsBorrowings = Math.max(0, borrowingsChange);
    const repaymentBorrowings = Math.max(0, -borrowingsChange);
    const isLeaseLiability = (a: any) => a.account_type === 'liability' && a.account_name.includes('lease');
    const leasesCurr = sum(lowerTB.filter(isLeaseLiability));
    const leasesPrev = sum(lowerPrevTB.filter(isLeaseLiability));
    const leasesChange = leasesCurr - leasesPrev;
    const nz = (v: number) => Math.abs(v) > 0.0001;
    const purchasePPE = Math.max(0, ppeMovement);
    const proceedsPPE = ppeDisposalProceeds;
    const purchaseIntangible = Math.max(0, intangibleMovement);
    const proceedsIntangible = Math.max(0, -intangibleMovement);
    const investmentsPurchased = Math.max(0, investmentMovement);
    const investmentsProceeds = Math.max(0, -investmentMovement);
    const loansAdvanced = Math.max(0, loansMovement);
    const loansRepaid = Math.max(0, -loansMovement);
    const leasesPaid = Math.max(0, -leasesChange);
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

    const prevTradeReceivables = lowerPrevTB.filter(isTradeReceivable);
    const prevInventories = lowerPrevTB.filter(isInventory);
    const prevOtherReceivables = lowerPrevTB.filter(isOtherReceivable);
    const prevTradePayables = lowerPrevTB.filter(isTradePayable);
    const prevOtherPayables = lowerPrevTB.filter(isOtherPayable);

    const currReceivablesSum = sum(tbTradeReceivables);
    const prevReceivablesSum = sum(prevTradeReceivables);
    const currInventoriesSum = sum(tbInventories);
    const prevInventoriesSum = sum(prevInventories);
    const currOtherReceivablesSum = sum(tbOtherReceivables);
    const prevOtherReceivablesSum = sum(prevOtherReceivables);
    const currTradePayablesSum = sum(tbTradePayables);
    const prevTradePayablesSum = sum(prevTradePayables);
    const currOtherPayablesSum = sum(tbOtherPayables);
    const prevOtherPayablesSum = sum(prevOtherPayables);

    const wcTradeReceivables = useComparativeWC ? (prevReceivablesSum - currReceivablesSum) : -currReceivablesSum;
    const wcInventories = useComparativeWC ? (prevInventoriesSum - currInventoriesSum) : -currInventoriesSum;
    const wcOtherReceivables = useComparativeWC ? (prevOtherReceivablesSum - currOtherReceivablesSum) : -currOtherReceivablesSum;
    const wcTradePayables = useComparativeWC ? (currTradePayablesSum - prevTradePayablesSum) : currTradePayablesSum;
    const wcOtherPayables = useComparativeWC ? (currOtherPayablesSum - prevOtherPayablesSum) : currOtherPayablesSum;
    const wcTotal = wcTradeReceivables + wcInventories + wcOtherReceivables + wcTradePayables + wcOtherPayables;
    const cashGeneratedOpsTotal = profitBeforeTax + adjustmentsTotal + wcTotal;
    const netOperatingDisplay = cashGeneratedOpsTotal + interestReceivedCF - Math.abs(interestPaidCF) + dividendsReceivedCF - Math.abs(dividendsPaidCF) - Math.abs(taxPaidCF);
    const netInvestingDisplay = (
      proceedsPPE + proceedsIntangible + investmentsProceeds + loansRepaid
    ) - (
      purchasePPE + purchaseIntangible + investmentsPurchased + loansAdvanced
    );
    const netFinancingDisplay = proceedsShares + proceedsBorrowings - repurchaseShares - repaymentBorrowings - leasesPaid;
    const netChangeDisplay = netOperatingDisplay + netInvestingDisplay + netFinancingDisplay;
    const adviceLines: string[] = [];
    if (netOperatingDisplay < 0) adviceLines.push(`Operating cash is negative; review pricing, collections, and cost controls.`);
    if (wcTradeReceivables < 0) adviceLines.push(`Trade receivables increased; tighten credit terms and follow up on overdue accounts.`);
    if (wcInventories < 0) adviceLines.push(`Inventories increased; assess stock turnover and purchasing cadence.`);
    if (wcTradePayables > 0) adviceLines.push(`Trade payables increased; monitor supplier terms and avoid chronic payment delays.`);
    if (netInvestingDisplay < 0) adviceLines.push(`Investing cash outflows; ensure capex has clear ROI and aligns to strategy.`);
    if (netFinancingDisplay > 0) adviceLines.push(`Financing inflows fund activities; monitor leverage and debt service capacity.`);
    if (vatNet > 0) adviceLines.push(`VAT payable position; set aside cash to meet statutory payments.`);
    if (vatNet < 0) adviceLines.push(`VAT receivable position; consider claiming refunds or offsetting.`);

    // --- RECONCILIATION & AUDIT LOGIC ---
    const actualClosingCash = sum(lowerTB.filter(a => a.account_type === 'asset' && (a.account_name.includes('cash') || a.account_name.includes('bank'))));
    const calculatedClosingCash = cf.opening_cash_balance + netChangeDisplay;
    const discrepancy = calculatedClosingCash - actualClosingCash;
    const isDiscrepancy = Math.abs(discrepancy) > 1.0;

    const actualOpeningCash = sum(lowerPrevTB.filter(r => r.account_type === 'asset' && (r.account_name.includes('cash') || r.account_name.includes('bank'))));
    const openingDiff = cf.opening_cash_balance - actualOpeningCash;
    
    // Equity / RE Check
    const reCurr = sum(lowerTB.filter(r => r.account_type === 'equity' && r.account_name.includes('retained')));
    const rePrev = sum(lowerPrevTB.filter(r => r.account_type === 'equity' && r.account_name.includes('retained')));
    const reDiff = (reCurr - rePrev) - (profitBeforeTax - Math.abs(taxPaidCF) - Math.abs(dividendsPaidCF));

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
              <div className="flex justify-between"><span>Profit before tax</span><span className="font-mono">R {formatRand(profitBeforeTax)}</span></div>
              <div className="font-semibold mt-2">Adjustments for:</div>
              {nz(depAmort) && (<div className="flex justify-between"><span>Depreciation and amortisation</span><span className="font-mono">R {formatRand(depAmort)}</span></div>)}
              {nz(impairmentNet) && (<div className="flex justify-between"><span>Impairment losses / reversals</span><span className="font-mono">R {formatRand(impairmentNet)}</span></div>)}
              {nz(profitDisposal) && (<div className="flex justify-between"><span>Profit on disposal of assets</span><span className="font-mono">(R {formatRand(Math.abs(profitDisposal))})</span></div>)}
              {nz(lossDisposal) && (<div className="flex justify-between"><span>Loss on disposal of assets</span><span className="font-mono">R {formatRand(lossDisposal)}</span></div>)}
              {nz(financeCosts) && (<div className="flex justify-between"><span>Finance costs</span><span className="font-mono">R {formatRand(financeCosts)}</span></div>)}
              {nz(interestIncome) && (<div className="flex justify-between"><span>Interest income</span><span className="font-mono">(R {formatRand(Math.abs(interestIncome))})</span></div>)}
              {nz(fxUnrealised) && (<div className="flex justify-between"><span>Unrealised foreign exchange differences</span><span className="font-mono">R {formatRand(fxUnrealised)}</span></div>)}
              {nz(provisionsMove) && (<div className="flex justify-between"><span>Movements in provisions</span><span className="font-mono">R {formatRand(provisionsMove)}</span></div>)}
              {nz(fairValueAdj) && (<div className="flex justify-between"><span>Fair value adjustments</span><span className="font-mono">R {formatRand(fairValueAdj)}</span></div>)}
              {nz(otherNonCash) && (<div className="flex justify-between"><span>Other non-cash items</span><span className="font-mono">R {formatRand(otherNonCash)}</span></div>)}
              <div className="font-semibold mt-2">Changes in working capital:</div>
              {nz(wcTradeReceivables) && (<div className="flex justify-between"><span>(Increase)/Decrease in trade receivables</span><span className="font-mono">R {formatRand(wcTradeReceivables)}</span></div>)}
              {nz(wcInventories) && (<div className="flex justify-between"><span>(Increase)/Decrease in inventories</span><span className="font-mono">R {formatRand(wcInventories)}</span></div>)}
              {nz(wcOtherReceivables) && (<div className="flex justify-between"><span>(Increase)/Decrease in other receivables</span><span className="font-mono">R {formatRand(wcOtherReceivables)}</span></div>)}
              {nz(wcTradePayables) && (<div className="flex justify-between"><span>Increase/(Decrease) in trade payables</span><span className="font-mono">R {formatRand(wcTradePayables)}</span></div>)}
              <div className="flex justify-between font-semibold"><span>Total change in working capital</span><span className="font-mono">R {formatRand(wcTotal)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Cash generated from operations</span><span className="font-mono">R {formatRand(cashGeneratedOpsTotal)}</span></div>
              {nz(interestReceivedCF) && (<div className="flex justify-between"><span>Interest received</span><span className="font-mono">R {formatRand(interestReceivedCF)}</span></div>)}
              {nz(interestPaidCF) && (<div className="flex justify-between"><span>Interest paid</span><span className="font-mono">(R {formatRand(Math.abs(interestPaidCF))})</span></div>)}
              {nz(dividendsReceivedCF) && (<div className="flex justify-between"><span>Dividends received</span><span className="font-mono">R {formatRand(dividendsReceivedCF)}</span></div>)}
              {nz(dividendsPaidCF) && (<div className="flex justify-between"><span>Dividends paid</span><span className="font-mono">(R {formatRand(Math.abs(dividendsPaidCF))})</span></div>)}
              {nz(taxPaidCF) && (<div className="flex justify-between"><span>Tax paid</span><span className="font-mono">(R {formatRand(Math.abs(taxPaidCF))})</span></div>)}
              <div className="flex justify-between py-2 text-lg font-semibold border-t"><span>Net cash from operating activities</span><span className="font-mono">R {formatRand(netOperatingDisplay)}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">CASH FLOWS FROM INVESTING ACTIVITIES</h3>
            <div className="space-y-1 pl-2">
              {nz(purchasePPE) && (<div className="flex justify-between"><span>Purchase of property, plant and equipment</span><span className="font-mono">(R {formatRand(purchasePPE)})</span></div>)}
              {nz(proceedsPPE) && (<div className="flex justify-between"><span>Proceeds from disposal of property, plant and equipment</span><span className="font-mono">R {formatRand(proceedsPPE)}</span></div>)}
              {nz(purchaseIntangible) && (<div className="flex justify-between"><span>Purchase of intangible assets</span><span className="font-mono">(R {formatRand(purchaseIntangible)})</span></div>)}
              {nz(proceedsIntangible) && (<div className="flex justify-between"><span>Proceeds from sale of intangible assets</span><span className="font-mono">R {formatRand(proceedsIntangible)}</span></div>)}
              {nz(investmentsPurchased) && (<div className="flex justify-between"><span>Investments purchased</span><span className="font-mono">(R {formatRand(investmentsPurchased)})</span></div>)}
              {nz(investmentsProceeds) && (<div className="flex justify-between"><span>Proceeds from sale/maturity of investments</span><span className="font-mono">R {formatRand(investmentsProceeds)}</span></div>)}
              {nz(loansAdvanced) && (<div className="flex justify-between"><span>Loans advanced to other parties</span><span className="font-mono">(R {formatRand(loansAdvanced)})</span></div>)}
              {nz(loansRepaid) && (<div className="flex justify-between"><span>Loans repaid to the entity</span><span className="font-mono">R {formatRand(loansRepaid)}</span></div>)}
              <div className="flex justify-between py-2 text-lg font-semibold border-t"><span>Net cash used in / from investing activities</span><span className="font-mono">R {formatRand(netInvestingDisplay)}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">CASH FLOWS FROM FINANCING ACTIVITIES</h3>
            <div className="space-y-1 pl-2">
              {nz(proceedsShares) && (<div className="flex justify-between"><span>Proceeds from issue of shares</span><span className="font-mono">R {formatRand(proceedsShares)}</span></div>)}
              {nz(repurchaseShares) && (<div className="flex justify-between"><span>Repurchase of shares</span><span className="font-mono">(R {formatRand(repurchaseShares)})</span></div>)}
              {nz(proceedsBorrowings) && (<div className="flex justify-between"><span>Proceeds from borrowings</span><span className="font-mono">R {formatRand(proceedsBorrowings)}</span></div>)}
              {nz(repaymentBorrowings) && (<div className="flex justify-between"><span>Repayment of borrowings</span><span className="font-mono">(R {formatRand(repaymentBorrowings)})</span></div>)}
              {nz(leasesPaid) && (<div className="flex justify-between"><span>Lease liabilities paid (IFRS 16)</span><span className="font-mono">(R {formatRand(leasesPaid)})</span></div>)}
              <div className="flex justify-between py-2 text-lg font-semibold border-t"><span>Net cash from / used in financing activities</span><span className="font-mono">R {formatRand(netFinancingDisplay)}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold">NET INCREASE / (DECREASE) IN CASH AND CASH EQUIVALENTS</h3>
            <div className="space-y-1 pl-2">
              <div className="flex justify-between"><span>Cash at the beginning of the period</span><span className="font-mono">R {formatRand(cf.opening_cash_balance)}</span></div>
              <div className="flex justify-between"><span>Net increase / (decrease) in cash</span><span className="font-mono">R {formatRand(netChangeDisplay)}</span></div>
              <div className="flex justify-between"><span>Effect of exchange rate changes on cash</span><span className="font-mono">R 0</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Cash and cash equivalents at end of period</span><span className="font-mono">R {formatRand(cf.opening_cash_balance + netChangeDisplay)}</span></div>
            </div>
          </div>

          {isDiscrepancy && (
             <div className="rounded-md border border-red-200 bg-red-50 p-4 mb-6">
               <div className="flex items-center gap-3">
                 <AlertTriangle className="h-5 w-5 text-red-600" />
                 <div className="flex-1">
                   <h4 className="font-semibold text-red-900">Reconciliation Discrepancy Detected</h4>
                   <p className="text-sm text-red-700 mt-1">
                     The calculated closing cash balance (R {formatRand(calculatedClosingCash)}) does not match the actual bank balance (R {formatRand(actualClosingCash)}).
                     Difference: R {formatRand(discrepancy)}
                   </p>
                 </div>
                 <Button 
                   variant="destructive" 
                   size="sm"
                   onClick={() => {
                     setAuditDiscrepancy(discrepancy);
                     setShowCashFlowAudit(true);
                   }}
                 >
                   Audit This
                 </Button>
               </div>
             </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xl font-bold">Advisory Insights</h3>
            <div className="space-y-1 pl-2">
              <StellaAdvisor />
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowAdviceModal(true)}>Ask Accounting Expert</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Modal */}
        <Dialog open={showCashFlowAudit} onOpenChange={setShowCashFlowAudit}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <Activity className="h-5 w-5" />
                Cash Flow Audit Report
              </DialogTitle>
              <DialogDescription>
                Analysis of the difference between Cash Flow Statement and Balance Sheet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Discrepancy Amount:</span>
                  <span className="text-red-600">R {formatRand(auditDiscrepancy)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  A positive amount means the Cash Flow Statement shows more cash than the Balance Sheet.
                </p>
              </div>

              <h4 className="font-semibold border-b pb-1">Potential Causes Found:</h4>
              <ul className="space-y-3 text-sm">
                {Math.abs(openingDiff) > 1 && (
                  <li className="flex items-start gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Opening Balance Mismatch:</span>
                      <p>The opening cash balance in Cash Flow (R {formatRand(cf.opening_cash_balance)}) differs from the previous period's closing cash (R {formatRand(actualOpeningCash)}). Difference: R {formatRand(openingDiff)}.</p>
                    </div>
                  </li>
                )}
                
                {Math.abs(reDiff) > 1 && (
                  <li className="flex items-start gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Unexplained Equity Movements:</span>
                      <p>Retained Earnings changed by an amount not explained by Profit and Dividends. Check for manual journal entries to Equity accounts. Unexplained movement: R {formatRand(reDiff)}.</p>
                    </div>
                  </li>
                )}

                {/* Heuristics for common missing non-cash items */}
                {Math.abs(discrepancy) > 0 && (
                  <li className="flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <span className="font-semibold">Review Non-Cash Adjustments:</span>
                      <p>Ensure all depreciation, amortization, and unrealized FX gains/losses are added back in Operating Activities.</p>
                    </div>
                  </li>
                )}
                
                {Math.abs(discrepancy) > 0 && (
                  <li className="flex items-start gap-2">
                     <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      <span className="font-semibold">Check Asset Disposals:</span>
                      <p>Verify that proceeds from sales of assets are recorded in Investing Activities and the Profit/Loss on disposal is adjusted in Operating Activities.</p>
                    </div>
                  </li>
                )}
              </ul>
              
              <div className="pt-4 border-t flex justify-end">
                <Button variant="outline" onClick={() => setShowCashFlowAudit(false)}>Close Audit</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };



  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">GAAP Financial Statements</h1>
            <p className="text-muted-foreground">Annual Financial Statements with drill-down</p>
          </div>
          <div className="flex items-center gap-3 bg-background p-1.5 rounded-xl border shadow-sm">
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => setShowFilters(v => !v)}
               className={`h-9 px-4 gap-2 rounded-lg transition-all ${showFilters ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
             >
               <Filter className="h-4 w-4" />
               Filters
             </Button>
             <div className="h-6 w-px bg-border" />
             <Button 
               onClick={handleRefresh} 
               disabled={loading}
               size="sm"
               className="h-9 px-4 gap-2 rounded-lg shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
             >
               <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
               {loading ? `Loading ${loadingProgress}%` : 'Refresh Data'}
             </Button>
          </div>
        </div>

      {showFilters && (
      <div className="animate-in fade-in slide-in-from-top-4 duration-300">
        <Card className="border shadow-sm bg-muted/10">
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-3 items-end">
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report Mode</Label>
                <div className="flex p-1 bg-background border rounded-lg shadow-sm">
                  <Button 
                    variant={periodMode === 'monthly' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setPeriodMode('monthly')}
                    className="flex-1 rounded-md text-sm font-medium transition-all"
                  >
                    Monthly
                  </Button>
                  <Button 
                    variant={periodMode === 'annual' ? 'secondary' : 'ghost'} 
                    size="sm" 
                    onClick={() => setPeriodMode('annual')}
                    className="flex-1 rounded-md text-sm font-medium transition-all"
                  >
                    Annual
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {periodMode === 'monthly' ? 'Select Period' : 'Fiscal Year'}
                </Label>
                {periodMode === 'monthly' ? (
                  <Input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-background border-muted-foreground/20 focus:border-primary h-10" 
                  />
                ) : (
                  <div className="relative">
                    {lockFiscalYear ? (
                      <div className="h-10 pl-10 flex items-center bg-muted/40 rounded-md border border-muted-foreground/20">
                        <span className="text-sm">{(fyStart || fiscalStartMonth) === 1 ? (defaultFiscalYear || selectedFiscalYear) : `FY ${(defaultFiscalYear || selectedFiscalYear)}`}</span>
                      </div>
                    ) : (
                      (() => {
                        const years = Array.from({ length: 7 }, (_, i) => (selectedFiscalYear || new Date().getFullYear()) - 3 + i);
                        return (
                          <Select value={String(selectedYear)} onValueChange={(val: string) => { const y = parseInt(val, 10); setSelectedYear(y); setSelectedFiscalYear(y); }}>
                            <SelectTrigger className="h-10 pl-10 bg-background border-muted-foreground/20 focus:border-primary">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {years.map(y => (
                                <SelectItem key={y} value={String(y)}>
                                  {(fyStart || fiscalStartMonth) === 1 ? y : `FY ${y}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()
                    )}
                    <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                 <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Effective Date Range</Label>
                 <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background p-2.5 rounded-lg border border-muted-foreground/20">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{periodStart}</span>
                    <ArrowLeftRight className="h-3 w-3 mx-1" />
                    <span>{periodEnd}</span>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b pb-px overflow-x-auto">
          <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 rounded-none">
            <TabsTrigger value="balance-sheet" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Statement of Financial Position
            </TabsTrigger>
            <TabsTrigger value="income" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Income Statement
            </TabsTrigger>
            <TabsTrigger value="cash-flow" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Cash Flow Statement
            </TabsTrigger>
            <TabsTrigger value="comparative" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <History className="h-4 w-4" />
              Comparative
            </TabsTrigger>
            <TabsTrigger value="retained-earnings" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Retained Earnings
            </TabsTrigger>
            <TabsTrigger value="ppe" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <FileText className="h-4 w-4" />
              PPE Schedule
            </TabsTrigger>
            <TabsTrigger value="monthly-report" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Monthly Report
            </TabsTrigger>
            <TabsTrigger value="ifrs-notes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-3 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes to Financial Statements (IFRS)
            </TabsTrigger>
          </TabsList>
        </div>

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
      <TabsContent value="comparative">
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 items-end">
                      <div>
                        <Label htmlFor="compYearA">Year A</Label>
                        <Input id="compYearA" type="number" min={1900} max={2100} value={comparativeYearA} onChange={e => setComparativeYearA(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))} />
                      </div>
                      <div>
                        <Label htmlFor="compYearB">Year B</Label>
                        <Input id="compYearB" type="number" min={1900} max={2100} value={comparativeYearB} onChange={e => setComparativeYearB(parseInt(e.target.value || `${new Date().getFullYear()-1}`, 10))} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleComparativeExport('pdf')}>
                        <FileDown className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleComparativeExport('excel')}>
                        <Download className="h-4 w-4 mr-2" />
                        Excel
                      </Button>
                    </div>
                  </div>
                  {periodMode === 'monthly' && (
                    <div className="mt-6">
                      <h3 className="text-xl font-bold border-b-2 pb-2">Retained Earnings Movement</h3>
                      <div className="pl-4 space-y-1">
                        {(() => {
                          const dividendsDuring = trialBalance
                            .filter(r => String(r.account_type || '').toLowerCase() === 'equity' && (String(r.account_code || '') === '3500' || String(r.account_name || '').toLowerCase().includes('dividend')))
                            .reduce((sum, r) => sum + Math.abs(Number(r.balance || 0)), 0);
                          const drawingsDuring = trialBalance
                            .filter(r => String(r.account_type || '').toLowerCase() === 'equity' && (String(r.account_code || '') === '3400' || String(r.account_name || '').toLowerCase().includes('drawings')))
                            .reduce((sum, r) => sum + Math.abs(Number(r.balance || 0)), 0);
                          const opening = retainedOpeningYTD;
                          const during = netProfitPeriod;
                          const closing = opening + during - dividendsDuring - drawingsDuring;
                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between py-1 px-2">
                                <span>Opening Retained Earnings</span>
                                <span className="font-mono">R {opening.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between py-1 px-2">
                                <span>Add: Net Profit/(Loss) for the period</span>
                                <span className="font-mono">R {during.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between py-1 px-2">
                                <span>Less: Dividends Declared</span>
                                <span className="font-mono">R {dividendsDuring.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between py-1 px-2">
                                <span>Less: Drawings</span>
                                <span className="font-mono">R {drawingsDuring.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between py-2 font-semibold border-t mt-2">
                                <span>Closing Retained Earnings</span>
                                <span className="font-mono">R {closing.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {renderComparativeBalanceSheet()}
                  {renderComparativeIncomeStatement()}
                  {renderComparativeRetainedEarnings()}
                  {renderComparativeCashFlow()}
                  {renderComparativeNotes()}
                  </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ppe">
          <PPEStatement selectedYear={selectedYear} />
        </TabsContent>
        <TabsContent value="monthly-report">
          <Card>
            <CardContent className="pt-6">
              {monthlyAFSError ? (
                <div className="text-red-600 dark:text-red-400 text-sm">{monthlyAFSError}</div>
              ) : monthlyAFSData.length === 0 ? (
                <div className="text-sm text-muted-foreground">No monthly data loaded</div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold mb-2">Statement of Financial Position</h3>
                    <div className="overflow-x-auto rounded-lg border border-muted-foreground/20">
                      <table className="min-w-[1100px] w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-20 bg-background">
                          <tr>
                            <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-20 text-xs uppercase tracking-wide text-muted-foreground">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`bs-h-${m.label}`} className={`text-right px-3 py-2 border-b text-xs uppercase tracking-wide text-muted-foreground ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Fixed Assets (PPE) */}
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Fixed Assets (PPE)</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-nca-h-${m.label}-${i}`} className={`px-3 py-2 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.nonCurrentAssetsItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-nca-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.nonCurrentAssetsItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-nca-${lab}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {/* Removed explicit Total Fixed Assets (NBV) row to avoid confusion.
                              Carrying value is shown via PPE (NBV) line items above. */}

                          {/* Long-term Investments */}
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Long-term Investments</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-lti-h-${m.label}-${i}`} className={`px-3 py-2 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.longTermInvestmentItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-lti-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.longTermInvestmentItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-lti-${lab}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Long-term Investments', get: (m: any) => m.bs.totalLongTermInvestments },
                            { key: 'Total Non-current Assets', get: (m: any) => {
                              const ppeNbv = (m.bsDetail?.nonCurrentAssetsItems || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
                              return ppeNbv + Number(m.bs.totalLongTermInvestments || 0);
                            } },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Current Assets */}
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Current Assets</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-ca-h-${m.label}-${i}`} className={`px-3 py-2 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.currentAssetsItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-ca-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.currentAssetsItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-ca-${lab}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Current Assets', get: (m: any) => (m.bsDetail?.currentAssetsItems || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'TOTAL ASSETS', get: (m: any) => {
                              const curr = (m.bsDetail?.currentAssetsItems || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
                              const ppeNbv = (m.bsDetail?.nonCurrentAssetsItems || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
                              const lti = (m.bsDetail?.longTermInvestmentItems || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
                              return curr + ppeNbv + lti;
                            }, bold: true, color: 'text-emerald-700 bg-emerald-50/50' },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className={`border-b odd:bg-muted/40 ${row.bold ? 'font-bold ' + (row.color || '') : ''}`}>
                              <td className={`px-3 py-2 sticky left-0 bg-background z-10 ${row.bold ? 'font-bold ' + (row.color || '') : ''}`}>{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Non-current Liabilities */}
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Non-current Liabilities</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-ncl-h-${m.label}-${i}`} className={`px-3 py-2 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.nonCurrentLiabilitiesItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-ncl-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.nonCurrentLiabilitiesItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-ncl-${lab}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Non-current Liabilities', get: (m: any) => m.bs.totalNonCurrentLiabilities },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Current Liabilities */}
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Current Liabilities</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-cl-h-${m.label}-${i}`} className={`px-3 py-2 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.currentLiabilitiesItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-cl-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.currentLiabilitiesItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-cl-${lab}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Current Liabilities', get: (m: any) => m.bs.totalCurrentLiabilities },
                            { key: 'Total Liabilities', get: (m: any) => m.bs.totalLiabilities },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="px-3 py-2 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Equity */}
                          <tr className="bg-muted/30">
                            <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Equity</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-eq-h-${m.label}-${i}`} className={`px-3 py-2 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.equityItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-eq-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-2 sticky left-0 bg-background z-10">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.equityItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-eq-${lab}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Equity', get: (m: any) => m.bs.totalEquity },
                            { key: 'TOTAL LIABILITIES & EQUITY', get: (m: any) => m.bs.totalLiabilities + m.bs.totalEquity, bold: true, color: 'text-purple-700 bg-purple-50/50' },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className={`border-b odd:bg-muted/40 ${row.bold ? 'font-bold ' + (row.color || '') : ''}`}>
                              <td className={`px-3 py-2 sticky left-0 bg-background z-10 ${row.bold ? 'font-bold ' + (row.color || '') : ''}`}>{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`px-3 py-2 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}

                          {/* Balance Check */}
                          <tr className="bg-muted/30">
                             <td className="px-3 py-2 font-semibold sticky left-0 bg-background z-10">Balance Check</td>
                             {monthlyAFSData.map((m: any, i: number) => {
                                 const diff = m.bs.totalAssets - (m.bs.totalLiabilities + m.bs.totalEquity);
                                 const isBalanced = Math.abs(diff) < 0.1;
                                 return (
                                     <td key={`bs-check-${m.label}`} className={`px-3 py-2 text-right ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>
                                         {isBalanced ? (
                                             <CheckCircle2 className="h-4 w-4 text-emerald-500 inline-block" />
                                         ) : (
                                             <Dialog>
                                                 <DialogTrigger asChild>
                                                     <Button variant="ghost" size="sm" className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 font-mono text-xs">
                                                         <AlertTriangle className="h-3 w-3 mr-1" />
                                                         {diff.toFixed(2)}
                                                     </Button>
                                                 </DialogTrigger>
                                                 <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                                     <DialogHeader>
                                                         <DialogTitle>Balance Sheet Audit - {m.label}</DialogTitle>
                                                         <DialogDescription>
                                                             Detailed analysis of the imbalance (Assets - Liab - Equity = {diff.toFixed(2)})
                                                         </DialogDescription>
                                                     </DialogHeader>
                                                     <div className="space-y-6">
                                                         <div className="grid grid-cols-2 gap-4">
                                                             <Card>
                                                                 <CardHeader className="py-2"><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
                                                                 <CardContent className="py-2 text-sm">
                                                                     <div className="flex justify-between"><span>Total Assets:</span><span className="font-mono">{formatAccounting(m.bs.totalAssets).display}</span></div>
                                                                     <div className="flex justify-between"><span>Total Liabilities:</span><span className="font-mono">{formatAccounting(m.bs.totalLiabilities).display}</span></div>
                                                                     <div className="flex justify-between"><span>Total Equity:</span><span className="font-mono">{formatAccounting(m.bs.totalEquity).display}</span></div>
                                                                     <div className="flex justify-between font-bold border-t mt-2 pt-1"><span>Difference:</span><span className="text-red-600 font-mono">{diff.toFixed(2)}</span></div>
                                                                 </CardContent>
                                                             </Card>
                                                             <Card>
                                                                 <CardHeader className="py-2"><CardTitle className="text-sm">Data Integrity Check</CardTitle></CardHeader>
                                                                 <CardContent className="py-2 text-sm">
                                                                     <div className="flex justify-between">
                                                                         <span>Trial Balance Net Sum:</span>
                                                                         <span className={`font-mono ${Math.abs(m.audit?.tbBalance || 0) > 0.01 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                                             {(m.audit?.tbBalance || 0).toFixed(2)}
                                                                         </span>
                                                                     </div>
                                                                     <p className="text-xs text-muted-foreground mt-2">
                                                                         * If this is not zero, the database entries for this period are not balanced (Credits != Debits).
                                                                     </p>
                                                                 </CardContent>
                                                             </Card>
                                                         </div>

                                                         {m.audit?.unmappedAccounts && m.audit.unmappedAccounts.length > 0 && (
                                                             <div>
                                                                 <h4 className="font-semibold text-red-600 mb-2 flex items-center">
                                                                     <AlertTriangle className="h-4 w-4 mr-2" />
                                                                     Unmapped Accounts (Missing from Report)
                                                                 </h4>
                                                                 <ScrollArea className="h-[200px] border rounded-md">
                                                                     <Table>
                                                                         <TableHeader>
                                                                             <TableRow>
                                                                                 <TableHead>Code</TableHead>
                                                                                 <TableHead>Account</TableHead>
                                                                                 <TableHead>Type</TableHead>
                                                                                 <TableHead className="text-right">Balance</TableHead>
                                                                             </TableRow>
                                                                         </TableHeader>
                                                                         <TableBody>
                                                                             {m.audit.unmappedAccounts.map((acc: any) => (
                                                                                 <TableRow key={acc.code}>
                                                                                     <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                                                                                     <TableCell>{acc.name}</TableCell>
                                                                                     <TableCell className="text-xs uppercase">{acc.type}</TableCell>
                                                                                     <TableCell className="text-right font-mono text-xs">{acc.balance.toFixed(2)}</TableCell>
                                                                                 </TableRow>
                                                                             ))}
                                                                         </TableBody>
                                                                     </Table>
                                                                 </ScrollArea>
                                                             </div>
                                                         )}

                                                         <div>
                                                             <h4 className="font-semibold mb-2">Retained Earnings Logic</h4>
                                                             <div className="bg-muted p-4 rounded-md text-sm font-mono space-y-1">
                                                                 <div className="flex justify-between"><span>YTD Revenue:</span><span>{formatAccounting(m.audit?.retainedEarningsCalcs?.ytdRevenue).display}</span></div>
                                                                 <div className="flex justify-between"><span>YTD Expenses:</span><span>{formatAccounting(m.audit?.retainedEarningsCalcs?.ytdExpenses).display}</span></div>
                                                                 <div className="flex justify-between border-t pt-1"><span>= YTD Net Profit:</span><span>{formatAccounting(m.audit?.retainedEarningsCalcs?.ytdNetProfit).display}</span></div>
                                                                 <div className="flex justify-between"><span>+ Opening Retained:</span><span>{formatAccounting(m.audit?.retainedEarningsCalcs?.retainedOpeningYTD).display}</span></div>
                                                             </div>
                                                         </div>
                                                     </div>
                                                 </DialogContent>
                                             </Dialog>
                                         )}
                                     </td>
                                 );
                             })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold mb-2">Income Statement</h3>
                    <div className="overflow-x-auto rounded-lg border border-muted-foreground/20">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-20 bg-background">
                          <tr>
                            <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-20 text-xs uppercase tracking-wide text-muted-foreground border-r">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`pl-h-${m.label}`} className={`text-right px-3 py-2 border-b text-xs uppercase tracking-wide text-muted-foreground ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Revenue</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`pl-rev-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.plDetail?.revenueItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`pl-rev-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-1 sticky left-0 bg-background z-10 border-r">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.plDetail?.revenueItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`pl-rev-${lab}-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Revenue', get: (m: any) => m.pl.revenue },
                          ].map((row) => (
                            <tr key={`pl-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`pl-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Cost of Sales</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`pl-cogs-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.plDetail?.cogsItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`pl-cogs-${lab}`} className="border-b hover:bg-muted/20">
                                <td className="px-3 py-1 sticky left-0 bg-background z-10 border-r">
                                  <div className="flex items-center justify-between">
                                    <span>{lab}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                                      <Star className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.plDetail?.cogsItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`pl-cogs-${lab}-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'GROSS PROFIT', get: (m: any) => m.pl.grossProfit },
                          ].map((row) => (
                            <tr key={`pl-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`pl-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Operating Expenses</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`pl-opex-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
          {(() => {
            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.plDetail?.opexItems || []).map((i: any) => i.label))));
            const rows = labels.map((lab) => (
              <tr key={`pl-opex-${lab}`} className="border-b hover:bg-muted/20">
                <td className="px-3 py-1 sticky left-0 bg-background z-10 border-r">
                  <div className="flex items-center justify-between">
                    <span>{lab}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTrace(lab)}>
                      <Star className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
                {monthlyAFSData.map((m: any, i: number) => {
                  const found = (m.plDetail?.opexItems || []).find((x: any) => x.label === lab);
                  const f = formatAccounting(Number(found?.amount || 0));
                  return (<td key={`pl-opex-${lab}-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                })}
              </tr>
            ));
            return rows;
          })()}
                          {[
                            { key: 'NET PROFIT/(LOSS)', get: (m: any) => m.pl.netProfit },
                          ].map((row) => (
                            <tr key={`pl-${row.key}`} className={`border-b odd:bg-muted/40 ${row.key === 'GROSS PROFIT' ? 'font-bold text-emerald-700 bg-emerald-50/50' : ''} ${row.key === 'NET PROFIT/(LOSS)' ? 'font-bold text-purple-700 bg-purple-50/50' : ''}`}> 
                              <td className={`px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r ${row.key === 'GROSS PROFIT' ? 'font-bold text-emerald-700 bg-emerald-50/50' : ''} ${row.key === 'NET PROFIT/(LOSS)' ? 'font-bold text-purple-700 bg-purple-50/50' : ''}`}>{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`pl-${row.key}-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                      </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold mb-2">Cash Flow Statement</h3>
                    <div className="overflow-x-auto rounded-lg border border-muted-foreground/20">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-20 bg-background">
                          <tr>
                            <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-20 text-xs uppercase tracking-wide text-muted-foreground border-r">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`cf-h-${m.label}`} className={`text-right px-3 py-2 border-b text-xs uppercase tracking-wide text-muted-foreground ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { key: 'Net cash from operating activities', get: (m: any) => m.cf.netOperating },
                            { key: 'Net cash from investing activities', get: (m: any) => m.cf.netInvesting },
                            { key: 'Net cash from financing activities', get: (m: any) => m.cf.netFinancing },
                            { key: 'Net change in cash', get: (m: any) => m.cf.netChange },
                            { key: 'Opening cash balance', get: (m: any) => m.cf.opening },
                            { key: 'Closing cash balance', get: (m: any) => m.cf.closing },
                          ].map((row) => (
                            <tr key={`cf-${row.key}`} className="border-b hover:bg-muted/20 odd:bg-muted/40">
                              <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`cf-${row.key}-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold mb-2">Retained Earnings Movement</h3>
                    <div className="overflow-x-auto rounded-lg border border-muted-foreground/20">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-20 bg-background">
                          <tr>
                            <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-20 text-xs uppercase tracking-wide text-muted-foreground border-r">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`re-h-${m.label}`} className={`text-right px-3 py-2 border-b text-xs uppercase tracking-wide text-muted-foreground ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const closings = monthlyAFSData.map((m: any) => {
                              const re = (m.bsDetail?.equityItems || []).find((x: any) => String(x.label || '').toLowerCase().includes('retained earning'));
                              return Number(re?.amount || 0);
                            });
                            return (
                              <>
                                <tr className="border-b hover:bg-muted/20 odd:bg-muted/40">
                                  <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Opening Retained Earnings</td>
                                  {monthlyAFSData.map((m: any, i: number) => {
                                    const opening = i === 0 ? Number(m.audit?.retainedEarningsCalcs?.retainedOpeningYTD || 0) : closings[i - 1];
                                    const f = formatAccounting(opening);
                                    return (<td key={`re-open-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                  })}
                                </tr>
                                <tr className="border-b hover:bg-muted/20 odd:bg-muted/40">
                                  <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Add: Net Profit/(Loss)</td>
                                  {monthlyAFSData.map((m: any, i: number) => {
                                    const f = formatAccounting(Number(m.pl?.netProfit || 0));
                                    return (<td key={`re-during-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                  })}
                                </tr>
                                <tr className="border-b hover:bg-muted/20 odd:bg-muted/40">
                                  <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Less: Distributions</td>
                                  {monthlyAFSData.map((m: any, i: number) => {
                                    const opening = i === 0 ? Number(m.audit?.retainedEarningsCalcs?.retainedOpeningYTD || 0) : closings[i - 1];
                                    const during = Number(m.pl?.netProfit || 0);
                                    const dist = opening + during - closings[i];
                                    const f = formatAccounting(dist);
                                    return (<td key={`re-dist-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                  })}
                                </tr>
                                <tr className="border-b hover:bg-muted/20 odd:bg-muted/40">
                                  <td className="px-3 py-1 font-bold sticky left-0 bg-background z-10 border-r">Closing Retained Earnings</td>
                                  {monthlyAFSData.map((m: any, i: number) => {
                                    const f = formatAccounting(closings[i]);
                                    return (<td key={`re-close-${m.label}`} className={`px-3 py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                  })}
                                </tr>
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold mb-2">Notes to Financial Statements (IFRS)</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-10 border-r text-xs uppercase tracking-wide text-muted-foreground">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`notes-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { key: 'Property, plant and equipment (NBV)', get: (m: any) => (m.bsDetail?.nonCurrentAssetsItems || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Inventory', get: (m: any) => (m.bsDetail?.currentAssetsItems || []).filter((x: any) => String(x.label || '').toLowerCase().includes('inventory')).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Trade receivables', get: (m: any) => (m.bsDetail?.currentAssetsItems || []).filter((x: any) => { const l = String(x.label || '').toLowerCase(); return l.includes('trade receivable') || l.includes('accounts receivable'); }).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Impairment of receivables', get: (m: any) => (m.bsDetail?.currentAssetsItems || []).filter((x: any) => String(x.label || '').toLowerCase().includes('impairment')).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Other receivables', get: (m: any) => (m.bsDetail?.currentAssetsItems || []).filter((x: any) => { const lab = String(x.label || '').toLowerCase(); const parts = String(x.label || '').split(' - '); const code = parseInt(String(parts[0] || '0'), 10); const isCash = lab.includes('cash') || lab.includes('bank'); const isInv = lab.includes('inventory'); const isAR = lab.includes('trade receivable') || lab.includes('accounts receivable'); return !isCash && !isInv && !isAR && (code < 1500 || isNaN(code)); }).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Cash and cash equivalents', get: (m: any) => (m.bsDetail?.currentAssetsItems || []).filter((x: any) => { const l = String(x.label || '').toLowerCase(); return l.includes('cash') || l.includes('bank'); }).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Trade payables', get: (m: any) => (m.bsDetail?.currentLiabilitiesItems || []).filter((x: any) => { const l = String(x.label || '').toLowerCase(); return l.includes('trade payable') || l.includes('accounts payable'); }).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Other payables', get: (m: any) => (m.bsDetail?.currentLiabilitiesItems || []).filter((x: any) => { const l = String(x.label || '').toLowerCase(); return !l.includes('trade payable') && !l.includes('accounts payable') && !l.includes('tax') && !l.includes('vat'); }).reduce((s: number, x: any) => s + Number(x.amount || 0), 0) },
                            { key: 'Revenue', get: (m: any) => Number(m.pl?.revenue || 0) },
                            { key: 'Cost of sales', get: (m: any) => Number(m.pl?.costOfSales || 0) },
                            { key: 'Operating expenses', get: (m: any) => Number(m.pl?.opex || 0) },
                          ].map((row) => (
                            <tr key={`notes-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`notes-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="retained-earnings">
          <Card>
            <CardContent className="pt-6">
              {renderRetainedEarnings()}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ifrs-notes">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[600px] pr-4">
                {renderIFRSNotes()}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Drill-down modal */}
      <Dialog open={!!drilldownAccount} onOpenChange={(open) => !open && setDrilldownAccount(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ledger Entries: {drilldownAccount}</DialogTitle>
            <DialogDescription>
              Detailed transactions for the selected period
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {ledgerEntries.length === 0 ? (
               <div className="text-center py-8 text-muted-foreground">
                 No transactions found for this period.
               </div>
            ) : (
              <div className="space-y-2">
                {ledgerEntries.map(entry => (
                  <div key={entry.id} className="flex justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-semibold">{entry.description}</p>
                      <p className="text-sm text-muted-foreground">{entry.entry_date} | Ref: {entry.reference_id}</p>
                    </div>
                    <div className="text-right font-mono">
                      {entry.debit > 0 && <p className="text-red-600">Dr: R {entry.debit.toLocaleString()}</p>}
                      {entry.credit > 0 && <p className="text-green-600">Cr: R {entry.credit.toLocaleString()}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Trace modal */}
      <Dialog open={!!traceLabel} onOpenChange={(open) => !open && setTraceLabel(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Trace: {traceLabel}</DialogTitle>
              {traceResolved && (
                <Button size="sm" variant="outline" onClick={() => { handleDrilldown(String(traceResolved.account_id), `${traceResolved.account_code} - ${traceResolved.account_name}`); setTraceLabel(null); }}>
                  Open Ledger Entries
                </Button>
              )}
            </div>
            <DialogDescription>
              Monthly impact across Balance Sheet and Income Statement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Card>
              <CardHeader className="py-2"><CardTitle className="text-sm">Balance Sheet</CardTitle></CardHeader>
              <CardContent className="py-2">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-10 border-r">Section</th>
                        {monthlyAFSData.map((m: any, i: number) => (
                          <th key={`trace-bs-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'Non-current Assets', get: (m: any) => {
                          const found = (m.bsDetail?.nonCurrentAssetsItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                        { key: 'Current Assets', get: (m: any) => {
                          const found = (m.bsDetail?.currentAssetsItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                        { key: 'Non-current Liabilities', get: (m: any) => {
                          const found = (m.bsDetail?.nonCurrentLiabilitiesItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                        { key: 'Current Liabilities', get: (m: any) => {
                          const found = (m.bsDetail?.currentLiabilitiesItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                        { key: 'Equity', get: (m: any) => {
                          const found = (m.bsDetail?.equityItems || []).find((x: any) => x.label === traceLabel || String(x.label || '').toLowerCase().includes('retained earning'));
                          return Number(found?.amount || 0);
                        }},
                      ].map((row) => (
                        <tr key={`trace-bs-${row.key}`} className="border-b odd:bg-muted/40">
                          <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                          {monthlyAFSData.map((m: any, i: number) => {
                            const f = formatAccounting(row.get(m));
                            return (
                              <td key={`trace-bs-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2"><CardTitle className="text-sm">Income Statement</CardTitle></CardHeader>
              <CardContent className="py-2">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-10 border-r">Section</th>
                        {monthlyAFSData.map((m: any, i: number) => (
                          <th key={`trace-pl-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'Revenue', get: (m: any) => {
                          const found = (m.plDetail?.revenueItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                        { key: 'Cost of sales', get: (m: any) => {
                          const found = (m.plDetail?.cogsItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                        { key: 'Operating expenses', get: (m: any) => {
                          const found = (m.plDetail?.opexItems || []).find((x: any) => x.label === traceLabel);
                          return Number(found?.amount || 0);
                        }},
                      ].map((row) => (
                        <tr key={`trace-pl-${row.key}`} className="border-b odd:bg-muted/40">
                          <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                          {monthlyAFSData.map((m: any, i: number) => {
                            const f = formatAccounting(row.get(m));
                            return (
                              <td key={`trace-pl-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-2"><CardTitle className="text-sm">Cash Flow</CardTitle></CardHeader>
              <CardContent className="py-2">
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 border-b sticky left-0 bg-background z-10 border-r">Section</th>
                        {monthlyAFSData.map((m: any, i: number) => (
                          <th key={`trace-cf-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'Net cash from operating activities', get: (m: any) => m.cf.netOperating },
                        { key: 'Net cash from investing activities', get: (m: any) => m.cf.netInvesting },
                        { key: 'Net cash from financing activities', get: (m: any) => m.cf.netFinancing },
                        { key: 'Net change in cash', get: (m: any) => m.cf.netChange },
                      ].map((row) => (
                        <tr key={`trace-cf-${row.key}`} className="border-b odd:bg-muted/40">
                          <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">{row.key}</td>
                          {monthlyAFSData.map((m: any, i: number) => {
                            const f = formatAccounting(row.get(m));
                            return (
                              <td key={`trace-cf-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="border-b odd:bg-muted/40">
                        <td className="px-3 py-1 font-medium sticky left-0 bg-background z-10 border-r">Account net movement (Dr - Cr)</td>
                        {monthlyAFSData.map((m: any, i: number) => {
                          const val = traceCFMonthly ? Number(traceCFMonthly[m.label] || 0) : 0;
                          const f = formatAccounting(val);
                          return (
                            <td key={`trace-cf-net-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>
                              {traceCFLoading && !traceCFMonthly ? '…' : f.display}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {showAdviceModal && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Expert Guidance</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAdviceModal(false)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm whitespace-pre-wrap">{systemOverview}</div>
              <div className="text-sm whitespace-pre-wrap">{accountingPrimer}</div>
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

// Calculate inventory value as-of a cutoff date using product catalog and date-aware movements
const calculateInventoryValueAsOf = async (companyId: string, end: string) => {
  try {
    const endDateObj = new Date(end);
    endDateObj.setHours(23, 59, 59, 999);
    const endISO = endDateObj.toISOString();

    const { data: products } = await supabase
      .from('items')
      .select('id, name, cost_price, quantity_on_hand')
      .eq('company_id', companyId)
      .eq('item_type', 'product');

    const catalog = (products || []).map((p: any) => ({
      id: String(p.id),
      name: String(p.name || '').toLowerCase().trim(),
      cost: Number(p.cost_price || 0),
      currentQty: Number(p.quantity_on_hand || 0)
    }));
    const nameList = catalog.map(c => c.name);

    const { data: invItemsAfter } = await supabase
      .from('invoice_items')
      .select(`
        description,
        quantity,
        item_type,
        invoices!inner (
          invoice_date,
          company_id,
          status
        )
      `)
      .eq('invoices.company_id', companyId)
      .gt('invoices.invoice_date', endISO);

    const salesAfter = (invItemsAfter || []).filter((it: any) => String(it.item_type || '').toLowerCase() === 'product');
    const saleQtyByName = new Map<string, number>();
    salesAfter.forEach((it: any) => {
      const desc = String(it.description || '').toLowerCase().trim();
      const qty = Number(it.quantity || 0);
      const key = nameList.find(n => n === desc) || nameList.find(n => desc.includes(n) || n.includes(desc)) || desc;
      saleQtyByName.set(key, (saleQtyByName.get(key) || 0) + qty);
    });

    const { data: poItemsAfter } = await supabase
      .from('purchase_order_items')
      .select(`
        description,
        quantity,
        unit_price,
        purchase_orders!inner (
          po_date,
          status,
          company_id
        )
      `)
      .eq('purchase_orders.company_id', companyId)
      .in('purchase_orders.status', ['sent','paid'])
      .gt('purchase_orders.po_date', endISO);

    const purchaseQtyByName = new Map<string, number>();
    (poItemsAfter || []).forEach((it: any) => {
      const desc = String(it.description || '').toLowerCase().trim();
      const qty = Number(it.quantity || 0);
      const key = nameList.find(n => n === desc) || nameList.find(n => desc.includes(n) || n.includes(desc)) || desc;
      purchaseQtyByName.set(key, (purchaseQtyByName.get(key) || 0) + qty);
    });

    let totalValue = 0;
    catalog.forEach((prod) => {
      const purchasesAfter = Number(purchaseQtyByName.get(prod.name) || 0);
      const salesAfterQty = Number(saleQtyByName.get(prod.name) || 0);
      const qtyAsOf = Math.max(0, prod.currentQty - purchasesAfter + salesAfterQty);
      totalValue += qtyAsOf * prod.cost;
    });

    return totalValue;
  } catch (error) {
    console.error('Error calculating inventory value as-of date:', error);
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
      description,
      transactions!inner (
        transaction_date,
        status,
        company_id
      )
    `)
    .eq('transactions.company_id', companyId)
    .eq('transactions.status', 'posted')
    .gte('transactions.transaction_date', startISO)
    .lte('transactions.transaction_date', endISO)
    .not('description', 'ilike', '%Opening balance (carry forward)%');

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

  let apBalanceAsOf: number | undefined = undefined;
  let arBalanceAsOf: number | undefined = undefined;
  let loanShortAsOf: number | undefined = undefined;
  let loanLongAsOf: number | undefined = undefined;
  try {
    const asOfTB = await fetchTrialBalanceAsOf(companyId, end);
    const apRow = (asOfTB || []).find((r: any) => String(r.account_code || '') === '2000');
    const arRow = (asOfTB || []).find((r: any) => String(r.account_code || '') === '1200');
    const loanShortRow = (asOfTB || []).find((r: any) => String(r.account_code || '') === '2300');
    const loanLongRow = (asOfTB || []).find((r: any) => String(r.account_code || '') === '2400');
    apBalanceAsOf = apRow?.balance;
    arBalanceAsOf = arRow?.balance;
    loanShortAsOf = loanShortRow?.balance;
    loanLongAsOf = loanLongRow?.balance;
  } catch {}

  

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

    if (String(acc.account_code || '') === '2000' && typeof apBalanceAsOf === 'number') {
      balance = apBalanceAsOf;
    }
    if (String(acc.account_code || '') === '1200' && typeof arBalanceAsOf === 'number') {
      balance = arBalanceAsOf;
    }
    if (String(acc.account_code || '') === '2300' && typeof loanShortAsOf === 'number') {
      balance = loanShortAsOf;
    }
    if (String(acc.account_code || '') === '2400' && typeof loanLongAsOf === 'number') {
      balance = loanLongAsOf;
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

// Cumulative trial balance as of a given end date (used for Balance Sheet)
const fetchTrialBalanceAsOf = async (companyId: string, end: string) => {
  const endDateObj = new Date(end);
  endDateObj.setHours(23, 59, 59, 999);
  const endISO = endDateObj.toISOString();

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
        status,
        company_id
      )
    `)
    .eq('transactions.company_id', companyId)
    .eq('transactions.status', 'posted')
    .lte('transactions.transaction_date', endISO)
    .not('description', 'ilike', '%Opening balance (carry forward)%');
  if (txError) throw txError;

  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('ledger_entries')
    .select('transaction_id, account_id, debit, credit, entry_date, description')
    .eq('company_id', companyId)
    .lte('entry_date', endISO)
    .not('description', 'ilike', '%Opening balance (carry forward)%');
  if (ledgerError) throw ledgerError;

  const trialBalance: Array<{ account_id: string; account_code: string; account_name: string; account_type: string; balance: number; }> = [];

  const ledgerTxIds = new Set<string>((ledgerEntries || []).map((e: any) => String(e.transaction_id || '')));
  const filteredTxEntries = (txEntries || []).filter((e: any) => !ledgerTxIds.has(String(e.transaction_id || '')));

  const inventoryValueAsOf = await calculateInventoryValueAsOf(companyId, end);

  (accounts || []).forEach((acc: any) => {
    let sumDebit = 0;
    let sumCredit = 0;

    (filteredTxEntries || []).forEach((entry: any) => {
      if (entry.account_id === acc.id) {
        sumDebit += Number(entry.debit || 0);
        sumCredit += Number(entry.credit || 0);
      }
    });

    (ledgerEntries || []).forEach((entry: any) => {
      if (entry.account_id === acc.id) {
        sumDebit += Number(entry.debit || 0);
        sumCredit += Number(entry.credit || 0);
      }
    });

    const type = (acc.account_type || '').toLowerCase();
    const naturalDebit = type === 'asset' || type === 'expense';
    let balance = naturalDebit ? (sumDebit - sumCredit) : (sumCredit - sumDebit);

    if (false) {
      balance = inventoryValueAsOf;
    }

    const shouldShow = Math.abs(balance) > 0.01;
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

const getCashFlowForPeriod = async (companyId: string, start: string, end: string) => {
  try {
    const opening = await computeOpeningCashOnly(companyId, start);
    try {
      const { data, error } = await supabase.rpc('get_cash_flow_statement' as any, {
        _company_id: companyId,
        _period_start: start,
        _period_end: end,
      });
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        const cf = (data as any)[0];
        const nets = (
          Number(cf.net_cash_from_operations || 0) +
          Number(cf.net_cash_from_investing || 0) +
          Number(cf.net_cash_from_financing || 0)
        );
        return {
          ...cf,
          opening_cash_balance: opening,
          net_change_in_cash: nets,
          closing_cash_balance: opening + nets,
        };
      }
    } catch {}

    const { data: legacy, error: legacyErr } = await supabase.rpc('generate_cash_flow' as any, {
      _company_id: companyId,
      _period_start: start,
      _period_end: end,
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
      const nets = cf.net_cash_from_operations + cf.net_cash_from_investing + cf.net_cash_from_financing;
      const updated = { ...cf, opening_cash_balance: opening, net_change_in_cash: nets, closing_cash_balance: opening + nets };
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
        const local = await computeCashFlowFallback(companyId, start, end);
        return local;
      }
      return updated;
    } else {
      const local = await computeCashFlowFallback(companyId, start, end);
      return local;
    }
  } catch (e) {
    console.error('getCashFlowForPeriod error', e);
    return null;
  }
};
  
