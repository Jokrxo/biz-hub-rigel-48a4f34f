import { supabase } from './supabase';
import type { TrialBalance, TrialBalanceCreate, TrialBalanceUpdate } from '@/types/trial-balance';

export const trialBalanceApi = {
  // Get all trial balances for current user
  getAll: async (): Promise<TrialBalance[]> => {
    const { data, error } = await supabase
      .from('trial_balances')
      .select('*')
      .order('account_code', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  // Create new trial balance entry
  create: async (entry: TrialBalanceCreate): Promise<TrialBalance> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('trial_balances')
      .insert({
        ...entry,
        user_id: user.id,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update trial balance entry
  update: async (id: string, updates: TrialBalanceUpdate): Promise<TrialBalance> => {
    const { data, error } = await supabase
      .from('trial_balances')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete trial balance entry
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('trial_balances')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // Get trial balance summary
  getSummary: async () => {
    const entries = await trialBalanceApi.getAll();
    const totalDebits = entries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredits = entries.reduce((sum, entry) => sum + entry.credit, 0);
    
    return {
      entries,
      totalDebits,
      totalCredits,
      isBalanced: totalDebits === totalCredits,
      difference: totalDebits - totalCredits,
    };
  },
};