import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { PurchaseOverview } from "@/components/Purchase/PurchaseOverview";
import { Bills } from "@/components/Purchase/Bills";
import { PurchaseOrders } from "@/components/Purchase/PurchaseOrders";
import { Suppliers } from "@/components/Purchase/Suppliers";
import { PurchaseTransactions } from "@/components/Purchase/PurchaseTransactions";
import { APDashboard } from "@/components/Purchase/APDashboard";
import { useAuth } from "@/context/AuthContext";

export default function PurchasePage() {
  const [activeTab, setActiveTab] = useState("ap-dashboard");
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_purchase_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  return (
    <>
      <SEO title="Purchase | ApexAccounts" description="Manage bills, purchase orders, expenses, and suppliers" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Purchase</h1>
              <p className="text-muted-foreground mt-1">Manage bills, purchase orders, transactions, and suppliers</p>
            </div>
            <Button variant="outline" onClick={() => setTutorialOpen(true)}>
              <Info className="h-4 w-4 mr-2" />
              Help & Tutorial
            </Button>
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

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Purchase Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Before using this module, add your suppliers under the Suppliers tab.</p>
                <p>Purchases update product cost and stock, and they also auto update related items visible in Sales products.</p>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
