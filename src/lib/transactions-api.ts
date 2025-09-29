import { supabase } from '@/lib/supabase';

export interface TransactionRow {
  id: string;
  company_id: string;
  user_id: string;
  transaction_date: string; // date
  reference_number: string | null;
  description: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

async function getUserCompanyId(): Promise<string> {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.company_id) throw new Error('No company associated with user');
  return data.company_id as string;
}

export const transactionsApi = {
  getAll: async (): Promise<TransactionRow[]> => {
    const companyId = await getUserCompanyId();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  create: async (tx: { date: string; description: string; amount: number; reference?: string | null; status?: TransactionRow['status'] }): Promise<TransactionRow> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        company_id: companyId,
        user_id: user.id,
        transaction_date: tx.date,
        description: tx.description,
        total_amount: tx.amount,
        reference_number: tx.reference || null,
        status: tx.status || 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    return data as TransactionRow;
  },
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },
};
