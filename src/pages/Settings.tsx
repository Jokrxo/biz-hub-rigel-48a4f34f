import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { CompanySettings } from "@/components/Company/CompanySettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/Settings/GeneralSettings";
import { AdministrationSettings } from "@/components/Settings/AdministrationSettings";

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

          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="company">Company Settings</TabsTrigger>
              <TabsTrigger value="general">General Settings</TabsTrigger>
              <TabsTrigger value="administration">Administration</TabsTrigger>
            </TabsList>
            
            <TabsContent value="company" className="space-y-4">
              <CompanySettings />
            </TabsContent>
            
            <TabsContent value="general" className="space-y-4">
              <GeneralSettings />
            </TabsContent>
            
            <TabsContent value="administration" className="space-y-4">
              <AdministrationSettings />
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </>
  );
}
