import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { SalesReceipts } from "@/components/Sales/SalesReceipts";
import SEO from "@/components/SEO";

export default function ReceiptsPage() {
  return (
    <>
      <SEO title="Receipts | LuthandoERP" description="Manage receipts" />
      <DashboardLayout>
        <SalesReceipts />
      </DashboardLayout>
    </>
  );
}
