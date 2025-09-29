import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { FinancialReports } from "@/components/FinancialReports/FinancialReports";
import SEO from "@/components/SEO";

export default function ReportsPage() {
  return (
    <>
      <SEO title="Reports | SA Finance Manager" description="Financial reports and statements" />
      <DashboardLayout>
        <FinancialReports />
      </DashboardLayout>
    </>
  );
}
