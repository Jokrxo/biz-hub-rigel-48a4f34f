import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/useAuth';

export type Role = 'administrator' | 'accountant' | 'manager';

export function useRoles() {
  const { user, loading: authLoading } = useAuth();

  const { data: roles = [], isLoading: queryLoading } = useQuery({
    queryKey: ['userRoles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (!profile?.company_id) return [];
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('company_id', profile.company_id);
        
      return (data || []).map(r => r.role as Role);
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
  });

  const loading = authLoading || (!!user && queryLoading);
  const isAdmin = roles.includes('administrator');

  return {
    roles,
    loading,
    isAdmin,
    // Administrators automatically inherit all other role permissions
    isAccountant: roles.includes('accountant') || isAdmin,
    isManager: roles.includes('manager') || isAdmin
  };
}
