import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, Info, ExternalLink, Globe, Star, Mail, Phone, Server, Cpu, Database } from "lucide-react";
import logo from "@/assets/stellkhygugvyt.jpg";

const About = () => {
  const appVersion = (import.meta as any).env?.VITE_APP_VERSION || "2025.12.04";
  const buildDate = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });

  // Matching License.tsx pricing
  const tiers = [
    { 
      name: 'Basic', 
      price: 'R250', 
      desc: 'Essentials for small teams.', 
      features: ['Single User License', 'Basic Financial Reports', 'Email Support', '1GB Storage'],
      color: 'bg-blue-500',
      text: 'text-blue-600'
    },
    { 
      name: 'Pro', 
      price: 'R300', 
      desc: 'Advanced features for growth.', 
      features: ['Up to 5 Users', 'Advanced Analytics', 'Priority Email Support', '10GB Storage'],
      popular: true,
      color: 'bg-indigo-500',
      text: 'text-indigo-600'
    },
    { 
      name: 'Enterprise', 
      price: 'R350', 
      desc: 'Full suite for organizations.', 
      features: ['Unlimited Users', 'Dedicated Account Manager', '24/7 Phone Support', 'Unlimited Storage'],
      color: 'bg-purple-500',
      text: 'text-purple-600'
    },
  ];

  return (
    <>
      <SEO title="About | Rigel Business" description="System information and licensing details" />
      <DashboardLayout>
        <div className="space-y-8">
          
          {/* Hero Header */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light"></div>
            <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none overflow-hidden">
              <img src={logo} alt="" className="h-full w-full object-cover mix-blend-overlay opacity-50 mask-image-gradient" style={{ maskImage: 'linear-gradient(to left, black, transparent)' }} />
            </div>
            <div className="relative z-10 flex items-center gap-6">
              <div className="bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                <img src="/logo.png" alt="Rigel Business" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">Rigel Business</h1>
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm">
                    v{appVersion}
                  </Badge>
                </div>
                <p className="text-slate-300 mt-2 text-lg">Next-generation financial management for South African businesses.</p>
              </div>
            </div>
            <div className="relative z-10 flex gap-3">
              <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                <a href="https://stella-lumen.com" target="_blank" rel="noreferrer">
                  <Globe className="mr-2 h-4 w-4" /> Website
                </a>
              </Button>
              <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white border-0 shadow-lg shadow-blue-500/20" asChild>
                <a href="/license">
                  <Star className="mr-2 h-4 w-4" /> Manage License
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* System Info */}
            <Card className="card-professional lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Server className="h-5 w-5 text-slate-700" />
                  </div>
                  <CardTitle>System Information</CardTitle>
                </div>
                <CardDescription>Technical details about your current environment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <div className="text-sm text-muted-foreground mb-1">Build Version</div>
                      <div className="font-mono font-medium">{appVersion}-stable</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <div className="text-sm text-muted-foreground mb-1">Release Date</div>
                      <div className="font-medium">{buildDate}</div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <div className="text-sm text-muted-foreground mb-1">Environment</div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-medium">Production (Secure)</span>
                      </div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border">
                      <div className="text-sm text-muted-foreground mb-1">Database Status</div>
                      <div className="flex items-center gap-2">
                        <Database className="h-3 w-3 text-emerald-600" />
                        <span className="font-medium text-emerald-700">Connected & Synced</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    Core Technologies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="px-3 py-1 bg-slate-50">React 18</Badge>
                    <Badge variant="outline" className="px-3 py-1 bg-slate-50">TypeScript 5</Badge>
                    <Badge variant="outline" className="px-3 py-1 bg-slate-50">Supabase</Badge>
                    <Badge variant="outline" className="px-3 py-1 bg-slate-50">Vite</Badge>
                    <Badge variant="outline" className="px-3 py-1 bg-slate-50">Tailwind CSS</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Developer Card */}
            <Card className="card-professional h-full flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Shield className="h-5 w-5 text-indigo-600" />
                  </div>
                  <CardTitle>Developer</CardTitle>
                </div>
                <CardDescription>Powered by Stella Lumen</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <img src={logo} alt="Stella Lumen" className="w-24 h-24 rounded-full border-4 border-slate-100 shadow-xl mb-4" />
                  <h3 className="text-xl font-bold text-slate-900">Stella Lumen</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-[200px]">
                    Innovating financial software for the modern African enterprise.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button variant="outline" className="w-full text-xs" asChild>
                    <a href="mailto:support@stella-lumen.com">
                      <Mail className="mr-2 h-3 w-3" /> Support
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full text-xs" asChild>
                    <a href="https://stella-lumen.com" target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-3 w-3" /> Visit
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pricing Tiers (Matching License Module) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Available License Tiers</h2>
              <Button variant="ghost" className="text-primary" asChild>
                <a href="/license">View Full Details <ExternalLink className="ml-2 h-4 w-4" /></a>
              </Button>
            </div>
            
            <div className="grid gap-6 md:grid-cols-3">
              {tiers.map((tier) => (
                <Card key={tier.name} className={`relative flex flex-col transition-all hover:shadow-lg ${tier.popular ? 'border-primary shadow-md' : ''}`}>
                   {tier.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-medium shadow-sm">
                      Recommended
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      {tier.name}
                      <span className={`text-lg ${tier.text}`}>{tier.price}<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
                    </CardTitle>
                    <CardDescription>{tier.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-2 mb-4">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${tier.text}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Release Notes */}
          <Card className="card-professional">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Info className="h-5 w-5 text-orange-600" />
                </div>
                <CardTitle>Release Notes: {appVersion}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 list-disc pl-4">
                  <li><strong>Cash Flow Analytics:</strong> Comparative year-over-year working capital reporting.</li>
                  <li><strong>VAT Compliance:</strong> Enhanced validation for South African tax formatting.</li>
                  <li><strong>Stella Advisor:</strong> AI-driven insights for debtors and tax obligations.</li>
                  <li><strong>Data Export:</strong> Multi-sheet Excel backups for full system portability.</li>
                  <li><strong>Security:</strong> Advanced IP whitelisting and audit trail logging.</li>
                  <li><strong>Performance:</strong> Optimized database queries for faster transaction loading.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-center pt-4 opacity-50">
             <img src="/Modern Rigel Business Logo Design.png" alt="Rigel" className="h-6 w-6 grayscale mr-2" />
             <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} Rigel Business. All rights reserved.</span>
          </div>

        </div>
      </DashboardLayout>
    </>
  );
};

export default About;
