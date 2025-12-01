import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import logo from "@/assets/stellkhygugvyt.jpg";

const About = () => {
  const aboutUrl = "https://stella-lumen.com/about-us";

  return (
    <>
      <SEO title="About Us | Rigel Business" description="About Stella Lumen and vision" />
      <DashboardLayout>
        <div className="space-y-8">
          <Card className="bg-gradient-to-br from-neutral-900/20 to-background dark:from-neutral-900/40">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={logo} alt="Stella Lumen" className="w-16 h-16 rounded object-cover border" />
                  <div>
                    <h1 className="text-3xl font-bold">Stella Lumen</h1>
                    <p className="text-muted-foreground">Simple business solutions, professional delivery</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={aboutUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline">Visit Website</Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="card-professional">
              <CardHeader>
                <CardTitle>Company Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Formed in 2020 Stella Lumen focuses on providing simple business solutions to respond to various challenges faced by our clients. Collectively its management has over 30 years of experience in financial management, governance, risk management and related disciplines.
                </p>
                <p className="mt-3">
                  Stella Lumen specializes in the conceptualization and development of software and provides easy to use solutions in the following areas:
                </p>
                <Separator className="my-4" />
                <div className="text-sm">
                  <div className="font-semibold">Vision</div>
                  <div className="text-muted-foreground mt-1">Vision 1</div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-professional">
              <CardHeader>
                <CardTitle>Quick Access</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded flex items-center gap-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(aboutUrl)}`}
                    alt="QR code to access About Us on phone"
                    className="w-28 h-28"
                  />
                  <div>
                    <div className="font-medium">Scan to access on phone</div>
                    <a href={aboutUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      {aboutUrl}
                    </a>
                    <div className="mt-2 text-xs text-muted-foreground">
                      • Share with your team<br />
                      • Always up-to-date details<br />
                      • Fast mobile access
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <img src={logo} alt="Stella Lumen" className="h-5 w-5 rounded object-cover border" />
            <span>Powered by Stella Lumen</span>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default About;
