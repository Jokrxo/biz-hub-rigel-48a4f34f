import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { hasSupabaseEnv } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";

export const GeneralSettings = () => {
  const [settings, setSettings] = useState({
    theme: "light",
    dateFormat: "DD/MM/YYYY",
    fiscalYearStart: "1",
    enableNotifications: true,
    enableAutoBackup: false,
    language: "en",
    invoiceTemplate: "template1",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const applyTheme = (theme: string) => {
    const root = document.documentElement;
    ["theme-corp-blue","theme-fintech-green","theme-premium-navy","theme-neutral-enterprise","theme-dark-pro","theme-exec-gold","theme-ocean-gradient","theme-purple-digital","theme-tech-silver","theme-eco-green"].forEach(c => root.classList.remove(c));
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.add('theme-dark-pro');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (theme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) { root.classList.add('dark'); root.classList.add('theme-dark-pro'); }
      else { root.classList.remove('dark'); }
    }
  };

  const handleSave = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (!profile?.company_id) throw new Error('Profile not found');
      const payload = {
        company_id: profile.company_id,
        theme: settings.theme,
        date_format: settings.dateFormat,
        fiscal_year_start: parseInt(settings.fiscalYearStart || '1'),
        enable_notifications: settings.enableNotifications,
        enable_auto_backup: settings.enableAutoBackup,
        language: settings.language,
        updated_at: new Date().toISOString(),
      };
      const existing = await supabase
        .from('app_settings')
        .select('id')
        .eq('company_id', profile.company_id)
        .maybeSingle();
      const { error } = existing.data
        ? await supabase.from('app_settings').update(payload).eq('id', existing.data.id)
        : await supabase.from('app_settings').insert(payload);
      if (error) throw error;
      localStorage.setItem('appSettings', JSON.stringify(settings));
      applyTheme(settings.theme);
      toast({ title: 'Success', description: 'General settings saved successfully' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save settings', variant: 'destructive' });
    }
  }, [settings, user?.id, toast]);

  const init = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user?.id)
        .maybeSingle();
      const savedLocal = localStorage.getItem('appSettings');
      let next = settings;
      if (profile?.company_id) {
        const { data } = await supabase
          .from('app_settings')
          .select('*')
          .eq('company_id', profile.company_id)
          .maybeSingle();
      if (data) {
        next = {
          theme: (data as any).theme || 'light',
          dateFormat: (data as any).date_format || 'DD/MM/YYYY',
          fiscalYearStart: String((data as any).fiscal_year_start || 1),
          enableNotifications: !!(data as any).enable_notifications,
          enableAutoBackup: !!(data as any).enable_auto_backup,
          language: (data as any).language || 'en',
          invoiceTemplate: (JSON.parse(localStorage.getItem('appSettings') || '{}')?.invoiceTemplate) || 'template1',
        };
      }
      } else if (savedLocal) {
        next = JSON.parse(savedLocal);
      }
      setSettings(next);
      applyTheme(next.theme);
    } catch {}
  }, [settings, user?.id]);
  useEffect(() => { init(); }, [init]);

  const [supUrl, setSupUrl] = useState("");
  const [supKey, setSupKey] = useState("");
  const saveSupabaseConfig = () => {
    try {
      localStorage.setItem('supabase_url', supUrl);
      localStorage.setItem('supabase_anon_key', supKey);
      toast({ title: 'Saved', description: 'Supabase configured. Reloading…' });
      setTimeout(() => { window.location.reload(); }, 500);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to configure Supabase', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          General Settings
        </CardTitle>
        <CardDescription>Configure application preferences and defaults</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label>Theme</Label>
            <Select value={settings.theme} onValueChange={(val) => setSettings({ ...settings, theme: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date Format</Label>
            <Select value={settings.dateFormat} onValueChange={(val) => setSettings({ ...settings, dateFormat: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Invoice Template</Label>
            <Select value={settings.invoiceTemplate} onValueChange={(val) => setSettings({ ...settings, invoiceTemplate: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="template1">Template 1 (Classic)</SelectItem>
                <SelectItem value="template2">Template 2 (Modern)</SelectItem>
                <SelectItem value="template3" disabled>Template 3 (Advanced • Locked)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Language</Label>
            <Select value={settings.language} onValueChange={(val) => setSettings({ ...settings, language: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="af">Afrikaans</SelectItem>
                <SelectItem value="zu">Zulu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fiscal Year Start Month</Label>
            <Select value={settings.fiscalYearStart} onValueChange={(val) => setSettings({ ...settings, fiscalYearStart: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label>Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">Receive system notifications</p>
            </div>
            <Switch
              checked={settings.enableNotifications}
              onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Auto Backup</Label>
              <p className="text-sm text-muted-foreground">Automatic daily database backup</p>
            </div>
            <Switch
              checked={settings.enableAutoBackup}
              onCheckedChange={(checked) => setSettings({ ...settings, enableAutoBackup: checked })}
            />
          </div>
        </div>

        <Button onClick={handleSave} className="w-full bg-gradient-primary">
          <Save className="h-4 w-4 mr-2" />
          Save General Settings
        </Button>
      </CardContent>
    </Card>
  );
};
