import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { TrialBalanceManager } from "@/components/TrialBalance/TrialBalanceManager";

const Index = () => {
  return (
    <DashboardLayout>
      <TrialBalanceManager />
    </DashboardLayout>
  );
};

export default Index;