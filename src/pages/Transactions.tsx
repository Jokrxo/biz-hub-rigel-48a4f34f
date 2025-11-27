import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { TransactionManagement } from "@/components/Transactions/TransactionManagement";
import { ChartOfAccountsManagement } from "@/components/Transactions/ChartOfAccountsManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/useAuth";
import SEO from "@/components/SEO";

export default function TransactionsPage() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_transactions_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  return (
    <>
      <SEO title="Transactions | SA Finance Manager" description="Manage and track all transactions" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Transaction Management</h1>
                <p className="text-muted-foreground mt-1">Manage transactions and chart of accounts</p>
              </div>
              <Button variant="outline" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help & Tutorial
              </Button>
            </div>
          </div>

          <Tabs defaultValue="transactions" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transactions" className="space-y-4">
              <TransactionManagement />
            </TabsContent>
            
            <TabsContent value="chart" className="space-y-4">
              <ChartOfAccountsManagement />
            </TabsContent>
          </Tabs>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Transactions Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Use this module to create, review, and export accounting transactions.</p>
                <p>Click <strong>New Transaction</strong> to open the double-entry form. Select <strong>Debit</strong> and <strong>Credit</strong> accounts, set a bank if it’s a bank payment/receipt, and optionally include VAT.</p>
                <p>Posting updates your <strong>Trial Balance</strong> and adjusts <strong>Bank</strong> balances when applicable.</p>
                <p>Common flows supported: Income received, Expense payment, Asset purchase, Loan received/repayment/interest, and Depreciation posting.</p>
                <p>Use filters to find entries by type/status and export to Excel or PDF for reporting.</p>
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
