import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import logo from "@/assets/stellkhygugvyt.jpg";

const About = () => {
  const aboutUrl = "https://stella-lumen.com/about-us";
  const licensingUrl = "https://stella-lumen.com/licensing";
  const appVersion = (import.meta as any).env?.VITE_APP_VERSION || "2025.12";

  return (
    <>
      <SEO title="Version | Rigel Business" description="Rigel Business app version and licensing overview" />
      <DashboardLayout>
        <div className="space-y-8">
          <Card className="bg-gradient-to-br from-neutral-900/20 to-background dark:from-neutral-900/40">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <img src={logo} alt="Stella Lumen" className="w-12 h-12 rounded object-cover border" />
                    <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Business" className="w-12 h-12 rounded-lg object-cover" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Rigel Business</h1>
                    <p className="text-muted-foreground">Version {appVersion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={aboutUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline">Company Website</Button>
                  </a>
                  <a href={licensingUrl} target="_blank" rel="noreferrer">
                    <Button>Purchase Licence</Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="card-professional">
              <CardHeader>
                <CardTitle>Version & Licensing</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  This release of Rigel Business delivers professional financial management with guided reporting, smart assistance and comparative analytics. It is designed for non‑accountants with Plain‑English explanations across modules.
                </p>
                <p className="mt-3">
                  To use this version in production you must obtain a valid licence. Licences include support and updates for the covered period.
                </p>
                <Separator className="my-4" />
                <div className="text-sm">
                  <div className="font-semibold">Highlights</div>
                  <div className="text-muted-foreground mt-1">
                    • Cash flow with comparative year logic<br />
                    • Guided VAT and tax insights<br />
                    • Smart advisory for everyday finance tasks
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-professional">
              <CardHeader>
                <CardTitle>Quick Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded flex items-center gap-4">
                  <img src="/src/assets/stellkhygugvyt.jpg" alt="Stella Lumen" className="h-20 w-20 rounded object-cover border" />
                  <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Business" className="h-20 w-20 rounded-lg object-cover" />
                  <div>
                    <div className="font-medium">Purchase Licence</div>
                    <a href={licensingUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      {licensingUrl}
                    </a>
                    <div className="mt-2 text-xs text-muted-foreground">
                      • Professional support<br />
                      • Regular updates<br />
                      • Production use rights
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          

          <Card>
            <CardHeader>
              <CardTitle>Licence Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded">
                  <div className="font-semibold">Starter</div>
                  <div className="text-xs text-muted-foreground">For small teams</div>
                  <Separator className="my-3" />
                  <div className="text-sm">• Core reporting<br />• VAT basics<br />• Email support</div>
                </div>
                <div className="p-4 border rounded bg-primary/5">
                  <div className="font-semibold">Professional</div>
                  <div className="text-xs text-muted-foreground">Recommended</div>
                  <Separator className="my-3" />
                  <div className="text-sm">• Advisor & comparative<br />• Advanced exports<br />• Priority support</div>
                </div>
                <div className="p-4 border rounded">
                  <div className="font-semibold">Enterprise</div>
                  <div className="text-xs text-muted-foreground">For larger orgs</div>
                  <Separator className="my-3" />
                  <div className="text-sm">• Custom modules<br />• SLA & onboarding<br />• Dedicated support</div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <a href={licensingUrl} target="_blank" rel="noreferrer">
                  <Button>Choose a Licence</Button>
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Release Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                • Cash flow: comparative YOY working capital and totals<br />
                • VAT & validation: Rand formatting and period‑aware checks<br />
                • Stella Advisor: smarter responses with live data (debtors/VAT)<br />
                • Exports: comparative Excel/PDF for cash‑flow
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <img src={logo} alt="Stella Lumen" className="h-5 w-5 rounded object-cover border" />
            <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Business" className="h-5 w-5 rounded-lg object-cover" />
            <span>Rigel Business • Stella Lumen</span>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default About;
