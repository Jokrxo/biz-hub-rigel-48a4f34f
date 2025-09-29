import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { TrialBalanceManager } from "@/components/TrialBalance/TrialBalanceManager";
import SEO from "@/components/SEO";

export default function TrialBalancePage() {
  return (
    <>
      <SEO title="Trial Balance | SA Finance Manager" description="Manage your trial balance entries" />
      <DashboardLayout>
        <TrialBalanceManager />
      </DashboardLayout>
    </>
  );
}
