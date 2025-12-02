import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const genKey = () => {
  const s = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${s()}-${s()}-${s()}-${s()}`;
};

export default function LicenseAdmin() {
  const [plan, setPlan] = useState("Monthly");
  const [licenseKey, setLicenseKey] = useState(genKey());
  const [expiry, setExpiry] = useState("");

  async function save() {
    try {
      const payload = { license_key: licenseKey, plan_type: plan, status: 'UNUSED', expiry_date: expiry || null };
      await supabase.from('licenses').insert(payload);
      toast({ title: 'License', description: 'License key generated' });
      setLicenseKey(genKey());
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Could not save license', variant: 'destructive' });
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin • Generate License</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Plan Type</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Annual">Annual</SelectItem>
                  <SelectItem value="Lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>License Key</Label>
              <Input value={licenseKey} onChange={e => setLicenseKey(e.target.value)} />
            </div>
            <div>
              <Label>Expiry Date (optional)</Label>
              <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setLicenseKey(genKey())}>Generate</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

