import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const GeneralSettings = () => {
  const [settings, setSettings] = useState({
    theme: "light",
    dateFormat: "DD/MM/YYYY",
    fiscalYearStart: "1",
    enableNotifications: true,
    enableAutoBackup: false,
    language: "en",
  });
  const { toast } = useToast();

  const handleSave = () => {
    localStorage.setItem("appSettings", JSON.stringify(settings));
    toast({ title: "Success", description: "General settings saved successfully" });
  };

  useEffect(() => {
    const saved = localStorage.getItem("appSettings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

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
