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
import { OpeningBalancesAdjustments } from "@/components/Settings/OpeningBalancesAdjustments";
import { CommunicationSettings } from "@/components/Settings/CommunicationSettings";
import { TaxAndInvoicingSettings } from "@/components/Settings/TaxAndInvoicingSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info, Building2, Settings2, Users, Database, Shield, Palette, Scale, ChevronRight, Calculator, Mail } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("company");
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

  const tabs = [
    { id: "company", label: "Company Profile", icon: Building2, desc: "Manage business details & branding" },
    { id: "general", label: "Preferences", icon: Settings2, desc: "System defaults & localization" },
    { id: "tax_invoice", label: "Tax & Invoicing", icon: Calculator, desc: "VAT rates, currency & prefixes" },
    { id: "communication", label: "Email & Templates", icon: Mail, desc: "Notifications & document emails" },
    { id: "administration", label: "Team & Roles", icon: Users, desc: "Manage users and permissions" },
    { id: "data", label: "Data Management", icon: Database, desc: "Backup, restore & imports" },
    { id: "security", label: "Security", icon: Shield, desc: "Password policy & sessions" },
    { id: "theme", label: "Appearance", icon: Palette, desc: "Theme & visual customization" },
    { id: "adjustment", label: "Opening Balances", icon: Scale, desc: "Adjust historical financial data" },
  ];

  return (
    <>
      <SEO title="Settings | Rigel Business" description="Company settings and preferences" />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light"></div>
            <div className="relative z-10">
              <h1 className="text-3xl font-bold tracking-tight">Settings & Configuration</h1>
              <p className="text-slate-300 mt-2 text-lg max-w-2xl">
                Manage your organization's profile, system preferences, and security controls from a central hub.
              </p>
            </div>
            <div className="relative z-10">
              <Button variant="secondary" className="shadow-lg hover:shadow-xl transition-all" onClick={() => setTutorialOpen(true)}>
                <Info className="h-4 w-4 mr-2" />
                Help Guide
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-72 flex-shrink-0">
              <Card className="p-2 card-professional sticky top-6">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 group",
                        activeTab === tab.id 
                          ? "bg-primary text-primary-foreground shadow-md" 
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          activeTab === tab.id ? "bg-white/20" : "bg-muted group-hover:bg-background"
                        )}>
                          <tab.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{tab.label}</div>
                        </div>
                      </div>
                      {activeTab === tab.id && <ChevronRight className="h-4 w-4 opacity-50" />}
                    </button>
                  ))}
                </nav>
              </Card>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    {tabs.find(t => t.id === activeTab)?.icon && (() => {
                      const Icon = tabs.find(t => t.id === activeTab)!.icon;
                      return <Icon className="h-6 w-6 text-primary" />;
                    })()}
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    {tabs.find(t => t.id === activeTab)?.desc}
                  </p>
                </div>

                <div className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                  <TabsContent value="company" className="mt-0">
                    <CompanySettings />
                  </TabsContent>
                  
                  <TabsContent value="general" className="mt-0">
                    <GeneralSettings />
                  </TabsContent>
                  
                  <TabsContent value="tax_invoice" className="mt-0">
                    <TaxAndInvoicingSettings />
                  </TabsContent>

                  <TabsContent value="communication" className="mt-0">
                    <CommunicationSettings />
                  </TabsContent>

                  <TabsContent value="administration" className="mt-0">
                    <AdministrationSettings />
                  </TabsContent>
                  
                  <TabsContent value="data" className="mt-0">
                    <DataManagement />
                  </TabsContent>

                  <TabsContent value="security" className="mt-0">
                    <SecuritySettings />
                  </TabsContent>

                  <TabsContent value="theme" className="mt-0">
                    <ThemeSettings />
                  </TabsContent>

                  <TabsContent value="adjustment" className="mt-0">
                    <OpeningBalancesAdjustments />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>

          <Dialog open={tutorialOpen} onOpenChange={setTutorialOpen}>
            <DialogContent className="sm:max-w-[640px] p-4">
              <DialogHeader>
                <DialogTitle>Settings Tutorial</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>Use the sidebar to navigate between different configuration categories.</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  <li><strong>Company Profile:</strong> Update logo, address, and contact info.</li>
                  <li><strong>Preferences:</strong> Set date formats, notifications, and language.</li>
                  <li><strong>Team & Roles:</strong> Invite users and assign permissions.</li>
                  <li><strong>Data:</strong> Backup your database or restore from a file.</li>
                </ul>
              </div>
              <div className="pt-4">
                <Button onClick={() => setTutorialOpen(false)} className="w-full bg-gradient-primary">Got it</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </>
  );
}
