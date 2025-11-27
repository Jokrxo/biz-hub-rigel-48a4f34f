import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { DashboardOverview } from "@/components/Dashboard/DashboardOverview";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { UserTour } from "@/components/Onboarding/UserTour";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ hasCoa: boolean; hasBank: boolean; hasProducts: boolean; hasCustomers: boolean; hasSuppliers: boolean; hasEmployees: boolean }>({ hasCoa: false, hasBank: false, hasProducts: false, hasCustomers: false, hasSuppliers: false, hasEmployees: false });
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const doneKey = `onboarding_completed_${uid}`;
    const justSignedUp = localStorage.getItem('just_signed_up') === 'true';
    const alreadyCompleted = localStorage.getItem(doneKey) === 'true';
    if (justSignedUp && !alreadyCompleted) {
      setTutorialOpen(true);
      try {
        localStorage.setItem(doneKey, 'true');
        localStorage.removeItem('just_signed_up');
      } catch {}
    }
    const tourDoneKey = `user_tour_completed_${uid}`;
    const justLoggedIn = localStorage.getItem('just_logged_in') === 'true';
    const tourCompleted = localStorage.getItem(tourDoneKey) === 'true';
    if (justLoggedIn && !tourCompleted) {
      setTourOpen(true);
    }
  }, [user]);

  useEffect(() => {
    const loadStatus = async () => {
      const ac = new AbortController();
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", authUser.id)
          .maybeSingle();
        const companyId = profile ? (profile as { company_id: string }).company_id : undefined;
        if (!companyId) return;
        const { count: coaCount } = await supabase
          .from("chart_of_accounts")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .eq("is_active", true)
          .limit(1)
          .abortSignal(ac.signal);
        const { count: banksCount } = await supabase
          .from("bank_accounts")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .limit(1)
          .abortSignal(ac.signal);
        const { count: productsCount } = await supabase
          .from("items")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .eq("item_type", "product")
          .limit(1)
          .abortSignal(ac.signal);
        const { count: customersCount } = await supabase
          .from("customers")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .limit(1)
          .abortSignal(ac.signal);
        const { count: suppliersCount } = await supabase
          .from("suppliers")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .limit(1)
          .abortSignal(ac.signal);
        const { count: employeesCount } = await supabase
          .from("employees")
          .select("id", { count: "exact" })
          .eq("company_id", companyId)
          .limit(1)
          .abortSignal(ac.signal);
        setSetupStatus({
          hasCoa: (coaCount || 0) > 0,
          hasBank: (banksCount || 0) > 0,
          hasProducts: (productsCount || 0) > 0,
          hasCustomers: (customersCount || 0) > 0,
          hasSuppliers: (suppliersCount || 0) > 0,
          hasEmployees: (employeesCount || 0) > 0
        });
      } catch {}
      return () => ac.abort();
    };
    const cleanup = loadStatus();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);
  return (
    <>
      <SEO title="Dashboard | Rigel Business" description="Rigel Business dashboard with real-time financial data" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">Viewing key metrics and recent activity</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
              <Sheet open={quickSetupOpen} onOpenChange={setQuickSetupOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Quick Setup">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle>Quick Setup</SheetTitle>
                    <SheetDescription>Add core records to start using modules</SheetDescription>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium">Chart of Accounts</div>
                        <div className="text-xs text-muted-foreground">Create your accounts</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus.hasCoa ? "default" : "outline"} className={setupStatus.hasCoa ? "bg-green-500 text-white" : ""}>{setupStatus.hasCoa ? "Done" : "Not set"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate("/transactions?tab=chart")}>Go</Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium">Bank Account</div>
                        <div className="text-xs text-muted-foreground">Add at least one bank</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus.hasBank ? "default" : "outline"} className={setupStatus.hasBank ? "bg-green-500 text-white" : ""}>{setupStatus.hasBank ? "Done" : "Not set"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate("/bank")}>Go</Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium">Product</div>
                        <div className="text-xs text-muted-foreground">Add products via Purchase Orders</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus.hasProducts ? "default" : "outline"} className={setupStatus.hasProducts ? "bg-green-500 text-white" : ""}>{setupStatus.hasProducts ? "Done" : "Not set"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate("/purchase")}>Go</Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium">Customer</div>
                        <div className="text-xs text-muted-foreground">Manage customers in Customers module</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus.hasCustomers ? "default" : "outline"} className={setupStatus.hasCustomers ? "bg-green-500 text-white" : ""}>{setupStatus.hasCustomers ? "Done" : "Not set"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate("/customers")}>Go</Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium">Supplier</div>
                        <div className="text-xs text-muted-foreground">Create suppliers in Purchase</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus.hasSuppliers ? "default" : "outline"} className={setupStatus.hasSuppliers ? "bg-green-500 text-white" : ""}>{setupStatus.hasSuppliers ? "Done" : "Not set"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate("/purchase")}>Go</Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div className="space-y-1">
                        <div className="font-medium">Employee</div>
                        <div className="text-xs text-muted-foreground">Add employees in Payroll</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus.hasEmployees ? "default" : "outline"} className={setupStatus.hasEmployees ? "bg-green-500 text-white" : ""}>{setupStatus.hasEmployees ? "Done" : "Not set"}</Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate("/payroll")}>Go</Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <DashboardOverview />

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Dashboard Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>This is for viewing the dashboard.</p>
                <p>Use it to get a quick overview of balances, trends, and recent transactions.</p>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>
          <UserTour open={tourOpen} onOpenChange={setTourOpen} userId={user?.id || undefined} />
        </div>
      </DashboardLayout>
    </>
  );
};

export default Index;
