import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { BudgetManagement } from "@/components/Budget/BudgetManagement";

export default function BudgetPage() {
  return (
    <>
      <SEO title="Budget | ApexAccounts" description="Manage budgets and track spending" />
      <DashboardLayout>
        <BudgetManagement />
      </DashboardLayout>
    </>
  );
}