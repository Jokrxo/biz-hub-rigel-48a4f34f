import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { DashboardOverview } from "@/components/Dashboard/DashboardOverview";
import SEO from "@/components/SEO";

const Index = () => {
  return (
    <>
      <SEO title="Dashboard | ApexAccounts" description="ApexAccounts dashboard with real-time financial data" />
      <DashboardLayout>
        <DashboardOverview />
      </DashboardLayout>
    </>
  );
};

export default Index;