import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
      
      const fetchedRoles = (data || []).map(r => r.role as Role);
      
      // Cache the fetched roles to localStorage for instant access next time
      try {
        localStorage.setItem(`rigel_roles_${user.id}`, JSON.stringify(fetchedRoles));
      } catch (e) {
        console.warn('Failed to cache roles', e);
      }
      
      return fetchedRoles;
    },
    enabled: !!user && !authLoading,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    refetchOnWindowFocus: false,
    placeholderData: () => {
       // Try to load from local storage to prevent flickering
       if (!user) return [];
       try {
         const cached = localStorage.getItem(`rigel_roles_${user.id}`);
         if (cached) return JSON.parse(cached);
       } catch {}
       return [];
    }
  });

  // Use roles from data (which might be placeholder) to determine loading state effectively
  // If we have placeholder data (cached roles), we are effectively NOT loading from the user's perspective
  const hasCachedData = roles.length > 0;
  const loading = (authLoading || (!!user && queryLoading)) && !hasCachedData;
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
