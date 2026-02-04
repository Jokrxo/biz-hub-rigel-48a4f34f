import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { SalesInvoices } from "@/components/Sales/SalesInvoices";
import SEO from "@/components/SEO";

export default function InvoicesPage() {
  return (
    <>
      <SEO title="Invoices | LuthandoERP" description="Manage invoices" />
      <DashboardLayout>
        <SalesInvoices />
      </DashboardLayout>
    </>
  );
}
