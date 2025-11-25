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
    return (data || []) as TransactionRow[];
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
      // Try exact match first, then try numeric match
      const byCode = byType.find(a => codes.includes(a.code) || codes.includes(String(a.code)));
      if (byCode) return byCode.id;
      const byName = byType.find(a => names.some(k => a.name.includes(k.toLowerCase())));
      return byName?.id || null;
    };

    const arId = findBy('asset', ['1200'], ['receiv', 'accounts receiv']);
    const revId = findBy('income', ['4000'], ['revenue', 'sales']);
    let vatOutId = findBy('liability', ['2200','2100'], ['vat output', 'vat payable', 'output tax']);
    let cogsId = findBy('expense', ['5000'], ['cost of sales', 'cost of goods', 'cogs']);
    let inventoryId = findBy('asset', ['1300'], ['inventory', 'stock']);

    if (!arId || !revId) throw new Error('Core accounts missing: AR or Revenue');
    
    console.log('Found accounts:', { arId, revId, vatOutId, cogsId, inventoryId });
    console.log('Available accounts in database:', list.map(a => ({ code: a.code, name: a.name, type: a.type })));

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
        status: 'pending',
      })
      .select('id')
      .single();
    if (txErr) throw txErr;

    // Ensure VAT Output account exists if taxAmount > 0
    if (!vatOutId && taxAmount > 0) {
      try {
        const { data: created } = await supabase
          .from('chart_of_accounts')
          .insert({ company_id: companyId, account_code: '2200', account_name: 'VAT Output', account_type: 'liability', is_active: true })
          .select('id')
          .single();
        vatOutId = (created as any)?.id || vatOutId;
      } catch {}
    }

    const rows: Array<{ transaction_id: string; account_id: string; debit: number; credit: number; description: string; status: string }> = [
      { transaction_id: tx.id, account_id: arId, debit: total, credit: 0, description: 'Invoice issued', status: 'approved' },
      { transaction_id: tx.id, account_id: revId, debit: 0, credit: subtotal, description: 'Invoice issued', status: 'approved' },
    ];
    if (vatOutId && taxAmount > 0) {
      rows.push({ transaction_id: tx.id, account_id: vatOutId, debit: 0, credit: taxAmount, description: 'VAT on invoice', status: 'approved' });
    }

    // Compute COGS for product lines and post Dr COGS, Cr Inventory
    try {
      console.log('Starting COGS calculation for invoice:', inv.id);
      const { data: invItems } = await supabase
        .from('invoice_items')
        .select('description, quantity, unit_price, item_type, product_id')
        .eq('invoice_id', inv.id);
      console.log('Invoice items found:', invItems);
      
      const productIds = (invItems || [])
        .filter((it: any) => (String(it.item_type || '').toLowerCase() === 'product') && it.product_id)
        .map((it: any) => String(it.product_id));
      console.log('Product IDs found:', productIds);
      
      let totalCost = 0;
      if (productIds.length > 0) {
        const { data: prodInfos } = await supabase
          .from('items')
          .select('id, cost_price')
          .in('id', productIds as any);
        console.log('Product info found:', prodInfos);
        
        const costMap = new Map<string, number>();
        (prodInfos || []).forEach((p: any) => costMap.set(String(p.id), Number(p.cost_price || 0)));
        console.log('Cost map created:', Array.from(costMap.entries()));
        
        (invItems || []).forEach((it: any) => {
          const isProd = String(it.item_type || '').toLowerCase() === 'product';
          if (!isProd) return;
          let cp = costMap.get(String(it.product_id)) || 0;
          if (!cp || cp <= 0) cp = Number(it.unit_price || 0); // fallback to sales price when cost missing
          const qty = Number(it.quantity || 0);
          const itemCost = cp * qty;
          console.log(`Item: ${it.description}, Cost: ${cp}, Qty: ${qty}, Total: ${itemCost}`);
          totalCost += itemCost;
        });
        console.log('Total cost calculated from products:', totalCost);
      }
      // If product_id is not present, match by description/name
      if (totalCost === 0) {
        console.log('No cost found with product_id, trying name matching...');
        const names = (invItems || [])
          .filter((it: any) => String(it.item_type || '').toLowerCase() === 'product')
          .map((it: any) => String(it.description || ''))
          .filter(Boolean);
        console.log('Product names to search:', names);
        if (names.length > 0) {
          const { data: prodByName } = await supabase
            .from('items')
            .select('name, cost_price')
            .eq('company_id', companyId)
            .in('name', names as any)
            .eq('item_type', 'product');
          console.log('Products found by name:', prodByName);
          
          const costByName = new Map<string, number>();
          (prodByName || []).forEach((p: any) => costByName.set(String(p.name || ''), Number(p.cost_price || 0)));
          (invItems || []).forEach((it: any) => {
            if (String(it.item_type || '').toLowerCase() !== 'product') return;
            let cp = costByName.get(String(it.description || '')) || 0;
            if (!cp || cp <= 0) cp = Number(it.unit_price || 0);
            const qty = Number(it.quantity || 0);
            const itemCost = cp * qty;
            console.log(`Item by name: ${it.description}, Cost: ${cp}, Qty: ${qty}, Total: ${itemCost}`);
            totalCost += itemCost;
          });
          console.log('Total cost calculated from name matching:', totalCost);
        }
      }
      // Ensure accounts exist if we need to post COGS
      if (totalCost > 0) {
        if (!cogsId) {
          console.log('Creating COGS account 5000 for company:', companyId);
          const { data: created, error: cogsError } = await supabase
            .from('chart_of_accounts')
            .insert({ company_id: companyId, account_code: '5000', account_name: 'Cost of Sales', account_type: 'expense', is_active: true })
            .select('id')
            .single();
          if (cogsError) {
            console.error('Error creating COGS account:', cogsError);
          } else if (created) {
            cogsId = created.id;
            console.log('COGS account created with ID:', cogsId);
          }
        }
        if (!inventoryId) {
          console.log('Creating Inventory account 1300 for company:', companyId);
          const { data: created, error: invError } = await supabase
            .from('chart_of_accounts')
            .insert({ company_id: companyId, account_code: '1300', account_name: 'Inventory', account_type: 'asset', is_active: true })
            .select('id')
            .single();
          if (invError) {
            console.error('Error creating Inventory account:', invError);
          } else if (created) {
            inventoryId = created.id;
            console.log('Inventory account created with ID:', inventoryId);
          }
        }
        if (cogsId && inventoryId) {
          console.log('Adding COGS and Inventory entries to transaction:', { cogsId, inventoryId, totalCost });
          rows.push({ transaction_id: tx.id, account_id: cogsId, debit: totalCost, credit: 0, description: 'Cost of Goods Sold', status: 'approved' });
          rows.push({ transaction_id: tx.id, account_id: inventoryId, debit: 0, credit: totalCost, description: 'Inventory', status: 'approved' });
        } else {
          console.warn('COGS or Inventory account not found/created:', { cogsId, inventoryId });
        }
      }
    } catch (error) {
      console.error('Error in COGS calculation or account creation:', error);
    }

    console.log('Final transaction rows to be inserted:', rows);
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

    await supabase
      .from('transactions')
      .update({ status: 'posted' })
      .eq('id', tx.id);
  },

  appendCOGSForInvoice: async (inv: any, postDateStr?: string): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const postDate = postDateStr || inv.invoice_date || new Date().toISOString().slice(0, 10);

    // Find existing transaction for this invoice
    const { data: tx } = await supabase
      .from('transactions')
      .select('id, transaction_type, status')
      .eq('company_id', companyId)
      .eq('reference_number', inv.invoice_number || null)
      .eq('transaction_type', 'sales')
      .maybeSingle();

    // Resolve accounts
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({ id: a.id as string, name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
    const findBy = (type: string, codes: string[], names: string[]): string | null => {
      const byType = list.filter(a => a.type === type.toLowerCase());
      const byCode = byType.find(a => codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = byType.find(a => names.some(k => a.name.includes(k)));
      return byName?.id || null;
    };
    let cogsId = findBy('expense', ['5000'], ['cost of sales', 'cost of goods', 'cogs']);
    let inventoryId = findBy('asset', ['1300'], ['inventory', 'stock']);

    // Compute COGS from invoice_items
    const { data: invItems } = await supabase
      .from('invoice_items')
      .select('description, quantity, item_type')
      .eq('invoice_id', inv.id);
    let totalCost = 0;
    const { data: allProducts } = await supabase
      .from('items')
      .select('name, cost_price')
      .eq('company_id', companyId)
      .eq('item_type', 'product');
    const catalog = (allProducts || []).map((p: any) => ({ name: String(p.name || '').toLowerCase().trim(), cost: Number(p.cost_price || 0) }));
    (invItems || []).forEach((it: any) => {
      if (String(it.item_type || '').toLowerCase() !== 'product') return;
      const desc = String(it.description || '').toLowerCase().trim();
      let cp = 0;
      const exact = catalog.find(c => c.name === desc);
      if (exact) cp = exact.cost;
      else {
        const contains = catalog.find(c => desc.includes(c.name) || c.name.includes(desc));
        if (contains) cp = contains.cost;
      }
      const qty = Number(it.quantity || 0);
      totalCost += (cp * qty);
    });

    if (totalCost <= 0) return;
    // Ensure accounts
    if (!cogsId) {
      const { data: created } = await supabase
        .from('chart_of_accounts')
        .insert({ company_id: companyId, account_code: '5000', account_name: 'Cost of Sales', account_type: 'expense', is_active: true })
        .select('id')
        .single();
      cogsId = (created as any)?.id || cogsId;
    }
    if (!inventoryId) {
      const { data: created } = await supabase
        .from('chart_of_accounts')
        .insert({ company_id: companyId, account_code: '1300', account_name: 'Inventory', account_type: 'asset', is_active: true })
        .select('id')
        .single();
      inventoryId = (created as any)?.id || inventoryId;
    }
    if (!cogsId || !inventoryId) return;

    // If no transaction found, fall back to full client posting
    if (!tx?.id) {
      await transactionsApi.postInvoiceSentClient(inv, postDate);
      return;
    }

    const rows = [
      { transaction_id: tx.id as string, account_id: cogsId, debit: totalCost, credit: 0, description: 'Cost of Goods Sold', status: 'approved' },
      { transaction_id: tx.id as string, account_id: inventoryId, debit: 0, credit: totalCost, description: 'Inventory', status: 'approved' },
    ];
    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: tx.id as string, description: r.description }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;
    await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id as string);
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
    if (!arId) throw new Error('Accounts Receivable account missing');

    let bankId = findBy('asset', ['1100'], ['bank', 'cash']);

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
        status: 'pending',
        bank_account_id: bankAccountId,
      })
      .select('id')
      .single();
    if (txErr) throw txErr;

    const rows: Array<{ transaction_id: string; account_id: string; debit: number; credit: number; description: string; status: string }> = [
      { transaction_id: tx.id, account_id: bankId, debit: amt, credit: 0, description: 'Invoice payment', status: 'approved' },
      { transaction_id: tx.id, account_id: arId, debit: 0, credit: amt, description: 'Invoice payment', status: 'approved' },
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

    await supabase
      .from('transactions')
      .update({ status: 'posted' })
      .eq('id', tx.id);

    try {
      await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: amt, _operation: 'add' });
    } catch {}
  },
  postPurchaseSentClient: async (po: any, postDateStr?: string): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const postDate = postDateStr || po.po_date || new Date().toISOString().slice(0, 10);
    const total = Number(po.total_amount || 0);
    const taxAmount = Number(po.tax_amount ?? 0);
    const subtotal = Number(po.subtotal ?? (total - taxAmount));
    const vatRate = subtotal > 0 && taxAmount > 0 ? Number(((taxAmount / subtotal) * 100).toFixed(2)) : 0;
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({ id: a.id as string, name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
    const pick = (type: string, codes: string[], names: string[]) => {
      const byCode = list.find(a => a.type === type.toLowerCase() && codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = list.find(a => a.type === type.toLowerCase() && names.some(n => a.name.includes(n)));
      if (byName) return byName.id;
      const byType = list.find(a => a.type === type.toLowerCase());
      return byType?.id || '';
    };
    const inventoryId = pick('asset', ['1300'], ['inventory','stock']);
    const apId = pick('liability', ['2000'], ['accounts payable','payable']);
    let vatInId = pick('liability', ['2110','2210'], ['vat input','vat receivable','input tax']);
    if (!inventoryId || !apId) throw new Error('Inventory or Accounts Payable account missing');
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        company_id: companyId,
        user_id: user.id,
        transaction_date: postDate,
        description: `PO ${po.po_number || po.id} sent`,
        reference_number: po.po_number || null,
        total_amount: total,
        transaction_type: 'purchase',
        status: 'pending',
        vat_rate: vatRate > 0 ? vatRate : null,
        vat_amount: taxAmount > 0 ? taxAmount : null,
        vat_inclusive: false,
      })
      .select('id')
      .single();
    if (txErr) throw txErr;
    // Ensure VAT Input account exists if taxAmount > 0
    if (!vatInId && taxAmount > 0) {
      try {
        const { data: created } = await supabase
          .from('chart_of_accounts')
          .insert({ company_id: companyId, account_code: '2110', account_name: 'VAT Input', account_type: 'liability', is_active: true })
          .select('id')
          .single();
        vatInId = (created as any)?.id || vatInId;
      } catch {}
    }

    const rows: Array<{ transaction_id: string; account_id: string; debit: number; credit: number; description: string; status: string }> = [
      { transaction_id: tx.id, account_id: inventoryId, debit: Math.max(0, subtotal), credit: 0, description: 'Inventory', status: 'approved' },
      { transaction_id: tx.id, account_id: apId, debit: 0, credit: Math.max(0, total), description: 'Accounts Payable', status: 'approved' },
    ];
    if (vatInId && taxAmount > 0) {
      rows.push({ transaction_id: tx.id, account_id: vatInId, debit: taxAmount, credit: 0, description: 'VAT Input', status: 'approved' });
    }
    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: tx.id, description: r.description }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;

    await supabase
      .from('transactions')
      .update({ status: 'posted' })
      .eq('id', tx.id);
  },
  postPurchasePaidClient: async (po: any, paymentDateStr: string, bankAccountId: string, amount: number): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const payDate = paymentDateStr || new Date().toISOString().slice(0, 10);
    const amt = Number(amount || po.total_amount || 0);
    if (!amt || amt <= 0) throw new Error('Invalid payment amount');
    if (!bankAccountId) throw new Error('Bank account required');
    const { data: bankAcc } = await supabase
      .from('bank_accounts')
      .select('id, company_id, account_name')
      .eq('id', bankAccountId)
      .maybeSingle();
    if (!bankAcc || bankAcc.company_id !== companyId) {
      throw new Error('Invalid bank account selection for this company');
    }
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({ id: a.id as string, name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
    const pick = (type: string, codes: string[], names: string[]) => {
      const byCode = list.find(a => a.type === type.toLowerCase() && codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = list.find(a => a.type === type.toLowerCase() && names.some(n => a.name.includes(n)));
      if (byName) return byName.id;
      const byType = list.find(a => a.type === type.toLowerCase());
      return byType?.id || '';
    };
    const apId = pick('liability', ['2000'], ['accounts payable','payable']);
    const bankId = pick('asset', ['1100'], ['bank','cash']);
    if (!apId || !bankId) throw new Error('Accounts Payable or Bank account missing');
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({ company_id: companyId, user_id: user.id, transaction_date: payDate, description: `Payment for PO ${po.po_number || po.id}`, reference_number: po.po_number || null, total_amount: amt, transaction_type: 'payment', status: 'pending', bank_account_id: bankAccountId })
      .select('id')
      .single();
    if (txErr) throw txErr;
    const rows = [
      { transaction_id: tx.id, account_id: apId, debit: amt, credit: 0, description: 'Accounts Payable', status: 'approved' },
      { transaction_id: tx.id, account_id: bankId, debit: 0, credit: amt, description: 'Bank', status: 'approved' },
    ];
    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: payDate, is_reversed: false, transaction_id: tx.id, description: r.description }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;
    await supabase
      .from('transactions')
      .update({ status: 'posted' })
      .eq('id', tx.id);
    try { await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: amt, _operation: 'subtract' }); } catch {}
  },
  postBillRecordedClient: async (bill: any, postDateStr?: string): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const postDate = postDateStr || bill.bill_date || new Date().toISOString().slice(0, 10);
    const subtotal = Number(bill.subtotal ?? bill.total_before_tax ?? 0);
    const taxAmount = Number(bill.tax_amount ?? bill.tax ?? 0);
    const total = Number(bill.total_amount ?? bill.total ?? (subtotal + taxAmount));
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({ id: a.id as string, name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
    const pick = (type: string, codes: string[], names: string[]) => {
      const byCode = list.find(a => a.type === type.toLowerCase() && codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = list.find(a => a.type === type.toLowerCase() && names.some(n => a.name.includes(n)));
      if (byName) return byName.id;
      const byType = list.find(a => a.type === type.toLowerCase());
      return byType?.id || '';
    };
    const expenseId = pick('expense', ['6000'], ['uncategorized expense','expense']);
    const apId = pick('liability', ['2000'], ['accounts payable','payable']);
    let vatInId = pick('liability', ['2110'], ['vat input','vat receivable','input tax']);
    if (!expenseId || !apId) throw new Error('Expense or Accounts Payable account missing');
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({ company_id: companyId, user_id: user.id, transaction_date: postDate, description: `Bill ${bill.bill_number || bill.id} recorded`, reference_number: bill.bill_number || null, total_amount: total, transaction_type: 'bill', status: 'pending', vat_rate: (subtotal > 0 && taxAmount > 0) ? Number(((taxAmount / subtotal) * 100).toFixed(2)) : null, vat_amount: taxAmount > 0 ? taxAmount : null, vat_inclusive: false })
      .select('id')
      .single();
    if (txErr) throw txErr;
    // Ensure VAT Input account exists if taxAmount > 0
    if (!vatInId && taxAmount > 0) {
      try {
        const { data: created } = await supabase
          .from('chart_of_accounts')
          .insert({ company_id: companyId, account_code: '2110', account_name: 'VAT Input', account_type: 'liability', is_active: true })
          .select('id')
          .single();
        vatInId = (created as any)?.id || vatInId;
      } catch {}
    }

    const rows = [
      { transaction_id: tx.id, account_id: expenseId, debit: Math.max(0, subtotal), credit: 0, description: 'Supplier bill', status: 'approved' },
      { transaction_id: tx.id, account_id: apId, debit: 0, credit: Math.max(0, total), description: 'Accounts Payable', status: 'approved' },
    ];
    if (vatInId && taxAmount > 0) {
      rows.push({ transaction_id: tx.id, account_id: vatInId, debit: taxAmount, credit: 0, description: 'VAT Input', status: 'approved' });
    }
    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: postDate, is_reversed: false, transaction_id: tx.id, description: r.description }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;
    await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id);
  },
  postBillPaidClient: async (bill: any, paymentDateStr: string, bankAccountId: string, amount: number): Promise<void> => {
    const companyId = await getUserCompanyId();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const payDate = paymentDateStr || new Date().toISOString().slice(0, 10);
    const amt = Number(amount || bill.total_amount || 0);
    if (!amt || amt <= 0) throw new Error('Invalid payment amount');
    if (!bankAccountId) throw new Error('Bank account required');
    const { data: bankAcc } = await supabase
      .from('bank_accounts')
      .select('id, company_id, account_name')
      .eq('id', bankAccountId)
      .maybeSingle();
    if (!bankAcc || bankAcc.company_id !== companyId) throw new Error('Invalid bank account selection for this company');
    const { data: accounts } = await supabase
      .from('chart_of_accounts')
      .select('id, account_name, account_type, account_code, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true);
    const list = (accounts || []).map(a => ({ id: a.id as string, name: String(a.account_name || '').toLowerCase(), type: String(a.account_type || '').toLowerCase(), code: String(a.account_code || '') }));
    const pick = (type: string, codes: string[], names: string[]) => {
      const byCode = list.find(a => a.type === type.toLowerCase() && codes.includes(a.code));
      if (byCode) return byCode.id;
      const byName = list.find(a => a.type === type.toLowerCase() && names.some(n => a.name.includes(n)));
      if (byName) return byName.id;
      const byType = list.find(a => a.type === type.toLowerCase());
      return byType?.id || '';
    };
    const apId = pick('liability', ['2000'], ['accounts payable','payable']);
    const bankId = pick('asset', ['1100'], ['bank','cash']);
    if (!apId || !bankId) throw new Error('Accounts Payable or Bank account missing');
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .insert({ company_id: companyId, user_id: user.id, transaction_date: payDate, description: `Payment for Bill ${bill.bill_number || bill.id}`, reference_number: bill.bill_number || null, total_amount: amt, transaction_type: 'payment', status: 'pending', bank_account_id: bankAccountId })
      .select('id')
      .single();
    if (txErr) throw txErr;
    const rows = [
      { transaction_id: tx.id, account_id: apId, debit: amt, credit: 0, description: 'Accounts Payable', status: 'approved' },
      { transaction_id: tx.id, account_id: bankId, debit: 0, credit: amt, description: 'Bank', status: 'approved' },
    ];
    const { error: teErr } = await supabase.from('transaction_entries').insert(rows);
    if (teErr) throw teErr;
    const ledgerRows = rows.map(r => ({ company_id: companyId, account_id: r.account_id, debit: r.debit, credit: r.credit, entry_date: payDate, is_reversed: false, transaction_id: tx.id, description: r.description }));
    const { error: leErr } = await supabase.from('ledger_entries').insert(ledgerRows as any);
    if (leErr) throw leErr;
    await supabase.from('transactions').update({ status: 'posted' }).eq('id', tx.id);
    try { await supabase.rpc('update_bank_balance', { _bank_account_id: bankAccountId, _amount: amt, _operation: 'subtract' }); } catch {}
  },
};
