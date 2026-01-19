import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Info, Plus, FileText, Package, LayoutDashboard, Receipt, Users } from "lucide-react";
import { ARDashboard } from "@/components/Sales/ARDashboard";
import { SalesInvoices } from "@/components/Sales/SalesInvoices";
import { SalesQuotes } from "@/components/Sales/SalesQuotes";
import { SalesProducts } from "@/components/Sales/SalesProducts";
import { SalesCustomers } from "@/components/Sales/SalesCustomers";
import { useAuth } from "@/context/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";

export default function SalesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    return tabParam || "ar-dashboard";
  });
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [location.search, activeTab]);

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_sales_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  return (
    <>
      <SEO title="Sales | Rigel Business" description="Manage sales, invoices, quotes, and products" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Sales Management</h1>
              <p className="text-muted-foreground mt-1">Manage your entire sales pipeline, from quotes to payments</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Tutorial
              </Button>
              <Sheet open={isQuickActionsOpen} onOpenChange={setIsQuickActionsOpen}>
                <SheetTrigger asChild>
                  <Button className="bg-gradient-primary shadow-lg hover:shadow-xl transition-all">
                    <Plus className="h-4 w-4 mr-2" /> Quick Actions
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Sales Actions</SheetTitle>
                    <SheetDescription>Quick access to common sales tasks</SheetDescription>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setActiveTab("invoices"); setIsQuickActionsOpen(false); }}>
                      <FileText className="h-5 w-5 mr-3 text-blue-500" />
                      Create Invoice
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setActiveTab("quotes"); setIsQuickActionsOpen(false); }}>
                      <Receipt className="h-5 w-5 mr-3 text-purple-500" />
                      Create Quote
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setActiveTab("products"); setIsQuickActionsOpen(false); }}>
                      <Package className="h-5 w-5 mr-3 text-green-500" />
                      Add Product
                    </Button>
                    <Button variant="outline" className="justify-start h-12" onClick={() => { setActiveTab("customers"); setIsQuickActionsOpen(false); }}>
                      <Users className="h-5 w-5 mr-3 text-orange-500" />
                      Add Customer
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="border-b pb-px overflow-x-auto">
              <TabsList className="h-auto w-full justify-start gap-2 bg-transparent p-0 rounded-none">
                <TabsTrigger 
                  value="ar-dashboard"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="invoices"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Invoices
                </TabsTrigger>
                <TabsTrigger 
                  value="quotes"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Quotes
                </TabsTrigger>
                <TabsTrigger 
                  value="products"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Products
                </TabsTrigger>
                <TabsTrigger 
                  value="customers"
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent px-4 py-2 rounded-none shadow-none transition-all hover:text-primary flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Customers
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="ar-dashboard" className="animate-in fade-in-50 duration-500">
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

            <TabsContent value="customers">
              <SalesCustomers />
            </TabsContent>
          </Tabs>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Sales Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Use this module to issue customer invoices, manage quotes, and maintain product selling prices.</p>
                <p>To issue an invoice, ensure product selling prices are set under Products. Updating product prices here will be used when creating invoices.</p>
              </div>
              <DialogFooter>
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
import React from "react";
