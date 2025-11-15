import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ARDashboard } from "@/components/Sales/ARDashboard";
import { SalesInvoices } from "@/components/Sales/SalesInvoices";
import { SalesQuotes } from "@/components/Sales/SalesQuotes";
import { SalesProducts } from "@/components/Sales/SalesProducts";

export default function SalesPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    return tabParam || "ar-dashboard";
  });

  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

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
              <TabsTrigger value="ar-dashboard">AR Dashboard</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="quotes">Quotes</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>


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
