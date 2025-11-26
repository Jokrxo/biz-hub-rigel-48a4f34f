import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { CompanySettings } from "@/components/Company/CompanySettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettings } from "@/components/Settings/GeneralSettings";
import { AdministrationSettings } from "@/components/Settings/AdministrationSettings";
import { DataManagement } from "@/components/Settings/DataManagement";
import { ThemeSettings } from "@/components/Settings/ThemeSettings";
import { SecuritySettings } from "@/components/Settings/SecuritySettings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    const key = `tutorial_shown_settings_${uid}`;
    const already = localStorage.getItem(key);
    if (!already) {
      setTutorialOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);
  return (
    <>
      <SEO title="Settings | Rigel Business" description="Company settings and preferences" />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage company information and preferences</p>
            </div>
            <Button variant="outline" onClick={() => setTutorialOpen(true)}>
              <Info className="h-4 w-4 mr-2" />
              Help & Tutorial
            </Button>
          </div>

          <Tabs defaultValue="company" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="company">Company Settings</TabsTrigger>
              <TabsTrigger value="general">General Settings</TabsTrigger>
              <TabsTrigger value="administration">Administration</TabsTrigger>
              <TabsTrigger value="data">Data Management</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="theme">Theme</TabsTrigger>
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
            
            <TabsContent value="data" className="space-y-4">
              <DataManagement />
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <SecuritySettings />
            </TabsContent>

            <TabsContent value="theme" className="space-y-4">
              <ThemeSettings />
            </TabsContent>
          </Tabs>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Settings Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Use this module to configure company details and application preferences.</p>
                <p>Tabs include company information, general settings, administration, and data management.</p>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)}>Got it</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
