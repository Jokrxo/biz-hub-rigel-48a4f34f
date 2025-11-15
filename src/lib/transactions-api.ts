import { supabase } from '@/integrations/supabase/client';

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
  postInvoiceSentClient: async (inv: any, postDateStr?: string): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const postDate = postDateStr || inv.invoice_date || new Date().toISOString().slice(0, 10);
    const subtotal = Number(inv.subtotal ?? inv.total_before_tax ?? 0);
    const taxAmount = Number(inv.tax_amount ?? inv.tax ?? 0);
    const total = Number(inv.total_amount ?? inv.total ?? subtotal + taxAmount);

    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({
      id: a.id as string,
      name: String(a.account_name || '').toLowerCase(),
      type: String(a.account_type || '').toLowerCase(),
      code: String(a.account_code || ''),
    }));

    const findBy = (type: string, codes: string[], names: string[]): string | null => {
      const byType = list.filter(a => a.type === type.toLowerCase());
      const byCode = byType.find(a => codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = byType.find(a => names.some(k => a.name.includes(k)));
      return byName?.id || null;
    };

    const arId = findBy('asset', ['1200'], ['receiv', 'accounts receiv']);
    const revId = findBy('income', ['4000'], ['revenue', 'sales']);
    const vatOutId = findBy('liability', ['2100'], ['vat output', 'vat payable', 'output tax']);

    if (!arId || !revId) throw new Error('Core accounts missing: AR or Revenue');

    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        company_id: companyId,
        user_id: user.id,
        transaction_date: postDate,
        description: `Invoice ${inv.invoice_number || inv.id} issued`,
        reference_number: inv.invoice_number || null,
        total_amount: total,
        transaction_type: 'sales',
        status: 'posted',
      })
      .select('id')
      .single();
    if (txErr) throw txErr;

    const rows: Array<{ transaction_id: string; account_id: string; debit: number; credit: number; description: string; status: string }> = [
      { transaction_id: tx.id, account_id: arId, debit: total, credit: 0, description: 'Invoice issued', status: 'posted' },
      { transaction_id: tx.id, account_id: revId, debit: 0, credit: subtotal, description: 'Invoice issued', status: 'posted' },
    ];
    if (vatOutId && taxAmount > 0) {
      rows.push({ transaction_id: tx.id, account_id: vatOutId, debit: 0, credit: taxAmount, description: 'VAT on invoice', status: 'posted' });
    }

    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;

    const ledgerRows = rows.map(r => ({
      company_id: companyId,
      account_id: r.account_id,
      debit: r.debit,
      credit: r.credit,
      entry_date: postDate,
      is_reversed: false,
      transaction_id: tx.id,
      description: r.description,
    }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;
  },

  postInvoicePaidClient: async (inv: any, paymentDateStr: string, bankAccountId: string, amount: number): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const payDate = paymentDateStr || new Date().toISOString().slice(0, 10);
    const amt = Number(amount || inv.total_amount || 0);
    if (!amt || amt <= 0) throw new Error('Invalid payment amount');
    if (!bankAccountId) throw new Error('Bank account required');

    const { data: bankAcc } = await supabase
      .from('bank_accounts')
      .select('id, account_name')
      .eq('id', bankAccountId)
      .maybeSingle();

    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_cash_equivalent, financial_statement_category, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({
      id: a.id as string,
      name: String(a.account_name || '').toLowerCase(),
      type: String(a.account_type || '').toLowerCase(),
      code: String(a.account_code || ''),
      isCashEq: Boolean((a as any).is_cash_equivalent),
      fsc: String((a as any).financial_statement_category || ''),
    }));

    const findBy = (type: string, codes: string[], names: string[]): string | null => {
      const byType = list.filter(a => a.type === type.toLowerCase());
      const byCode = byType.find(a => codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = byType.find(a => names.some(k => a.name.includes(k)));
      return byName?.id || null;
    };

    const arId = findBy('asset', ['1200'], ['receiv', 'accounts receiv']);
    if (!arId) throw new Error('Accounts Receivable account missing');

    const bankLedgerName = bankAcc?.account_name ? `bank - ${String(bankAcc.account_name).toLowerCase()}` : 'bank - main';
    let bankId = findBy('asset', ['1100'], ['bank', 'cash']);
    const byExactName = list.find(a => a.type === 'asset' && a.name === bankLedgerName);
    if (byExactName) bankId = byExactName.id;

    if (!bankId) throw new Error('Bank ledger account missing');

    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        company_id: companyId,
        user_id: user.id,
        transaction_date: payDate,
        description: `Payment for invoice ${inv.invoice_number || inv.id}`,
        reference_number: inv.invoice_number || null,
        total_amount: amt,
        transaction_type: 'receipt',
        status: 'posted',
        bank_account_id: bankAccountId,
      })
      .select('id')
      .single();
    if (txErr) throw txErr;

    const rows: Array<{ transaction_id: string; account_id: string; debit: number; credit: number; description: string; status: string }> = [
      { transaction_id: tx.id, account_id: bankId, debit: amt, credit: 0, description: 'Invoice payment', status: 'posted' },
      { transaction_id: tx.id, account_id: arId, debit: 0, credit: amt, description: 'Invoice payment', status: 'posted' },
    ];

    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;

    const ledgerRows = rows.map(r => ({
      company_id: companyId,
      account_id: r.account_id,
      debit: r.debit,
      credit: r.credit,
      entry_date: payDate,
      is_reversed: false,
      transaction_id: tx.id,
      description: r.description,
    }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;

    try {
      await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: amt, _operation: 'add' });
    } catch {}
  },
};
