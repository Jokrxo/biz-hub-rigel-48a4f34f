import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, UserCog, Activity, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditLogViewer } from "@/components/Accountant/AuditLogViewer";

interface CompanyData {
  id: string;
  name: string;
  code: string | null;
  role: string;
  created_at: string;
}

const AccountantDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);

        // 1. Get current active company
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        
        if (profile) setCurrentCompanyId(profile.company_id);

        // 2. Get all companies user has access to via user_roles
        const { data: roles, error } = await supabase
          .from("user_roles")
          .select(`
            role,
            companies (
              id,
              name,
              code,
              created_at
            )
          `)
          .eq("user_id", user.id);

        if (error) throw error;

        const formattedCompanies = roles?.map((r: any) => ({
          id: r.companies.id,
          name: r.companies.name,
          code: r.companies.code,
          role: r.role,
          created_at: r.companies.created_at
        })) || [];

        // Deduplicate
        const unique = Array.from(new Map(formattedCompanies.map(c => [c.id, c])).values());
        setCompanies(unique);

      } catch (error) {
        console.error("Error fetching accountant data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSwitchCompany = async (companyId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ company_id: companyId })
        .eq("user_id", user.id);

      if (error) throw error;
      
      // Reload to apply context change
      window.location.reload();
    } catch (error) {
      console.error("Error switching company:", error);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Accountant Dashboard</h1>
        <p className="text-muted-foreground">Manage your client portfolio and access financial data across organizations.</p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="h-[200px]">
              <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-1/2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => {
            const isActive = company.id === currentCompanyId;
            return (
              <Card key={company.id} className={`relative overflow-hidden transition-all hover:shadow-md ${isActive ? 'border-primary/50 bg-primary/5' : ''}`}>
                {isActive && (
                  <div className="absolute top-0 right-0 p-2">
                    <Badge variant="default" className="bg-primary text-primary-foreground">Active Session</Badge>
                  </div>
                )}
                
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-xl">{company.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <UserCog className="h-3.5 w-3.5" />
                    Role: <span className="font-medium capitalize">{company.role}</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-4">
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      <span>Status: Active</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Pending Tasks: 0</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button 
                    className="w-full gap-2" 
                    variant={isActive ? "outline" : "default"}
                    onClick={() => handleSwitchCompany(company.id)}
                    disabled={isActive}
                  >
                    {isActive ? (
                      "Currently Active"
                    ) : (
                      <>
                        Switch to Client <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <AuditLogViewer />
    </div>
  );
};

export default AccountantDashboard;
