import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { EnhancedFinancialReports } from "@/components/FinancialReports/EnhancedFinancialReports";
import SEO from "@/components/SEO";

export default function ReportsPage() {
  return (
    <>
      <SEO title="Financial Reports | ApexAccounts" description="GAAP-compliant annual financial statements with drill-down capabilities" />
      <DashboardLayout>
        <EnhancedFinancialReports />
      </DashboardLayout>
    </>
  );
}
