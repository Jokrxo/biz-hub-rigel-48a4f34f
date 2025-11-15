import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Role = 'administrator' | 'accountant' | 'manager';

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRoles([]); return; }
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('user_id', user.id).maybeSingle();
        if (!profile?.company_id) { setRoles([]); return; }
        const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('company_id', profile.company_id);
        if (mounted) setRoles((data || []).map(r => r.role as Role));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return {
    roles,
    loading,
    isAdmin: roles.includes('administrator'),
    isAccountant: roles.includes('accountant'),
    isManager: roles.includes('manager')
  };
}
