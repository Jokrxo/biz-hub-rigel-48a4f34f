import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { Key, RefreshCw, CheckCircle2, Clock, Users, Calendar, Shield, CreditCard, Star, Mail, Phone, Info, Download } from "lucide-react";
import jsPDF from "jspdf";

const mask = (key: string) => key ? `${key.slice(0,4)}-****-****-${key.slice(-4)}` : "—";
// South Africa WhatsApp number (country code 27, remove leading 0)
const whatsapp = (plan: string) => `https://wa.me/27790120072?text=${encodeURIComponent(`Request License: ${plan}`)}`;
const mailto = (plan: string) => `mailto:license@stella-lumen.com?subject=${encodeURIComponent(`License Request: ${plan}`)}&body=${encodeURIComponent('Please share pricing and next steps.')}`;

export default function License() {
  const [licenseKey, setLicenseKey] = useState("");
  const [status, setStatus] = useState<{ plan?: string; status?: string; expiry?: string; key?: string }>({});
  const [seats, setSeats] = useState<{ used: number; available: string }>({ used: 0, available: 'Unlimited (prototype)' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { void loadStatus(); }, []);

  async function loadStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('subscription_status, plan, subscription_expiry, license_key, company_id').eq('user_id', user.id).maybeSingle();
      setStatus({ plan: profile?.plan || 'Prototype', status: profile?.subscription_status || 'OPEN', expiry: profile?.subscription_expiry || '—', key: profile?.license_key || '' });
      if (profile?.company_id) {
        const { count } = await supabase.from('profiles').select('id', { count: 'exact' }).eq('company_id', profile.company_id).limit(1);
        setSeats({ used: (count as number) || 1, available: 'Unlimited (prototype)' });
      }
    } catch {}
  }

  async function activateLicense() {
    setLoading(true);
    try {
      const key = licenseKey.trim();
      if (!key) { toast({ title: 'License', description: 'Enter a license key', variant: 'destructive' }); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: 'License', description: 'Not authenticated', variant: 'destructive' }); return; }
      const { data: found } = await supabase.from('licenses').select('id, plan_type, status, expiry_date').eq('license_key', key).limit(1);
      const lic = (found || [])[0];
      if (!lic) { toast({ title: 'License', description: 'Invalid license key', variant: 'destructive' }); return; }
      if (String(lic.status || '').toUpperCase() === 'ACTIVE') { toast({ title: 'License', description: 'License already active', variant: 'destructive' }); return; }
      await supabase.from('licenses').update({ status: 'ACTIVE', assigned_user_id: user.id }).eq('id', lic.id);
      const plan = lic.plan_type || 'Professional';
      const expiry = lic.expiry_date || null;
      await supabase.from('profiles').update({ subscription_status: 'ACTIVE', plan, subscription_expiry: expiry, license_key: key }).eq('user_id', user.id);
      toast({ title: 'License', description: 'License activated' });
      setStatus({ plan, status: 'ACTIVE', expiry: expiry || '—', key });
      setLicenseKey('');
    } catch (e: any) {
      toast({ title: 'License error', description: e?.message || 'Activation failed', variant: 'destructive' });
    } finally { setLoading(false); }
  }

  const downloadCertificate = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Background Color
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(0, 0, 210, 297, 'F');

      // --- Watermarks ---
      // Stella Lumen Watermark (Top Right)
      const logoSize = 60;
      doc.addImage(logo, 'PNG', 140, 10, logoSize, logoSize, undefined, 'FAST');
      
      // Rigel Business Watermark (Center Page - Faded)
      doc.setFontSize(80);
      doc.setTextColor(200, 200, 200);
      doc.saveGraphicsState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
      doc.text("RIGEL BUSINESS", 105, 150, { align: "center", angle: 45 });
      doc.restoreGraphicsState();

      // --- Header Content ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("License Certificate", 20, 40);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Proof of Subscription & Usage Rights", 20, 48);

      // Separator Line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(20, 55, 190, 55);

      // --- License Details Section ---
      const startY = 70;
      const lineHeight = 12;

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont("helvetica", "bold");
      doc.text("License Information", 20, startY);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      // Row 1: Plan
      doc.setTextColor(100, 116, 139);
      doc.text("Subscription Plan:", 20, startY + lineHeight);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.text(status.plan || "Prototype", 80, startY + lineHeight);

      // Row 2: Status
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text("License Status:", 20, startY + (lineHeight * 2));
      doc.setTextColor(22, 163, 74); // green-600
      doc.setFont("helvetica", "bold");
      doc.text((status.status || "OPEN").toUpperCase(), 80, startY + (lineHeight * 2));

      // Row 3: Product Key
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text("Product Key:", 20, startY + (lineHeight * 3));
      doc.setTextColor(15, 23, 42);
      doc.setFont("courier", "bold");
      doc.text(status.key || "Not Activated", 80, startY + (lineHeight * 3));

      // Row 4: Expiry
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Valid Until:", 20, startY + (lineHeight * 4));
      doc.setTextColor(15, 23, 42);
      doc.text(status.expiry && status.expiry !== '—' ? new Date(status.expiry).toLocaleDateString() : 'Lifetime / Indefinite', 80, startY + (lineHeight * 4));

      // --- Footer Section ---
      const footerY = 250;
      doc.setDrawColor(226, 232, 240);
      doc.line(20, footerY, 190, footerY);

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("Powered by Stella Lumen", 105, footerY + 10, { align: "center" });
      doc.text("www.stella-lumen.com", 105, footerY + 16, { align: "center" });
      
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 280);

      doc.save("Rigel_License_Certificate.pdf");
      toast({ title: "Certificate Downloaded", description: "Your license proof has been saved." });
    } catch (e) {
      console.error(e);
      toast({ title: "Download Failed", description: "Could not generate PDF.", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light"></div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20">
              <img 
                src="/Modern Rigel Business Logo Design.png" 
                alt="Rigel Business" 
                className="w-14 h-14 object-cover rounded-xl"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">License Management</h1>
              <p className="text-blue-100 mt-2 text-lg">Manage your subscription, activate licenses, and view plan details.</p>
            </div>
          </div>
          <div className="relative z-10 flex gap-4">
            <Button variant="secondary" className="shadow-lg hover:shadow-xl transition-all" onClick={loadStatus}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Status
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="card-professional border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <div className="text-2xl font-bold">{status.plan || 'Prototype'}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active subscription tier</p>
            </CardContent>
          </Card>
          <Card className="card-professional border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">License Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-5 w-5 ${status.status === 'ACTIVE' ? 'text-green-500' : 'text-muted-foreground'}`} />
                <div className="text-2xl font-bold capitalize">{status.status?.toLowerCase() || 'Open'}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">System access level</p>
            </CardContent>
          </Card>
          <Card className="card-professional border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expiry Date</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div className="text-2xl font-bold">{status.expiry && status.expiry !== '—' ? new Date(status.expiry).toLocaleDateString() : '—'}</div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Valid until</p>
            </CardContent>
          </Card>
          <Card className="card-professional border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Seats Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div className="text-2xl font-bold">{seats.used} <span className="text-sm font-normal text-muted-foreground">/ {seats.available}</span></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active users</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activation Panel */}
          <Card className="lg:col-span-2 card-professional">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Activate License</CardTitle>
                  <CardDescription>Enter your product key to unlock features</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/30 p-6 rounded-xl border border-dashed border-muted-foreground/25">
                <div className="flex flex-col gap-4">
                  <Label htmlFor="licenseKey" className="text-base font-medium">Product Key</Label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="licenseKey"
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        className="pl-10 h-12 text-lg font-mono tracking-widest uppercase"
                      />
                    </div>
                    <Button 
                      onClick={activateLicense} 
                      disabled={loading} 
                      size="lg"
                      className="bg-gradient-primary shadow-lg hover:shadow-xl transition-all px-8"
                    >
                      {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Activate
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Your license key is sent to your registered email address upon purchase.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-card hover:bg-accent/5 transition-colors">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    Active Protection
                  </h4>
                  <p className="text-sm text-muted-foreground">Your current session is secured. Prototype mode allows full exploration of features.</p>
                </div>
                <div className="p-4 rounded-xl border bg-card hover:bg-accent/5 transition-colors">
                  <h4 className="font-semibold flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    Billing & Invoices
                  </h4>
                  <p className="text-sm text-muted-foreground">Manage your billing details and download past invoices from the settings menu.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current License Details Side Panel */}
          <Card className="card-professional bg-gradient-to-b from-slate-50 to-white">
            <CardHeader>
              <CardTitle>License Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={status.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {status.status || 'OPEN'}
                  </Badge>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">Product Key</span>
                  <span className="font-mono text-sm font-medium">{mask(status.key || '')}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">Activated On</span>
                  <span className="text-sm font-medium">{status.status === 'ACTIVE' ? new Date().toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-dashed">
                  <span className="text-sm text-muted-foreground">Company ID</span>
                  <span className="text-xs font-mono text-muted-foreground truncate max-w-[120px]" title="Company ID">
                    {/* We could fetch this if needed, for now placeholder */}
                    Rigel Business
                  </span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={downloadCertificate}
              >
                <Download className="mr-2 h-4 w-4" /> Download Certificate
              </Button>
              
              <div className="pt-4">
                <img src={logo} alt="Stella Lumen" className="w-full h-auto rounded-lg border opacity-90" />
                <p className="text-xs text-center text-muted-foreground mt-2">Powered by Stella Lumen</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Plans */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground mt-2">Choose the plan that best fits your business needs. Upgrade or downgrade at any time.</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { 
                name: 'Basic', 
                price: 'R250', 
                period: '/month',
                desc: 'Essentials for small teams getting started.', 
                features: ['Single User License', 'Basic Financial Reports', 'Email Support', '1GB Storage'],
                popular: false,
                color: 'blue'
              },
              { 
                name: 'Pro', 
                price: 'R300', 
                period: '/month',
                desc: 'Advanced features for growing businesses.', 
                features: ['Up to 5 Users', 'Advanced Analytics', 'Priority Email Support', '10GB Storage', 'Custom Invoicing'],
                popular: true,
                color: 'indigo'
              },
              { 
                name: 'Enterprise', 
                price: 'R350', 
                period: '/month',
                desc: 'Full suite for established organizations.', 
                features: ['Unlimited Users', 'Dedicated Account Manager', '24/7 Phone Support', 'Unlimited Storage', 'API Access'],
                popular: false,
                color: 'purple'
              },
            ].map((p) => (
              <Card key={p.name} className={`relative flex flex-col h-full transition-all duration-200 hover:shadow-xl ${p.popular ? 'border-primary shadow-lg scale-105 z-10' : 'border-border'}`}>
                {p.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium shadow-sm">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl font-bold">{p.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-extrabold tracking-tight">{p.price}</span>
                    <span className="text-muted-foreground font-medium">{p.period}</span>
                  </div>
                  <CardDescription className="mt-2">{p.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3 mb-6">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <CheckCircle2 className={`h-5 w-5 ${p.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-6 pt-0 mt-auto">
                  <div className="grid gap-3">
                    <Button asChild className={`w-full ${p.popular ? 'bg-gradient-primary shadow-md' : ''}`} variant={p.popular ? 'default' : 'outline'}>
                      <a href={mailto(p.name)}>
                        <Mail className="mr-2 h-4 w-4" /> Request via Email
                      </a>
                    </Button>
                    <Button asChild variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                      <a href={whatsapp(p.name)} target="_blank" rel="noreferrer">
                        <Phone className="mr-2 h-4 w-4" /> Chat on WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
