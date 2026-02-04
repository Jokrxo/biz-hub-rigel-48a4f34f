import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { SalesCustomers } from "@/components/Sales/SalesCustomers";
import SEO from "@/components/SEO";

export default function CustomersPage() {
  return (
    <>
      <SEO title="Customers | LuthandoERP" description="Manage customers" />
      <DashboardLayout>
        <SalesCustomers />
      </DashboardLayout>
    </>
  );
}
