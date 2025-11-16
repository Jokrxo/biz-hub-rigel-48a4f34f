import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, hasSupabaseEnv } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session with error handling
    const initializeAuth = async () => {
      if (!hasSupabaseEnv) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Auth session error:', error);
          // Clear any corrupted session data
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('supabase-auth-token');
            localStorage.removeItem('sb-mzrdksmimgzkvbojjytc-auth-token');
          }
        }
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes with error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (!hasSupabaseEnv) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const generateUuid = () => {
    try { return crypto.randomUUID(); } catch { /* fallback */ }
    const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return tpl.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const bootstrapProfileIfNeeded = async (userId: string) => {
    try {
      // If an invite is being processed, skip bootstrap
      try { if (localStorage.getItem('pendingInvite')) return; } catch {}
      
      // Check if profile exists
      const { data: existing, error: profErr } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (profErr) return;
      
      // If profile exists, check if it's using the DEFAULT company (shared company - privacy issue)
      if (existing?.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('code')
          .eq('id', existing.company_id)
          .maybeSingle();
        
        // If user is assigned to DEFAULT company, create a new unique company for them
        if (company?.code === 'DEFAULT') {
          const newCompanyId = generateUuid();
          const uniqueCode = `COMP-${newCompanyId.substring(0, 8).toUpperCase()}`;
          
          // Create new unique company
          await supabase
            .from('companies')
            .insert({ 
              id: newCompanyId, 
              name: 'My Company', 
              code: uniqueCode 
            })
            .throwOnError();
          
          // Update profile to use new company
          await supabase
            .from('profiles')
            .update({ company_id: newCompanyId })
            .eq('user_id', userId)
            .throwOnError();
          
          // Update user_roles to use new company
          await supabase
            .from('user_roles')
            .update({ company_id: newCompanyId })
            .eq('user_id', userId)
            .throwOnError();
          
          // Delete old role for DEFAULT company
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('company_id', existing.company_id);
        }
        return;
      }

      // Profile doesn't exist - create new unique company and profile
      const newCompanyId = generateUuid();
      const uniqueCode = `COMP-${newCompanyId.substring(0, 8).toUpperCase()}`;
      
      // Get user metadata for name
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const userName = authUser?.user_metadata?.name || '';
      const nameParts = userName.split(' ').filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Create unique company record
      await supabase
        .from('companies')
        .insert({ 
          id: newCompanyId, 
          name: 'My Company', 
          code: uniqueCode 
        })
        .throwOnError();
      
      // Create profile with unique company and user name
      await supabase
        .from('profiles')
        .insert({ 
          user_id: userId, 
          company_id: newCompanyId,
          first_name: firstName || null,
          last_name: lastName || null,
          email: authUser?.email || null
        })
        .throwOnError();
      
      // Ensure admin role in user_roles
      await supabase
        .from('user_roles')
        .insert({ user_id: userId, company_id: newCompanyId, role: 'administrator' })
        .throwOnError();
    } catch {
      // non-fatal
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    if (!hasSupabaseEnv) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          name: name
        }
      }
    });
    if (error) throw error;
    
    // Wait a moment for database triggers to complete, then bootstrap profile
    // This ensures the user gets a unique company even if the trigger created a DEFAULT company
    if (data?.user?.id) {
      // Small delay to allow database trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      // Bootstrap will check and fix any DEFAULT company assignment
      await bootstrapProfileIfNeeded(data.user.id);
    }
  };

  const forgotPassword = async (email: string) => {
    if (!hasSupabaseEnv) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  const logout = async () => {
    if (!hasSupabaseEnv) { setUser(null); return; }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(() => ({ user, loading, login, signup, forgotPassword, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

