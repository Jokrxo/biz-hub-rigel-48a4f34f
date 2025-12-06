import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaxOverview } from "@/components/Tax/TaxOverview";
import { TaxRates } from "@/components/Tax/TaxRates";
import { SalesTaxReport } from "@/components/Tax/SalesTaxReport";
import { TaxReturns } from "@/components/Tax/TaxReturns";
import { VAT201 } from "@/components/Tax/VAT201";
import { PurchaseTaxReport } from "@/components/Tax/PurchaseTaxReport";
import InterpretationNote45 from "../components/Tax/InterpretationNote45";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnnualVATReport } from "@/components/Tax/AnnualVATReport";
import { Hammer, LayoutDashboard, FileText, History, TrendingUp, TrendingDown, Calculator, Percent, BookOpen, CalendarRange } from "lucide-react";

export default function TaxPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      <SEO title="Tax | Rigel Business" description="Manage tax rates, returns, and reports" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Tax Management</h1>
            <p className="text-muted-foreground">Manage tax rates, file returns, and generate comprehensive tax reports</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="border-b pb-px overflow-x-auto">
              <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 rounded-none">
                <TabsTrigger 
                  value="overview"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="vat201"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  VAT201
                </TabsTrigger>
                <TabsTrigger 
                  value="annual-vat"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <CalendarRange className="h-4 w-4" />
                  Annual VAT
                </TabsTrigger>
                <TabsTrigger 
                  value="returns"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Returns
                </TabsTrigger>
                <TabsTrigger 
                  value="sales-tax"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <TrendingUp className="h-4 w-4" />
                  Sales Tax
                </TabsTrigger>
                <TabsTrigger 
                  value="tax-expense"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <TrendingDown className="h-4 w-4" />
                  Purchase Tax
                </TabsTrigger>
                <TabsTrigger 
                  value="tax-computation"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Calculator className="h-4 w-4" />
                  Computation
                </TabsTrigger>
                <TabsTrigger 
                  value="rates"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Percent className="h-4 w-4" />
                  Rates
                </TabsTrigger>
                <TabsTrigger 
                  value="note45"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Info
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview">
              <TaxOverview />
            </TabsContent>


            <TabsContent value="sales-tax">
              <SalesTaxReport />
            </TabsContent>

            <TabsContent value="tax-expense">
              <PurchaseTaxReport />
            </TabsContent>

            <TabsContent value="returns">
              <TaxReturns />
            </TabsContent>

            <TabsContent value="vat201">
              <VAT201 />
            </TabsContent>

            <TabsContent value="annual-vat">
              <AnnualVATReport />
            </TabsContent>

            <TabsContent value="tax-computation">
              <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center">
                <Card className="w-[360px]">
                  <CardHeader>
                    <CardTitle>Tax Computation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="rounded-full bg-muted w-24 h-24 flex items-center justify-center mb-4">
                        <Hammer className="h-12 w-12 text-primary animate-bounce" />
                      </div>
                      <div className="text-xl font-semibold">Module under maintenance</div>
                      <div className="text-sm text-muted-foreground">We are still building this module</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="rates">
              <TaxRates />
            </TabsContent>

            <TabsContent value="note45">
              <InterpretationNote45 />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}
