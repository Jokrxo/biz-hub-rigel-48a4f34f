import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ThemeKey = "original" | "corp_blue" | "fintech_green" | "premium_navy" | "neutral_enterprise" | "dark_pro" | "exec_gold" | "ocean_gradient" | "purple_digital" | "tech_silver" | "eco_green";

const themes: Array<{ key: ThemeKey; name: string; className: string; description: string }>= [
  { key: "original", name: "Original SA Finance", className: "", description: "Professional SA finance palette" },
  { key: "corp_blue", name: "Corporate Blue Finance", className: "theme-corp-blue", description: "Deep blue, white, slate grey" },
  { key: "fintech_green", name: "Fintech Green Budgeting", className: "theme-fintech-green", description: "Teal/green with soft neutrals" },
  { key: "premium_navy", name: "Premium Navy + Teal Investment", className: "theme-premium-navy", description: "Dark navy with glowing teal" },
  { key: "neutral_enterprise", name: "Minimal Neutral Enterprise", className: "theme-neutral-enterprise", description: "Calm grey and white" },
  { key: "dark_pro", name: "Dark Mode Pro Accounting", className: "theme-dark-pro", description: "Charcoal with electric blue accents" },
  { key: "exec_gold", name: "Gold & Black Executive", className: "theme-exec-gold", description: "Luxury black + gold highlights" },
  { key: "ocean_gradient", name: "Ocean Blue Gradient Modern", className: "theme-ocean-gradient", description: "Soft teal→blue gradients" },
  { key: "purple_digital", name: "Purple Digital Banking", className: "theme-purple-digital", description: "Purple/indigo with neon accents" },
  { key: "tech_silver", name: "Tech Silver Neo-Glass", className: "theme-tech-silver", description: "Frosted glass silver/blue metallic" },
  { key: "eco_green", name: "Eco Green Earth-Lite", className: "theme-eco-green", description: "Soft green with brown undertones" },
];

export const ThemeSettings = () => {
  const [current, setCurrent] = useState<ThemeKey>("original");

  useEffect(() => {
    const saved = localStorage.getItem("app_theme") as ThemeKey | null;
    if (saved && themes.find(t => t.key === saved)) setCurrent(saved);
  }, []);

  const applyTheme = (key: ThemeKey) => {
    const html = document.documentElement;
    ["theme-corp-blue","theme-fintech-green","theme-premium-navy","theme-neutral-enterprise","theme-dark-pro","theme-exec-gold","theme-ocean-gradient","theme-purple-digital","theme-tech-silver","theme-eco-green"].forEach(c => html.classList.remove(c));
    const t = themes.find(t => t.key === key);
    if (t && t.className) html.classList.add(t.className);
    const isDarkFamily = key === "dark_pro" || key === "premium_navy" || key === "purple_digital";
    if (isDarkFamily) html.classList.add('dark'); else html.classList.remove('dark');
    localStorage.setItem("app_theme", key);
    setCurrent(key);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {themes.map(t => (
        <Card key={t.key} className={current === t.key ? "ring-2 ring-primary" : ""}>
          <CardHeader>
            <CardTitle className="text-base">{t.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">{t.description}</div>
            <div className="flex items-center gap-2">
              <Button variant={current === t.key ? "default" : "outline"} onClick={() => applyTheme(t.key)}>
                {current === t.key ? "Selected" : "Use Theme"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
