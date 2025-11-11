import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesOverviewReal } from "@/components/Sales/SalesOverviewReal";
import { ARDashboard } from "@/components/Sales/ARDashboard";
import { SalesInvoices } from "@/components/Sales/SalesInvoices";
import { SalesQuotes } from "@/components/Sales/SalesQuotes";
import { SalesProducts } from "@/components/Sales/SalesProducts";

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      <SEO title="Sales | ApexAccounts" description="Manage sales, invoices, quotes, and products" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Sales</h1>
            <p className="text-muted-foreground mt-1">Manage invoices, quotes, and products</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ar-dashboard">AR Dashboard</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="quotes">Quotes</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <SalesOverviewReal />
            </TabsContent>

            <TabsContent value="ar-dashboard">
              <ARDashboard />
            </TabsContent>

            <TabsContent value="invoices">
              <SalesInvoices />
            </TabsContent>

            <TabsContent value="quotes">
              <SalesQuotes />
            </TabsContent>

            <TabsContent value="products">
              <SalesProducts />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}
