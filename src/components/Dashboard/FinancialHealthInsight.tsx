import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetchCompanyFinancialMetrics, FinancialMetrics } from "@/lib/financial-utils";

interface FinancialHealthInsightProps {
  metrics?: FinancialMetrics;
  companyId?: string;
  trigger?: React.ReactNode;
}

export const FinancialHealthInsight = ({ metrics: initialMetrics, companyId, trigger }: FinancialHealthInsightProps) => {
  const [metrics, setMetrics] = useState<FinancialMetrics | undefined>(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && companyId && !initialMetrics) {
      const loadMetrics = async () => {
        setLoading(true);
        try {
          const data = await fetchCompanyFinancialMetrics(companyId);
          setMetrics(data);
        } catch (error) {
          console.error("Failed to load metrics", error);
        } finally {
          setLoading(false);
        }
      };
      loadMetrics();
    }
  }, [open, companyId, initialMetrics]);

  // Use initialMetrics if provided (dashboard), otherwise state metrics (company list)
  const activeMetrics = initialMetrics || metrics;

  const safeMetrics = activeMetrics || {
    totalAssets: 0,
    totalLiabilities: 0,
    totalEquity: 0,
    totalIncome: 0,
    totalExpenses: 0,
    currentAssets: 0,
    currentLiabilities: 0,
    bankBalance: 0
  };

  if (!activeMetrics && !loading && open) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
         <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" className="gap-2">
              <Activity className="h-4 w-4" />
              Financial Health
            </Button>
          )}
        </DialogTrigger>
        <DialogContent>
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const { totalAssets, totalLiabilities, totalEquity, totalIncome, totalExpenses } = safeMetrics;
  
  const netProfit = totalIncome - totalExpenses;
  const isSolvent = totalAssets >= totalLiabilities;
  const isProfitable = netProfit > 0;
  
  // Profitability Ratios
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
  const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : 0; // Return on Assets
  const roe = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0; // Return on Equity

  // Solvency Ratios
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const equityMultiplier = totalEquity > 0 ? totalAssets / totalEquity : 0;

  // Liquidity Ratios
  const currentRatio = safeMetrics.currentLiabilities > 0 ? safeMetrics.currentAssets / safeMetrics.currentLiabilities : (safeMetrics.currentAssets > 0 ? 10 : 0);
  const cashRatio = safeMetrics.currentLiabilities > 0 ? safeMetrics.bankBalance / safeMetrics.currentLiabilities : (safeMetrics.bankBalance > 0 ? 10 : 0);
  const cashToDebt = totalLiabilities > 0 ? (safeMetrics.bankBalance / totalLiabilities) * 100 : (safeMetrics.bankBalance > 0 ? 100 : 0); // Cash Coverage
  
  // Determine health status and message
  let healthStatus: "excellent" | "good" | "warning" | "critical" = "good";
  let healthMessage = "";
  let HealthIcon = Activity;

  if (isSolvent && isProfitable && profitMargin > 15) {
    healthStatus = "excellent";
    healthMessage = "Strong financial performance with healthy profit margins and solvency.";
    HealthIcon = CheckCircle2;
  } else if (isSolvent && isProfitable) {
    healthStatus = "good";
    healthMessage = "Stable financial position. Profitable with covered liabilities.";
    HealthIcon = TrendingUp;
  } else if (isSolvent && !isProfitable) {
    healthStatus = "warning";
    healthMessage = "Solvent but operating at a loss. Expense review recommended.";
    HealthIcon = AlertTriangle;
  } else {
    healthStatus = "critical";
    healthMessage = "Financial attention required. Liabilities exceed assets or critical losses.";
    HealthIcon = TrendingDown;
  }

  const colorMap = {
    excellent: "text-emerald-700 bg-emerald-50 border-emerald-200",
    good: "text-blue-700 bg-blue-50 border-blue-200",
    warning: "text-amber-700 bg-amber-50 border-amber-200",
    critical: "text-red-700 bg-red-50 border-red-200",
  };

  const statusColor = colorMap[healthStatus];

  // Recommendations Logic
  const recommendations = [];
  if (profitMargin < 10 && profitMargin > 0) recommendations.push("Profit margin is tight. Consider reviewing pricing strategy or reducing variable costs.");
  if (!isProfitable) recommendations.push("Immediate focus on cost reduction or revenue generation is needed to reach break-even.");
  if (debtRatio > 50) recommendations.push("High debt ratio detected (>50%). Prioritize paying down liabilities to improve solvency.");
  if (currentRatio < 1.5) recommendations.push("Current Ratio is low (<1.5). You may face difficulty meeting short-term obligations.");
  if (cashRatio < 0.2) recommendations.push("Cash Ratio is critical. Ensure you have enough liquidity for immediate payments.");
  if (roa < 5 && roa > 0) recommendations.push("Return on Assets is low. Ensure assets are being utilized efficiently to generate profit.");
  if (totalAssets > 0 && (totalIncome / totalAssets) < 0.5) recommendations.push("Asset turnover is low. Ensure assets are generating sufficient revenue.");
  if (recommendations.length === 0) recommendations.push("Continue monitoring key metrics and maintain current growth strategy.");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary">
            <Activity className="h-4 w-4" />
            Financial Health
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Activity className="h-5 w-5 text-primary" />
            Financial Summary & Insights
          </DialogTitle>
          <DialogDescription>
            Comprehensive analysis of your company's financial standing.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing financial data...</p>
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Verdict Card */}
            <div className={`p-4 rounded-lg border flex gap-4 ${statusColor}`}>
              <div className={`p-2 rounded-full bg-white h-fit shadow-sm`}>
                <HealthIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg capitalize mb-1">{healthStatus} Condition</h3>
                <p className="text-sm opacity-90 leading-relaxed">
                  {healthMessage}
                </p>
              </div>
            </div>

            {/* Profitability Ratios */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                Profitability
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Profit Margin</div>
                    <div className={`text-xl font-bold ${profitMargin > 15 ? 'text-emerald-600' : profitMargin > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {profitMargin.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Return on Assets</div>
                    <div className={`text-xl font-bold ${roa > 10 ? 'text-emerald-600' : 'text-primary'}`}>
                      {roa.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-emerald-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Return on Equity</div>
                    <div className="text-xl font-bold text-purple-600">
                      {roe.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Liquidity Ratios */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                Liquidity
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-blue-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Current Ratio</div>
                    <div className={`text-xl font-bold ${currentRatio > 1.5 ? 'text-emerald-600' : currentRatio > 1 ? 'text-amber-600' : 'text-red-600'}`}>
                      {currentRatio.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-blue-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Cash Ratio</div>
                    <div className={`text-xl font-bold ${cashRatio > 0.5 ? 'text-emerald-600' : 'text-primary'}`}>
                      {cashRatio.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-blue-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Cash Coverage</div>
                    <div className={`text-xl font-bold ${cashToDebt > 50 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {cashToDebt.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Solvency Ratios */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                Solvency
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-amber-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Debt Ratio</div>
                    <div className={`text-xl font-bold ${debtRatio < 40 ? 'text-emerald-600' : debtRatio < 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {debtRatio.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm bg-muted/20 border-l-4 border-l-amber-500">
                  <CardContent className="p-4 text-center">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Equity Multiplier</div>
                    <div className="text-xl font-bold text-cyan-600">
                      {equityMultiplier.toFixed(2)}x
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Balance Sheet Summary */}
              <Card className="shadow-sm">
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider mb-4 border-b pb-2">Balance Sheet</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Assets</span>
                    <span className="font-bold text-emerald-600">R {totalAssets.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Liabilities</span>
                    <span className="font-bold text-red-600">R {totalLiabilities.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="text-sm font-medium">Total Equity</span>
                    <span className="font-bold text-purple-600">R {totalEquity.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Income Statement Summary */}
              <Card className="shadow-sm">
                <CardContent className="pt-6 space-y-3">
                  <h4 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider mb-4 border-b pb-2">Performance (YTD)</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Income</span>
                    <span className="font-bold text-emerald-600">R {totalIncome.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Expenses</span>
                    <span className="font-bold text-amber-600">R {totalExpenses.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t mt-2">
                    <span className="text-sm font-medium">Net Profit</span>
                    <span className={`font-bold ${isProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                      R {netProfit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <div className="bg-muted/30 rounded-lg p-4 border border-dashed">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Strategic Recommendations
              </h4>
              <ul className="space-y-2">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="text-[10px] text-center text-muted-foreground mt-2">
              * Figures are based on posted ledger entries.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
