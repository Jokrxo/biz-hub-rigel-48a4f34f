import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseOverview } from "@/components/Purchase/PurchaseOverview";
import { Bills } from "@/components/Purchase/Bills";
import { PurchaseOrders } from "@/components/Purchase/PurchaseOrders";
import { Expenses } from "@/components/Purchase/Expenses";
import { Suppliers } from "@/components/Purchase/Suppliers";

export default function PurchasePage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <>
      <SEO title="Purchase | ApexAccounts" description="Manage bills, purchase orders, expenses, and suppliers" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Purchase</h1>
            <p className="text-muted-foreground mt-1">Manage bills, purchase orders, and suppliers</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="bills">Bills</TabsTrigger>
              <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <PurchaseOverview />
            </TabsContent>

            <TabsContent value="bills">
              <Bills />
            </TabsContent>

            <TabsContent value="orders">
              <PurchaseOrders />
            </TabsContent>

            <TabsContent value="expenses">
              <Expenses />
            </TabsContent>

            <TabsContent value="suppliers">
              <Suppliers />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}
