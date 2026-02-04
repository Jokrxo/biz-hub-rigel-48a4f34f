import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { SalesQuotes } from "@/components/Sales/SalesQuotes";
import SEO from "@/components/SEO";

export default function QuotesPage() {
  return (
    <>
      <SEO title="Quotations | LuthandoERP" description="Manage quotations" />
      <DashboardLayout>
        <SalesQuotes />
      </DashboardLayout>
    </>
  );
}
