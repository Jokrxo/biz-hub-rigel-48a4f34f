import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaxOverview } from "@/components/Tax/TaxOverview";
import { TaxRates } from "@/components/Tax/TaxRates";
import { SalesTaxReport } from "@/components/Tax/SalesTaxReport";
import { TaxReturns } from "@/components/Tax/TaxReturns";
import { PurchaseTaxReport } from "@/components/Tax/PurchaseTaxReport";

export default function TaxPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      <SEO title="Tax | ApexAccounts" description="Manage tax rates, returns, and reports" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Tax Management</h1>
            <p className="text-muted-foreground mt-1">Manage tax rates, returns, and generate tax reports</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="rates">Tax Rates</TabsTrigger>
              <TabsTrigger value="sales-tax">Sales Tax Report</TabsTrigger>
              <TabsTrigger value="tax-expense">Tax on Expense (Purchases)</TabsTrigger>
              <TabsTrigger value="returns">Tax Returns</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <TaxOverview />
            </TabsContent>

            <TabsContent value="rates">
              <TaxRates />
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
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}
