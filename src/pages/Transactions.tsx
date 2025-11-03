import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { TransactionManagement } from "@/components/Transactions/TransactionManagement";
import { ChartOfAccountsManagement } from "@/components/Transactions/ChartOfAccountsManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/SEO";

export default function TransactionsPage() {
  return (
    <>
      <SEO title="Transactions | SA Finance Manager" description="Manage and track all transactions" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Transaction Management</h1>
            <p className="text-muted-foreground mt-1">Manage transactions and chart of accounts</p>
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
        </div>
      </DashboardLayout>
    </>
  );
}
