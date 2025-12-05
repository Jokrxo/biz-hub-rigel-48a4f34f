import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Download, Eye, Calendar, FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { exportFinancialReportToExcel, exportFinancialReportToPDF, exportComparativeCashFlowToExcel, exportComparativeCashFlowToPDF } from "@/lib/export-utils";
import { systemOverview, accountingPrimer } from "@/components/Stella/knowledge";
import StellaAdvisor from "@/components/Stella/StellaAdvisor";

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
  useEffect(() => { if (activeTab === 'comparative') { loadComparativeData(); } }, [activeTab, comparativeYearA, comparativeYearB]);
  useEffect(() => {
    if (periodMode === 'annual' && activeTab === 'cash-flow') {
      loadComparativeData();
    }
  }, [activeTab, periodMode, selectedYear]);
  useEffect(() => { if (activeTab === 'monthly-report') { loadMonthlyAFS(); } }, [activeTab, selectedYear]);

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
      ) && !toLower(r.account_name).includes('vat') && !['1210','2110','2210'].includes(String(r.account_code || ''))
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
      const totalRevPeriod = normalized.filter((r: any) => String(r.account_type || '').toLowerCase() === 'revenue' || String(r.account_type || '').toLowerCase() === 'income').reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
      const totalExpPeriod = normalized.filter((r: any) => String(r.account_type || '').toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat')).reduce((s: number, r: any) => s + Number(r.balance || 0), 0);
      setNetProfitPeriod(totalRevPeriod - totalExpPeriod);

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
        const ytdStartObj = new Date(startObj.getFullYear(), 0, 1);
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
      const ppeSum = nonCurrentAssetsAsOf.reduce((sum: number, a: any) => sum + nbvForAsOf(a), 0);
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

      // Equation validated locally based on selected period and current filters

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
      const yAStart = new Date(comparativeYearA, 0, 1).toISOString().split('T')[0];
      const yAEnd = new Date(comparativeYearA, 11, 31).toISOString().split('T')[0];
      const yBStart = new Date(comparativeYearB, 0, 1).toISOString().split('T')[0];
      const yBEnd = new Date(comparativeYearB, 11, 31).toISOString().split('T')[0];
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

  const buildMonthlyRanges = (year: number) => {
    const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return labels.map((label, idx) => {
      const start = new Date(year, idx, 1);
      const end = new Date(year, idx + 1, 0);
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

      const ranges = buildMonthlyRanges(selectedYear);
      const rows = await Promise.all(ranges.map(async (r) => {
        const [tbPeriod, tbAsOf, cogs, cf] = await Promise.all([
          fetchTrialBalanceForPeriod(companyProfile.company_id, r.start, r.end),
          fetchTrialBalanceAsOf(companyProfile.company_id, r.end),
          calculateCOGSFromInvoices(companyProfile.company_id, r.start, r.end),
          getCashFlowForPeriod(companyProfile.company_id, r.start, r.end),
        ]);
        const toLower = (s: string) => String(s || '').toLowerCase();
        const currentAssetsItems = (tbAsOf || [])
          .filter((x: any) => toLower(x.account_type) === 'asset')
          .filter((x: any) => (
            toLower(x.account_name).includes('cash') ||
            toLower(x.account_name).includes('bank') ||
            toLower(x.account_name).includes('receivable') ||
            toLower(x.account_name).includes('inventory') ||
            parseInt(String(x.account_code || '0'), 10) < 1500
          ))
          .filter((x: any) => !toLower(x.account_name).includes('vat'))
          .filter((x: any) => !['1210','2110','2210'].includes(String(x.account_code || '')))
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));
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
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));
        const equityItems = (tbAsOf || [])
          .filter((x: any) => toLower(x.account_type) === 'equity')
          .map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) }));
        const revenueRows = (tbPeriod || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'revenue' || String(x.account_type || '').toLowerCase() === 'income');
        const expenseRows = (tbPeriod || []).filter((x: any) => String(x.account_type || '').toLowerCase() === 'expense');
        const costOfSalesRows = expenseRows.filter((x: any) => String(x.account_name || '').toLowerCase().includes('cost of') || String(x.account_code || '').startsWith('50'));
        const opexRows = expenseRows.filter((x: any) => !costOfSalesRows.includes(x)).filter((x: any) => !String(x.account_name || '').toLowerCase().includes('vat'));
        const sum = (arr: any[]) => (arr || []).reduce((s, e) => s + Number(e.balance || 0), 0);
        const revenue = sum(revenueRows);
        const costOfSalesRaw = sum(costOfSalesRows);
        const costOfSales = costOfSalesRaw > 0 ? costOfSalesRaw : cogs;
        const grossProfit = revenue - costOfSales;
        const opex = sum(opexRows);
        const netProfit = grossProfit - opex;
        const bs = bsGroups(tbAsOf || []);
        return {
          label: r.label,
          bs,
          bsDetail: {
            currentAssetsItems: [...currentAssetsItems, vatReceivableItem],
            currentLiabilitiesItems: [...currentLiabilitiesItems, vatPayableItem],
            nonCurrentLiabilitiesItems,
            equityItems,
          },
          pl: { revenue, costOfSales, grossProfit, opex, netProfit },
          plDetail: {
            revenueItems: (revenueRows || []).map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) })),
            cogsItems: (costOfSalesRows || []).map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) })),
            opexItems: (opexRows || []).map((x: any) => ({ label: `${x.account_code} - ${x.account_name}`, amount: Number(x.balance || 0) })),
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
        const vatInputAsAssets = trialBalanceAsOf.filter(r =>
          (String(r.account_name || '').toLowerCase().includes('vat input') || String(r.account_name || '').toLowerCase().includes('vat receivable'))
        );
        const currentSet = new Set(currentLiabilities.map(r => r.account_id));
        const nonCurrentLiabilities = trialBalance.filter(r => r.account_type.toLowerCase() === 'liability' && !currentSet.has(r.account_id));
        const equity = trialBalance.filter(r => r.account_type.toLowerCase() === 'equity');
        const revenueRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'revenue' || r.account_type.toLowerCase() === 'income');
        const expenseRows = trialBalance.filter(r => r.account_type.toLowerCase() === 'expense' && !String(r.account_name || '').toLowerCase().includes('vat'));
        const totalRevenue = revenueRows.reduce((sum, r) => sum + r.balance, 0);
        const totalExpenses = expenseRows.reduce((sum, r) => sum + r.balance, 0);
        const netProfitForPeriod = totalRevenue - totalExpenses;
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
        const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, r) => sum + nbvFor(r), 0);
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
        const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0) + vatPayableAsOf;
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
          { account: 'Total Fixed Assets (NBV)', amount: totalNonCurrentAssets, type: 'asset' },
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
    const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, r) => sum + nbvFor(r), 0);
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
              <span>Total Fixed Assets (NBV)</span>
              <span className="font-mono">R {totalNonCurrentAssets.toLocaleString()}</span>
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
            <p className="font-semibold">
              {accountingEquation.is_valid
                ? 'Accounting equation holds for selected period'
                : `ERROR: Assets (R ${formatRand(accountingEquation.total_assets)}) ≠ Liabilities (R ${formatRand(accountingEquation.total_liabilities)}) + Equity (R ${formatRand(accountingEquation.total_equity)}) | Difference: R ${formatRand(accountingEquation.difference)}`}
            </p>
            {!accountingEquation.is_valid && (
              <p className="text-sm mt-2">Assets: R {formatRand(accountingEquation.total_assets)} | Liabilities: R {formatRand(accountingEquation.total_liabilities)} | Equity: R {formatRand(accountingEquation.total_equity)}</p>
            )}
          </div>
        )}
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
      !['1210','2110','2210'].includes(String(r.account_code || ''))
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
    const vatInputAsAssets = tb.filter(r => (String(r.account_name || '').toLowerCase().includes('vat input') || String(r.account_name || '').toLowerCase().includes('vat receivable')));
    const vatPayableRows = tb.filter(r => r.account_type.toLowerCase() === 'liability' && String(r.account_name || '').toLowerCase().includes('vat'));
    const vatReceivable = vatInputAsAssets.reduce((s, r) => s + r.balance, 0);
    const vatPayable = vatPayableRows.reduce((s, r) => s + r.balance, 0);
    const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0) + vatReceivable;
    const totalNonCurrentAssets = nonCurrentAssets.reduce((sum, r) => sum + nbvFor(r), 0);
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
    const nonCurrentLiabilities = tb.filter(r => r.account_type.toLowerCase() === 'liability' && !currentSet.has(r.account_id));
    const equity = tb.filter(r => r.account_type.toLowerCase() === 'equity');
    const totalEquity = equity.reduce((sum, r) => sum + r.balance, 0);
    const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
    const totalCurrentLiabilities = currentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalNonCurrentLiabilities = nonCurrentLiabilities.reduce((sum, r) => sum + r.balance, 0);
    const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities + vatPayable;
    return {
      totalCurrentAssets,
      totalNonCurrentAssets,
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
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div className="font-semibold">Item</div>
          <div className="font-semibold text-right">{y}</div>
          <div className="font-semibold text-right">{py}</div>
          <div className="font-semibold text-right">% Change</div>
          {rows.map((r, i) => (
            <React.Fragment key={`bs-comp-${i}-${r.label}`}>
              <div className={`${r.bold ? 'font-semibold mt-2' : ''}`}>{r.label}</div>
              <div className={`text-right ${r.bold ? 'font-semibold' : ''}`}>R {r.curr.toLocaleString()}</div>
              <div className={`text-right ${r.bold ? 'font-semibold' : ''}`}>R {r.prev.toLocaleString()}</div>
              <div className={`${pctClass(percentChange(r.curr, r.prev))} ${r.bold ? 'text-right font-semibold' : ''}`}>{percentChange(r.curr, r.prev).toFixed(1)}%</div>
            </React.Fragment>
          ))}
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
    const operatingExpensesCurr = expensesCurr.filter(r => !costOfSalesCurr.includes(r)).filter(r => !String(r.account_name || '').toLowerCase().includes('vat'));
    const operatingExpensesPrev = expensesPrev.filter(r => !costOfSalesPrev.includes(r)).filter(r => !String(r.account_name || '').toLowerCase().includes('vat'));
    const sum = (arr: TrialBalanceRow[]) => arr.reduce((s, r) => s + r.balance, 0);
    const totalRevenueCurr = sum(revenueCurr);
    const totalRevenuePrev = sum(revenuePrev);
    const totalCostOfSalesCurrRaw = sum(costOfSalesCurr);
    const totalCostOfSalesPrevRaw = sum(costOfSalesPrev);
    const totalCostOfSalesCurr = totalCostOfSalesCurrRaw > 0 ? totalCostOfSalesCurrRaw : fallbackCOGS;
    const totalCostOfSalesPrev = totalCostOfSalesPrevRaw > 0 ? totalCostOfSalesPrevRaw : fallbackCOGSPrev;
    const grossProfitCurr = totalRevenueCurr - totalCostOfSalesCurr;
    const grossProfitPrev = totalRevenuePrev - totalCostOfSalesPrev;
    const totalOperatingExpensesCurr = sum(operatingExpensesCurr);
    const totalOperatingExpensesPrev = sum(operatingExpensesPrev);
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
    rows.push({ label: 'Total Operating Expenses', curr: totalOperatingExpensesCurr, prev: totalOperatingExpensesPrev, bold: true });
    rows.push({ label: 'NET PROFIT/(LOSS)', curr: netProfitCurr, prev: netProfitPrev, bold: true });
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Comparative Income Statement</h3>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div className="font-semibold">Item</div>
          <div className="font-semibold text-right">{y}</div>
          <div className="font-semibold text-right">{py}</div>
          <div className="font-semibold text-right">% Change</div>
          {rows.map((r, i) => (
            <React.Fragment key={`cf-comp-${i}-${r.label}`}>
              <div className={`${r.bold ? 'font-semibold mt-2' : ''}`}>{r.label}</div>
              <div className={`text-right ${r.bold ? 'font-semibold' : ''}`}>R {r.curr.toLocaleString()}</div>
              <div className={`text-right ${r.bold ? 'font-semibold' : ''}`}>R {r.prev.toLocaleString()}</div>
              <div className={`${pctClass(percentChange(r.curr, r.prev))} ${r.bold ? 'text-right font-semibold' : ''}`}>{percentChange(r.curr, r.prev).toFixed(1)}%</div>
            </React.Fragment>
          ))}
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
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div className="font-semibold">Item</div>
          <div className="font-semibold text-right">{y}</div>
          <div className="font-semibold text-right">{py}</div>
          <div className="font-semibold text-right">% Change</div>
          {rows.map((r, i) => (
            <React.Fragment key={`pl-comp-${i}-${r.label}`}>
              <div className={`${r.bold ? 'font-semibold mt-2' : ''}`}>{r.label}</div>
              <div className={`text-right ${r.bold ? 'font-semibold' : ''}`}>R {r.curr.toLocaleString()}</div>
              <div className={`text-right ${r.bold ? 'font-semibold' : ''}`}>R {r.prev.toLocaleString()}</div>
              <div className={`${pctClass(percentChange(r.curr, r.prev))} ${r.bold ? 'text-right font-semibold' : ''}`}>{percentChange(r.curr, r.prev).toFixed(1)}%</div>
            </React.Fragment>
          ))}
        </div>
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
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-80 bg-muted rounded mb-2"></div>
          <div className="h-4 w-[28rem] bg-muted rounded"></div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Statement Skeleton</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 animate-pulse">
              <div className="h-5 w-48 bg-muted rounded"></div>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-4 w-full bg-muted rounded"></div>
              ))}
              <div className="h-5 w-56 bg-muted rounded"></div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 w-full bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
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
        <TabsTrigger value="comparative">Comparative</TabsTrigger>
        <TabsTrigger value="retained-earnings">Retained Earnings</TabsTrigger>
        <TabsTrigger value="monthly-report">Monthly Report</TabsTrigger>
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
                  {renderComparativeCashFlow()}
                </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="monthly-report">
          <Card>
            <CardContent className="pt-6">
              {monthlyAFSLoading ? (
                <div className="space-y-8 animate-pulse">
                  <div>
                    <div className="h-6 w-72 bg-muted rounded mb-2"></div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[1000px]">
                        <div className="flex">
                          <div className="w-48 h-5 bg-muted rounded mr-2"></div>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="flex-1 h-5 bg-muted rounded mr-2"></div>
                          ))}
                        </div>
                        {Array.from({ length: 12 }).map((_, r) => (
                          <div key={r} className="flex mt-2">
                            <div className="w-48 h-4 bg-muted rounded mr-2"></div>
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i} className="flex-1 h-4 bg-muted rounded mr-2"></div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="h-6 w-60 bg-muted rounded mb-2"></div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[1000px]">
                        <div className="flex">
                          <div className="w-48 h-5 bg-muted rounded mr-2"></div>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="flex-1 h-5 bg-muted rounded mr-2"></div>
                          ))}
                        </div>
                        {Array.from({ length: 10 }).map((_, r) => (
                          <div key={r} className="flex mt-2">
                            <div className="w-48 h-4 bg-muted rounded mr-2"></div>
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i} className="flex-1 h-4 bg-muted rounded mr-2"></div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="h-6 w-56 bg-muted rounded mb-2"></div>
                    <div className="overflow-x-auto">
                      <div className="min-w-[1000px]">
                        <div className="flex">
                          <div className="w-48 h-5 bg-muted rounded mr-2"></div>
                          {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="flex-1 h-5 bg-muted rounded mr-2"></div>
                          ))}
                        </div>
                        {Array.from({ length: 6 }).map((_, r) => (
                          <div key={r} className="flex mt-2">
                            <div className="w-48 h-4 bg-muted rounded mr-2"></div>
                            {Array.from({ length: 12 }).map((_, i) => (
                              <div key={i} className="flex-1 h-4 bg-muted rounded mr-2"></div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : monthlyAFSError ? (
                <div className="text-red-600 dark:text-red-400 text-sm">{monthlyAFSError}</div>
              ) : monthlyAFSData.length === 0 ? (
                <div className="text-sm text-muted-foreground">No monthly data loaded</div>
              ) : (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold mb-2">Statement of Financial Position</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 border-b sticky left-0 bg-background z-10">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`bs-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Current Assets</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-ca-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.currentAssetsItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-ca-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.currentAssetsItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-ca-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Current Assets', get: (m: any) => m.bs.totalCurrentAssets },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Current Liabilities</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-cl-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.currentLiabilitiesItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-cl-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.currentLiabilitiesItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-cl-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Current Liabilities', get: (m: any) => m.bs.totalCurrentLiabilities },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Non-current Liabilities</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-ncl-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.nonCurrentLiabilitiesItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-ncl-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.nonCurrentLiabilitiesItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-ncl-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Equity</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`bs-eq-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.bsDetail?.equityItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`bs-eq-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.bsDetail?.equityItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`bs-eq-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Non-current Assets', get: (m: any) => m.bs.totalNonCurrentAssets },
                            { key: 'TOTAL ASSETS', get: (m: any) => m.bs.totalAssets },
                            { key: 'Total Non-current Liabilities', get: (m: any) => m.bs.totalNonCurrentLiabilities },
                            { key: 'Total Liabilities', get: (m: any) => m.bs.totalLiabilities },
                            { key: 'Total Equity', get: (m: any) => m.bs.totalEquity },
                            { key: 'TOTAL L & E', get: (m: any) => m.bs.totalLiabilities + m.bs.totalEquity },
                          ].map((row) => (
                            <tr key={`bs-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`bs-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold mb-2">Income Statement</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 border-b sticky left-0 bg-background z-10">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`pl-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Revenue</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`pl-rev-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.plDetail?.revenueItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`pl-rev-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.plDetail?.revenueItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`pl-rev-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'Total Revenue', get: (m: any) => m.pl.revenue },
                          ].map((row) => (
                            <tr key={`pl-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`pl-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Cost of Sales</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`pl-cogs-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.plDetail?.cogsItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`pl-cogs-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.plDetail?.cogsItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`pl-cogs-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'GROSS PROFIT', get: (m: any) => m.pl.grossProfit },
                          ].map((row) => (
                            <tr key={`pl-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`pl-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr>
                            <td className="py-1 font-bold sticky left-0 bg-background z-10">Operating Expenses</td>
                            {monthlyAFSData.map((m: any, i: number) => (<td key={`pl-opex-h-${m.label}-${i}`} className={`py-1 ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}></td>))}
                          </tr>
                          {(() => {
                            const labels = Array.from(new Set(monthlyAFSData.flatMap((m: any) => (m.plDetail?.opexItems || []).map((i: any) => i.label))));
                            return labels.map((lab) => (
                              <tr key={`pl-opex-${lab}`} className="border-b">
                                <td className="py-1 sticky left-0 bg-background z-10">{lab}</td>
                                {monthlyAFSData.map((m: any, i: number) => {
                                  const found = (m.plDetail?.opexItems || []).find((x: any) => x.label === lab);
                                  const f = formatAccounting(Number(found?.amount || 0));
                                  return (<td key={`pl-opex-${lab}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>);
                                })}
                              </tr>
                            ));
                          })()}
                          {[
                            { key: 'NET PROFIT/(LOSS)', get: (m: any) => m.pl.netProfit },
                          ].map((row) => (
                            <tr key={`pl-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`pl-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
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
                    <div className="overflow-x-auto">
                      <table className="min-w-[1000px] w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 border-b sticky left-0 bg-background z-10">Item</th>
                            {monthlyAFSData.map((m: any, i: number) => (
                              <th key={`cf-h-${m.label}`} className={`text-right py-2 border-b ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{m.label}</th>
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
                            <tr key={`cf-${row.key}`} className="border-b odd:bg-muted/40">
                              <td className="py-1 font-medium sticky left-0 bg-background z-10">{row.key}</td>
                              {monthlyAFSData.map((m: any, i: number) => {
                                const f = formatAccounting(row.get(m));
                                return (
                                  <td key={`cf-${row.key}-${m.label}`} className={`py-1 text-right font-mono ${f.negative ? 'text-red-600 dark:text-red-400' : ''} ${i < monthlyAFSData.length - 1 ? 'border-r' : ''}`}>{f.display}</td>
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
    .lte('transactions.transaction_date', endISO);
  if (txError) throw txError;

  const { data: ledgerEntries, error: ledgerError } = await supabase
    .from('ledger_entries')
    .select('transaction_id, account_id, debit, credit, entry_date, description')
    .eq('company_id', companyId)
    .lte('entry_date', endISO)
    .not('description', 'ilike', '%Opening balance (carry forward)%');
  if (ledgerError) throw ledgerError;

  const trialBalance: Array<{ account_id: string; account_code: string; account_name: string; account_type: string; balance: number; }> = [];
  const totalInventoryValue = await calculateTotalInventoryValue(companyId);

  const ledgerTxIds = new Set<string>((ledgerEntries || []).map((e: any) => String(e.transaction_id || '')));
  const filteredTxEntries = (txEntries || []).filter((e: any) => !ledgerTxIds.has(String(e.transaction_id || '')));

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

    if (acc.account_code === '1300') {
      balance = totalInventoryValue;
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
  
