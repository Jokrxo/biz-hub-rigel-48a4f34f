import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { CompanySettings } from "@/components/Company/CompanySettings";

export default function SettingsPage() {
  return (
    <>
      <SEO title="Settings | ApexAccounts" description="Company settings and preferences" />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage company information and preferences</p>
          </div>

          <CompanySettings />
        </div>
      </DashboardLayout>
    </>
  );
}
