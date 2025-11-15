import { useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseOverview } from "@/components/Purchase/PurchaseOverview";
import { Bills } from "@/components/Purchase/Bills";
import { PurchaseOrders } from "@/components/Purchase/PurchaseOrders";
import { Suppliers } from "@/components/Purchase/Suppliers";
import { PurchaseTransactions } from "@/components/Purchase/PurchaseTransactions";
import { APDashboard } from "@/components/Purchase/APDashboard";

export default function PurchasePage() {
  const [activeTab, setActiveTab] = useState("ap-dashboard");

  return (
    <>
      <SEO title="Purchase | ApexAccounts" description="Manage bills, purchase orders, expenses, and suppliers" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Purchase</h1>
            <p className="text-muted-foreground mt-1">Manage bills, purchase orders, transactions, and suppliers</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="ap-dashboard">AP Dashboard</TabsTrigger>
              <TabsTrigger value="orders">Purchase Orders</TabsTrigger>
              <TabsTrigger value="bills">Bills</TabsTrigger>
              <TabsTrigger value="transactions">Transactions (Purchase)</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            </TabsList>


            <TabsContent value="bills">
              <Bills />
            </TabsContent>

            <TabsContent value="ap-dashboard">
              <APDashboard />
            </TabsContent>

            <TabsContent value="orders">
              <PurchaseOrders />
            </TabsContent>


            <TabsContent value="transactions">
              <PurchaseTransactions />
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
