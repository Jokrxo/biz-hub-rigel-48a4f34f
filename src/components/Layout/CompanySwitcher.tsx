import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Check } from "lucide-react";

interface Company {
  id: string;
  name: string;
  code?: string;
}

export const CompanySwitcher = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentCompanyId, setCurrentCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchCompanies = async () => {
      setLoading(true);
      try {
        // 1. Get current profile to know active company
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          setCurrentCompanyId(profile.company_id);
        }

        // 2. Get all companies user has a role in
        const { data: roles } = await supabase
          .from("user_roles")
          .select("company_id, companies(id, name, code)")
          .eq("user_id", user.id);

        if (roles) {
          const validCompanies = roles
            .map((r: any) => r.companies)
            .filter((c: any) => c !== null) as Company[];
          
          // Deduplicate just in case
          const uniqueCompanies = Array.from(new Map(validCompanies.map(c => [c.id, c])).values());
          setCompanies(uniqueCompanies);
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [user]);

  const handleSwitch = async (companyId: string) => {
    if (!user || companyId === currentCompanyId) return;

    try {
      setLoading(true);
      // Update profile to new company
      const { error } = await supabase
        .from("profiles")
        .update({ company_id: companyId })
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setCurrentCompanyId(companyId);
      
      // Force reload to update app context
      window.location.reload();
    } catch (error) {
      console.error("Error switching company:", error);
    } finally {
      setLoading(false);
    }
  };

  // If only one company or none, show static text (similar to original Sidebar)
  if (companies.length <= 1) {
    const activeCompany = companies.find(c => c.id === currentCompanyId);
    return (
      <div className="flex flex-col">
        <span className="text-lg font-bold text-sidebar-primary truncate max-w-[150px]">
          {activeCompany?.name || "Rigel Business"}
        </span>
        <span className="text-xs text-sidebar-foreground/70">Enterprise</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-[160px]">
      <Select value={currentCompanyId} onValueChange={handleSwitch} disabled={loading}>
        <SelectTrigger className="h-auto p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 shadow-none data-[placeholder]:text-sidebar-primary [&>span]:w-full">
          <div className="flex flex-col items-start text-left w-full">
             <div className="flex items-center gap-1 w-full">
               <span className="text-lg font-bold text-sidebar-primary truncate block w-full">
                 {companies.find(c => c.id === currentCompanyId)?.name || "Select Company"}
               </span>
             </div>
             <span className="text-xs text-sidebar-foreground/70 flex items-center gap-1">
               Switch Client
             </span>
          </div>
        </SelectTrigger>
        <SelectContent className="max-w-[200px]">
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{company.name}</span>
                {company.id === currentCompanyId && <Check className="h-3 w-3 ml-auto opacity-50" />}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
