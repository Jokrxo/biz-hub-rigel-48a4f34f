import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { Calculator } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  open: boolean;
}

import { navGroups } from "@/config/navigation";

export const Sidebar = ({ open }: SidebarProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<{ name: string; role: string; company_name?: string } | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user?.id) return;

      try {
        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          // Get user role
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("company_id", profile.company_id)
            .maybeSingle();

          // Get company details
          const { data: company } = await supabase
            .from("companies")
            .select("logo_url, name")
            .eq("id", profile.company_id)
            .maybeSingle();

          const fullName = [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(" ") || user.email?.split("@")[0] || "User";
          
          const role = roles?.role || "User";

          setUserProfile({ name: fullName, role, company_name: company?.name });
          setCompanyLogoUrl(company?.logo_url || null);
        } else {
          // Fallback to email if no profile
          setUserProfile({ 
            name: user.email?.split("@")[0] || "User", 
            role: "User",
            company_name: "My Company"
          });
        }
      } catch (error) {
        // Fallback to email if error
        setUserProfile({ 
          name: user.email?.split("@")[0] || "User", 
          role: "User",
          company_name: "My Company"
        });
      }
    };

    loadUserProfile();

    const handleCompanyChange = () => {
      loadUserProfile();
    };

    window.addEventListener('company-changed', handleCompanyChange);

    return () => {
      window.removeEventListener('company-changed', handleCompanyChange);
    };
  }, [user]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-[width] duration-300 ease-in-out will-change-[width] bg-sidebar border-r border-sidebar-border shadow-elegant",
        open ? "w-64" : "w-16"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo Section */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            {logoError ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary animate-glow">
                <Calculator className="h-5 w-5 text-primary-foreground" />
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="Rigel Business"
                className="h-10 w-10 rounded-lg object-cover"
                onError={() => setLogoError(true)}
              />
            )}
            {open && (
              <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-primary truncate max-w-[150px]">{userProfile?.company_name || "Rigel Business"}</span>
                <span className="text-xs text-sidebar-foreground/70">Enterprise</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <TooltipProvider>
          <nav className="flex-1 space-y-6 p-4 overflow-y-auto custom-scrollbar">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                {open && (
                  <h3 className="px-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                    {group.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href;

                    const button = (
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 hover:bg-sidebar-accent transition-all duration-200 mb-1 relative",
                          !open && "justify-center px-2 h-10 w-10 mx-auto rounded-xl",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-primary shadow-sm font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
                        )}
                      >
                        {isActive && open && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-primary" />
                        )}
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-transform duration-200",
                            isActive ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        {open && <span className="truncate">{item.label}</span>}
                      </Button>
                    );

                    return (
                      <Link key={item.href} to={item.href} className="block">
                        {open ? (
                          button
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </TooltipProvider>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <div className={cn("flex items-center gap-3", !open && "justify-center")}>
            {companyLogoUrl && !logoError ? (
              <img
                src={companyLogoUrl}
                alt="Company Logo"
                className="h-8 w-8 rounded-full object-cover"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-accent flex items-center justify-center text-sidebar-foreground font-semibold text-sm">
                {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
            {open && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {userProfile?.name || "User"}
                </p>
                <p className="text-xs text-sidebar-foreground/70 capitalize">
                  {userProfile?.role || "User"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
