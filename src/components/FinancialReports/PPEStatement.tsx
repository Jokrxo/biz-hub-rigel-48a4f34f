import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateDepreciation } from "@/components/FixedAssets/DepreciationCalculator";
import { useFiscalYear } from "@/hooks/use-fiscal-year";

interface PPEStatementProps {
  selectedYear: number;
}

interface PPEMonthlyData {
  month: string;
  openingCost: number;
  openingAccDep: number;
  openingNBV: number;
  additions: number;
  disposalsCost: number;
  disposalsAccDep: number;
  depreciation: number;
  closingCost: number;
  closingAccDep: number;
  closingNBV: number;
}

export const PPEStatement = ({ selectedYear }: PPEStatementProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PPEMonthlyData[]>([]);
  const { fiscalStartMonth, getFiscalYearDates, getCalendarYearForFiscalPeriod, selectedFiscalYear, loading: fyLoading } = useFiscalYear();
  const [year, setYear] = useState<number>(selectedYear);

  useEffect(() => { setYear(selectedYear); }, [selectedYear]);

  useEffect(() => {
    if (!fyLoading) {
      loadPPEData();
    }
  }, [year, fiscalStartMonth, fyLoading]);

  const loadPPEData = async () => {
    setLoading(true);
    try {
      // 1. Get User Company
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.company_id) throw new Error("Company not found");

      // 2. Get Fixed Assets
      const { data: assets, error: assetError } = await supabase
        .from("fixed_assets")
        .select("*")
        .eq("company_id", profile.company_id)
        .neq('status', 'draft'); // Only active/disposed/sold
      
      if (assetError) throw assetError;

      // 3. Get Asset and Acc Dep Accounts (to detect movements from ledger for cross-verification or additions not yet in asset register)
      // For this specific request, user wants to rely on Fixed Assets module for opening balances.
      // But we still need ledger for "Additions" if they are posted via journals but not yet in fixed_assets (unlikely if process is followed).
      // However, "Additions" usually means new assets added to fixed_assets table in that year.
      
      const { startDate: fyStartObj, endDate: fyEndObj, startStr: startStr, endStr: endStr } = getFiscalYearDates(year);

      const months = Array.from({ length: 12 }, (_, i) => {
        const mi = (fiscalStartMonth - 1 + i) % 12;
        const monthNum = mi + 1;
        const y = getCalendarYearForFiscalPeriod(year, monthNum);
        const label = new Date(y, mi, 1).toLocaleString('en-ZA', { month: 'long' });
        return `${label} ${y}`;
      });

      // We will compute the schedule by iterating months and simulating the asset register state.
      
      // Initial State (Opening at fiscal year start)
      const openingAssets = (assets || []).filter(a => {
        const pd = new Date(String(a.purchase_date));
        return pd.getTime() < fyStartObj.getTime();
      });
      
      // Calculate Opening Cost
      // For assets disposed BEFORE start of year, they should not be in opening balance (assuming they are fully removed).
      // If status is disposed and disposal_date < startDate, ignore.
      const activeOpeningAssets = openingAssets.filter(a => {
        const isDisposed = a.status === 'disposed' || a.status === 'sold' || a.status === 'scrapped';
        if (isDisposed && a.disposal_date) {
          const dd = new Date(String(a.disposal_date));
          if (dd.getTime() < fyStartObj.getTime()) return false;
        }
        return true;
      });

      let runningCost = activeOpeningAssets.reduce((sum, a) => sum + Number(a.cost || 0), 0);
      
      // Calculate Opening Accumulated Depreciation
      // We need to calculate depreciation up to Dec 31 of previous year for these assets.
      let runningAccDep = 0;
      activeOpeningAssets.forEach(a => {
        // Calculate accumulated dep as of startDate (or end of prev year)
        // If disposed, we only calculate up to disposal date? No, if it's active opening, it's not disposed yet.
        // If it was disposed during prior years, it's filtered out above.
        
        // Use the utility function to calc dep up to day before start date
        const prevEnd = new Date(fyStartObj);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const calcDate = prevEnd;
        const res = calculateDepreciation(
          Number(a.cost),
          a.purchase_date,
          Number(a.useful_life_years),
          calcDate
        );
        runningAccDep += res.accumulatedDepreciation;
      });

      const monthlyRows: PPEMonthlyData[] = [];

      // Loop through months
      for (let i = 0; i < 12; i++) {
        const mi = (fiscalStartMonth - 1 + i) % 12;
        const monthNum = mi + 1;
        const yForMonth = getCalendarYearForFiscalPeriod(year, monthNum);
        const monthLabel = months[i];
        const currentMonthStart = new Date(yForMonth, mi, 1);
        const currentMonthEnd = new Date(yForMonth, mi + 1, 0);
        const currentMonthEndStr = currentMonthEnd.toISOString().split('T')[0];
        const currentMonthStartStr = currentMonthStart.toISOString().split('T')[0];

        // 1. Additions: Assets purchased in this month
        const additions = (assets || []).filter(a => {
          const pd = new Date(String(a.purchase_date));
          return pd.getTime() >= currentMonthStart.getTime() && pd.getTime() <= currentMonthEnd.getTime();
        });
        const additionsCost = additions.reduce((sum, a) => sum + Number(a.cost || 0), 0);

        // 2. Disposals: Assets disposed in this month
        const disposals = (assets || []).filter(a => {
          const isDisposed = a.status === 'disposed' || a.status === 'sold' || a.status === 'scrapped';
          if (!isDisposed || !a.disposal_date) return false;
          const dd = new Date(String(a.disposal_date));
          return dd.getTime() >= currentMonthStart.getTime() && dd.getTime() <= currentMonthEnd.getTime();
        });
        
        const disposalsCost = disposals.reduce((sum, a) => sum + Number(a.cost || 0), 0);
        
        // Calculate Acc Dep removed on disposal
        // It should be the Acc Dep up to the date of disposal
        let disposalsAccDep = 0;
        disposals.forEach(a => {
           // Calculate Acc Dep up to disposal date
           const dispDate = new Date(a.disposal_date!);
           const res = calculateDepreciation(
             Number(a.cost),
             a.purchase_date,
             Number(a.useful_life_years),
             dispDate
           );
           disposalsAccDep += res.accumulatedDepreciation;
        });

        // 3. Depreciation Expense for this month
        // Iterate all assets that are active (or disposed in this month - check policy usually dep in month of disposal? or up to prev month?)
        // Let's assume pro-rata or simple monthly. 
        // We need "monthly depreciation" for all assets held during the month.
        
        // Assets to depreciate:
        // - Purchased before or during this month
        // - Not disposed before this month
        // - Not fully depreciated before this month
        
        let monthlyDepreciationTotal = 0;
        
        // We consider all assets in the register
        (assets || []).forEach(a => {
           const pd = new Date(String(a.purchase_date));
           // Skip if purchased after this month
           if (pd.getTime() > currentMonthEnd.getTime()) return;
           
           // Skip if disposed before this month
           const isDisposed = a.status === 'disposed' || a.status === 'sold' || a.status === 'scrapped';
           if (isDisposed && a.disposal_date) {
             const dd = new Date(String(a.disposal_date));
             if (dd.getTime() < currentMonthStart.getTime()) return;
           }
           
           // Calculate standard monthly depreciation
           const annual = Number(a.cost) / Number(a.useful_life_years);
           const monthly = annual / 12;
           
           // Check if fully depreciated already?
           // Calculate Acc Dep at start of month
           const startMonthDate = new Date(yForMonth, mi, 0);
           const prevRes = calculateDepreciation(Number(a.cost), a.purchase_date, Number(a.useful_life_years), startMonthDate);
           
           if (prevRes.netBookValue <= 0) return; // Fully depreciated
           
           // If purchased in this month, do we depreciate? 
           // Policy varies. Often pro-rata or "full month if purchased < 15th". 
           // calculateDepreciation logic uses days/months logic.
           // Let's rely on diff between "Acc Dep at End of Month" vs "Acc Dep at Start of Month"
           
           const endMonthDate = new Date(yForMonth, mi + 1, 0);
           // If disposed this month, cap calculation at disposal date?
           // Usually we depreciate up to disposal. 
           // But our `disposalsAccDep` above calculated TOTAL Acc Dep at disposal.
           // So for the movement line "Depreciation", we just need the increment for this month.
           
           // BUT: `calculateDepreciation` is cumulative.
           // So: Dep Expense = (Acc Dep at End of Month OR Disposal Date) - (Acc Dep at Start of Month)
           
           let calcLimitDate = endMonthDate;
           if (isDisposed && a.disposal_date) {
              const dd = new Date(String(a.disposal_date));
              if (dd.getTime() <= endMonthDate.getTime()) {
                calcLimitDate = dd;
              }
           }
           
           const currentRes = calculateDepreciation(Number(a.cost), a.purchase_date, Number(a.useful_life_years), calcLimitDate);
           
           const depForMonth = Math.max(0, currentRes.accumulatedDepreciation - prevRes.accumulatedDepreciation);
           monthlyDepreciationTotal += depForMonth;
        });


        const openingCost = runningCost;
        const openingAccDepVal = runningAccDep;
        
        // Update running totals
        runningCost = runningCost + additionsCost - disposalsCost;
        // Acc Dep increases by Depreciation Expense, decreases by Disposal
        runningAccDep = runningAccDep + monthlyDepreciationTotal - disposalsAccDep;

        monthlyRows.push({
          month: monthLabel,
          openingCost: openingCost,
          openingAccDep: openingAccDepVal,
          openingNBV: openingCost - openingAccDepVal,
          additions: additionsCost,
          disposalsCost: disposalsCost,
          disposalsAccDep: disposalsAccDep,
          depreciation: monthlyDepreciationTotal,
          closingCost: runningCost,
          closingAccDep: runningAccDep,
          closingNBV: runningCost - runningAccDep
        });
      }

      setData(monthlyRows);

    } catch (error: any) {
      console.error('Error loading PPE data:', error);
      toast({ title: 'Error', description: 'Failed to load PPE data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type: 'pdf' | 'excel') => {
    if (type === 'excel') {
      const ws = XLSX.utils.json_to_sheet(data.map(r => ({
        Month: r.month,
        'Opening Cost': r.openingCost,
        'Opening Acc Dep': r.openingAccDep,
        'Opening Carrying Value': r.openingNBV,
        'Additions': r.additions,
        'Disposals (Cost)': r.disposalsCost,
        'Disposals (Acc Dep)': r.disposalsAccDep,
        'Depreciation': r.depreciation,
        'Closing Cost': r.closingCost,
        'Closing Acc Dep': r.closingAccDep,
        'Closing Carrying Value': r.closingNBV
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PPE Schedule");
      XLSX.writeFile(wb, `PPE_Schedule_FY_${year}.xlsx`);
    } else {
      const doc = new jsPDF('l', 'mm', 'a4');
      const { startDate: s, endDate: e } = getFiscalYearDates(year);
      const sStr = s.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
      const eStr = e.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
      doc.text(`PPE Schedule - FY ${year} (${sStr} – ${eStr})`, 14, 15);
      
      const tableData = data.map(r => [
        r.month,
        r.openingCost.toFixed(2),
        r.openingAccDep.toFixed(2),
        r.openingNBV.toFixed(2),
        r.additions.toFixed(2),
        r.disposalsCost.toFixed(2),
        r.disposalsAccDep.toFixed(2),
        r.depreciation.toFixed(2),
        r.closingCost.toFixed(2),
        r.closingAccDep.toFixed(2),
        r.closingNBV.toFixed(2)
      ]);

      autoTable(doc, {
        head: [['Month', 'Op Cost', 'Op AccDep', 'Op NBV', 'Additions', 'Disp Cost', 'Disp AccDep', 'Depreciation', 'Cl Cost', 'Cl AccDep', 'Cl NBV']],
        body: tableData,
        startY: 20,
        styles: { fontSize: 8 },
      });

      doc.save(`PPE_Schedule_FY_${year}.pdf`);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {(() => {
            const { startDate: s, endDate: e } = getFiscalYearDates(year);
            const sStr = s.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
            const eStr = e.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
            return `PPE Movement Schedule (FY ${year} • ${sStr} – ${eStr})`;
          })()}
        </CardTitle>
        <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const fy = typeof selectedFiscalYear === 'number' ? selectedFiscalYear : new Date().getFullYear();
                setYear(fy);
              }}
            >
              Fiscal Year
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <FileDown className="h-4 w-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
              <Download className="h-4 w-4 mr-2" /> Excel
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Opening Cost</TableHead>
                <TableHead className="text-right">Opening Acc. Dep</TableHead>
                <TableHead className="text-right bg-muted/50">Opening Carrying Value</TableHead>
                <TableHead className="text-right text-emerald-600">Additions</TableHead>
                <TableHead className="text-right text-red-600">Disposals (Cost)</TableHead>
                <TableHead className="text-right text-red-600">Disposals (Acc Dep)</TableHead>
                <TableHead className="text-right text-orange-600">Depreciation</TableHead>
                <TableHead className="text-right">Closing Cost</TableHead>
                <TableHead className="text-right">Closing Acc. Dep</TableHead>
                <TableHead className="text-right bg-muted/50 font-bold">Closing Carrying Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right">{row.openingCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right">{row.openingAccDep.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right bg-muted/50">{row.openingNBV.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right text-emerald-600">{row.additions > 0 ? '+' : ''}{row.additions.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right text-red-600">{row.disposalsCost > 0 ? '-' : ''}{row.disposalsCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right text-red-600">{row.disposalsAccDep > 0 ? '-' : ''}{row.disposalsAccDep.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right text-orange-600">{row.depreciation > 0 ? '+' : ''}{row.depreciation.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right">{row.closingCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right">{row.closingAccDep.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  <TableCell className="text-right bg-muted/50 font-bold">{row.closingNBV.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
