import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/src/assets/stellkhygugvyt.jpg" alt="Stella Lumen" className="h-10 w-10 rounded object-cover border" />
            <img src="/Modern Rigel Business Logo Design.png" alt="Rigel Business" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <div className="text-xl font-bold">License Management</div>
              <div className="text-xs text-muted-foreground">Activate your plan to enable production features</div>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>License Activation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="licenseKey">Enter License Key</Label>
                <Input id="licenseKey" placeholder="XXXX-XXXX-XXXX-XXXX" value={licenseKey} onChange={e => setLicenseKey(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={activateLicense} disabled={loading}>{loading ? 'Activating…' : 'Activate'}</Button>
                  <Button variant="outline" onClick={loadStatus}>Refresh Status</Button>
                </div>
                <div className="text-xs text-muted-foreground">Prototype mode: activation optional. All users can enter the app.</div>
                {(!status?.key || status.status === 'OPEN') && (
                  <div className="text-xs text-primary">Free tier enabled: view-only prototype access</div>
                )}
              </div>
              <div className="space-y-2">
                <div className="font-semibold">License Status</div>
                <Separator className="my-2" />
                <div className="text-sm">Plan Type: <span className="font-mono">{status.plan || 'Prototype (Free tier)'}</span></div>
                <div className="text-sm">Status: <span className="font-mono">{status.status || 'OPEN'}</span></div>
                <div className="text-sm">Expiry Date: <span className="font-mono">{status.expiry || '—'}</span></div>
                <div className="text-sm">License Key: <span className="font-mono">{mask(status.key || '')}</span></div>
                <Separator className="my-2" />
                <div className="text-sm">Seats Used: <span className="font-mono">{seats.used}</span></div>
                <div className="text-sm">Seats Available: <span className="font-mono">{seats.available}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[{ name: 'Free Tier', plan: 'Free', desc: 'Prototype • View-only access' }, { name: 'Monthly Plan', plan: 'Monthly', desc: 'Professional features' }, { name: 'Annual Plan', plan: 'Annual', desc: 'Professional features' }, { name: 'Lifetime Plan', plan: 'Lifetime', desc: 'Professional features' }].map(p => (
                <Card key={p.plan} className="h-full">
                  <CardContent className="p-4 h-full flex flex-col justify-between">
                    <div>
                      <div className="font-semibold mb-1">{p.name}</div>
                      <div className="text-xs text-muted-foreground mb-3">{p.desc}</div>
                      {p.plan !== 'Free' && (
                        <div className="text-[11px] text-muted-foreground">Seats Used: {seats.used} • Seats Available: {seats.available}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {p.plan === 'Free' ? (
                        <Button variant="outline" asChild><a href="/">Preview App</a></Button>
                      ) : (
                        <div className="flex flex-col gap-2 w-full">
                          <Button asChild className="w-full"><a href={mailto(p.plan)}>Request License (Email)</a></Button>
                          <Button variant="outline" asChild className="w-full"><a href={whatsapp(p.plan)} target="_blank" rel="noreferrer">WhatsApp</a></Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
