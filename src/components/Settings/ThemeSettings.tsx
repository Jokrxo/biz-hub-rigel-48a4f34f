import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, Check } from "lucide-react";

type ThemeKey = "original" | "corp_blue" | "fintech_green" | "premium_navy" | "neutral_enterprise" | "dark_pro" | "exec_gold" | "ocean_gradient" | "purple_digital" | "tech_silver" | "eco_green";

const themes: Array<{ key: ThemeKey; name: string; className: string; description: string; colors: string[] }> = [
  { key: "original", name: "Original SA Finance", className: "", description: "Professional SA finance palette", colors: ["#2563eb", "#f8fafc"] },
  { key: "corp_blue", name: "Corporate Blue", className: "theme-corp-blue", description: "Deep blue, white, slate grey", colors: ["#1e40af", "#f1f5f9"] },
  { key: "fintech_green", name: "Fintech Green", className: "theme-fintech-green", description: "Teal/green with soft neutrals", colors: ["#0d9488", "#f0fdfa"] },
  { key: "premium_navy", name: "Premium Navy", className: "theme-premium-navy", description: "Dark navy with glowing teal", colors: ["#0f172a", "#2dd4bf"] },
  { key: "neutral_enterprise", name: "Neutral Enterprise", className: "theme-neutral-enterprise", description: "Calm grey and white", colors: ["#475569", "#f8fafc"] },
  { key: "dark_pro", name: "Dark Mode Pro", className: "theme-dark-pro", description: "Charcoal with electric blue", colors: ["#18181b", "#3b82f6"] },
  { key: "exec_gold", name: "Executive Gold", className: "theme-exec-gold", description: "Luxury black + gold highlights", colors: ["#000000", "#eab308"] },
  { key: "ocean_gradient", name: "Ocean Gradient", className: "theme-ocean-gradient", description: "Soft teal to blue gradients", colors: ["#0ea5e9", "#e0f2fe"] },
  { key: "purple_digital", name: "Purple Digital", className: "theme-purple-digital", description: "Purple/indigo with neon accents", colors: ["#7c3aed", "#faf5ff"] },
  { key: "tech_silver", name: "Tech Silver", className: "theme-tech-silver", description: "Frosted glass silver/blue", colors: ["#94a3b8", "#f1f5f9"] },
  { key: "eco_green", name: "Eco Green", className: "theme-eco-green", description: "Soft green with brown undertones", colors: ["#166534", "#f0fdf4"] },
];

export const ThemeSettings = () => {
  const [current, setCurrent] = useState<ThemeKey>("original");

  useEffect(() => {
    const saved = localStorage.getItem("app_theme") as ThemeKey | null;
    if (saved && themes.find(t => t.key === saved)) setCurrent(saved);
  }, []);

  const applyTheme = (key: ThemeKey) => {
    const html = document.documentElement;
    themes.forEach(t => t.className && html.classList.remove(t.className));
    const t = themes.find(t => t.key === key);
    if (t && t.className) html.classList.add(t.className);
    
    const isDarkFamily = key === "dark_pro" || key === "premium_navy" || key === "purple_digital";
    if (isDarkFamily) html.classList.add('dark'); else html.classList.remove('dark');
    
    localStorage.setItem("app_theme", key);
    setCurrent(key);
  };

  return (
    <Card className="card-professional">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Visual Theme</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">Select a color scheme that matches your brand or preference.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {themes.map(t => (
            <div 
              key={t.key}
              onClick={() => applyTheme(t.key)}
              className={`
                group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-200 hover:shadow-lg
                ${current === t.key ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/25 bg-muted/20"}
              `}
            >
              <div className="aspect-[16/9] w-full bg-gradient-to-br from-white to-slate-100 dark:from-slate-900 dark:to-slate-800 p-3 flex flex-col justify-between">
                <div className="flex gap-2">
                  <div className="h-2 w-full rounded-full" style={{ backgroundColor: t.colors[0] }} />
                  <div className="h-2 w-1/3 rounded-full" style={{ backgroundColor: t.colors[1] }} />
                </div>
                <div className="space-y-1">
                  <div className="h-2 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-2 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
              <div className="p-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{t.name}</span>
                  {current === t.key && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
