import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { TransactionManagement } from "@/components/Transactions/TransactionManagement";
import SEO from "@/components/SEO";

export default function TransactionsPage() {
  return (
    <>
      <SEO title="Transactions | SA Finance Manager" description="Manage and track all transactions" />
      <DashboardLayout>
        <TransactionManagement />
      </DashboardLayout>
    </>
  );
}
