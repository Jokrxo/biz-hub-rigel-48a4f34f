import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { SalesCreditNotes } from "@/components/Sales/SalesCreditNotes";
import SEO from "@/components/SEO";

export default function CreditNotesPage() {
  return (
    <>
      <SEO title="Credit Notes | LuthandoERP" description="Manage credit notes" />
      <DashboardLayout>
        <SalesCreditNotes />
      </DashboardLayout>
    </>
  );
}
