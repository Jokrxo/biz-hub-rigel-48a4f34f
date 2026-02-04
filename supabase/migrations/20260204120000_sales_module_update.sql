-- Create Quotes Table
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  quote_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  customer_email TEXT,
  quote_date DATE NOT NULL,
  expiry_date DATE,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'draft', -- draft, accepted, rejected, converted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, quote_number)
);

-- Create Quote Items Table
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.items(id),
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 15,
  amount NUMERIC DEFAULT 0
);

-- Create Credit Notes Table
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  credit_note_number TEXT NOT NULL,
  credit_note_date DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_id UUID REFERENCES public.invoices(id), -- Linked invoice
  status TEXT DEFAULT 'draft', -- draft, posted
  reason TEXT,
  subtotal NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, credit_note_number)
);

-- Credit Note Items
CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.items(id), -- Added for COGS reversal
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 15,
  amount NUMERIC DEFAULT 0,
  account_id UUID REFERENCES public.chart_of_accounts(id)
);

-- Removed duplicate quotes table creation

-- Receipts Table
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  receipt_number TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  amount NUMERIC DEFAULT 0,
  payment_method TEXT, -- Cash, EFT, etc.
  reference TEXT,
  status TEXT DEFAULT 'draft', -- draft, posted
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(company_id, receipt_number)
);

-- Receipt Allocations (Linking Receipts to Invoices)
CREATE TABLE IF NOT EXISTS public.receipt_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update Invoice Posting RPC to use new COA codes and handle COGS
CREATE OR REPLACE FUNCTION public.post_invoice_sent(
  _invoice_id UUID,
  _post_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  ar_id UUID;
  rev_id UUID;
  vat_id UUID;
  cogs_id UUID;
  inventory_id UUID;
  tx_id UUID;
  v_subtotal NUMERIC;
  v_tax NUMERIC;
  v_total NUMERIC;
  v_user UUID;
  v_cost NUMERIC := 0;
BEGIN
  SELECT * INTO inv FROM invoices WHERE id = _invoice_id;
  IF inv IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  -- 1. Resolve Accounts using NEW COA Codes
  -- Trade Receivables: A041 (fallback to 1200)
  SELECT id INTO ar_id FROM chart_of_accounts WHERE company_id = inv.company_id AND (account_code = 'A041' OR account_code = '1200') LIMIT 1;
  -- Sales/Revenue: I001 (fallback to 4000)
  SELECT id INTO rev_id FROM chart_of_accounts WHERE company_id = inv.company_id AND (account_code = 'I001' OR account_code = '4000') LIMIT 1;
  -- VAT Output: Use L011 (Income Tax? No) or find 'VAT' in name or create specific
  SELECT id INTO vat_id FROM chart_of_accounts WHERE company_id = inv.company_id AND (account_name ILIKE '%VAT%' OR account_code = '2200') AND account_type IN ('liability', 'asset') LIMIT 1;

  IF ar_id IS NULL OR rev_id IS NULL THEN
    RAISE EXCEPTION 'Core accounts missing (Trade Receivables A041 or Sales I001)';
  END IF;

  v_subtotal := COALESCE(inv.subtotal, 0);
  v_tax := COALESCE(inv.tax_amount, 0);
  v_total := COALESCE(inv.total_amount, 0);

  SELECT auth.uid() INTO v_user;

  -- Check if already posted
  IF EXISTS (SELECT 1 FROM transactions WHERE company_id = inv.company_id AND reference_number = inv.invoice_number AND status = 'posted') THEN
    RETURN;
  END IF;

  -- Create Transaction Header
  INSERT INTO transactions (company_id, user_id, transaction_date, description, reference_number, total_amount, status, type)
  VALUES (
    inv.company_id,
    v_user,
    COALESCE(_post_date, inv.invoice_date),
    'Invoice ' || inv.invoice_number,
    inv.invoice_number,
    v_total,
    'posted',
    'invoice'
  ) RETURNING id INTO tx_id;

  -- 2. Create Journal Entries (Double Entry)
  -- Dr. Debtors (A041) - Total Incl VAT
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (tx_id, ar_id, v_total, 0, 'Invoice ' || inv.invoice_number, 'approved');

  -- Cr. Revenue (I001) - Subtotal Excl VAT
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (tx_id, rev_id, 0, v_subtotal, 'Invoice ' || inv.invoice_number || ' Revenue', 'approved');

  -- Cr. VAT (Liability) - Tax Amount
  IF vat_id IS NOT NULL AND v_tax > 0 THEN
    INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
    VALUES (tx_id, vat_id, 0, v_tax, 'Invoice ' || inv.invoice_number || ' VAT', 'approved');
  END IF;

  -- 3. Handle Inventory/COGS (IAS 2)
  SELECT id INTO cogs_id FROM chart_of_accounts WHERE company_id = inv.company_id AND (account_code = 'E001' OR account_code = '5000') LIMIT 1;
  SELECT id INTO inventory_id FROM chart_of_accounts WHERE company_id = inv.company_id AND (account_code = 'A042' OR account_code = '1300') LIMIT 1;

  IF cogs_id IS NOT NULL AND inventory_id IS NOT NULL THEN
     -- Calculate total cost from invoice items that are products
     SELECT COALESCE(SUM(ii.quantity * i.cost_price), 0)
     INTO v_cost
     FROM invoice_items ii
     JOIN items i ON ii.product_id = i.id
     WHERE ii.invoice_id = _invoice_id
     AND (i.item_type = 'product' OR i.type = 'product');

     IF v_cost > 0 THEN
       -- Dr. COGS
       INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
       VALUES (tx_id, cogs_id, v_cost, 0, 'Cost of Sales', 'approved');
       
       -- Cr. Inventory
       INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
       VALUES (tx_id, inventory_id, 0, v_cost, 'Inventory', 'approved');
     END IF;
  END IF;

  -- Update Invoice Status
  UPDATE invoices SET status = 'paid' WHERE id = _invoice_id AND v_total = 0; -- Auto-mark 0 val invoices
  UPDATE invoices SET status = 'sent' WHERE id = _invoice_id AND status = 'draft';

END;
$$;

-- RPC for Credit Note Posting
CREATE OR REPLACE FUNCTION public.post_credit_note(
  _cn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cn RECORD;
  ar_id UUID;
  rev_id UUID;
  vat_id UUID;
  cogs_id UUID;
  inventory_id UUID;
  tx_id UUID;
  v_user UUID;
  v_cost NUMERIC := 0;
BEGIN
  SELECT * INTO cn FROM credit_notes WHERE id = _cn_id;
  IF cn IS NULL THEN RAISE EXCEPTION 'Credit Note not found'; END IF;

  SELECT id INTO ar_id FROM chart_of_accounts WHERE company_id = cn.company_id AND (account_code = 'A041' OR account_code = '1200') LIMIT 1;
  SELECT id INTO rev_id FROM chart_of_accounts WHERE company_id = cn.company_id AND (account_code = 'I001' OR account_code = '4000') LIMIT 1;
  SELECT id INTO vat_id FROM chart_of_accounts WHERE company_id = cn.company_id AND (account_name ILIKE '%VAT%' OR account_code = '2200') LIMIT 1;
  SELECT id INTO cogs_id FROM chart_of_accounts WHERE company_id = cn.company_id AND (account_code = 'E001' OR account_code = '5000') LIMIT 1;
  SELECT id INTO inventory_id FROM chart_of_accounts WHERE company_id = cn.company_id AND (account_code = 'A042' OR account_code = '1300') LIMIT 1;

  SELECT auth.uid() INTO v_user;

  INSERT INTO transactions (company_id, user_id, transaction_date, description, reference_number, total_amount, status, type)
  VALUES (
    cn.company_id,
    v_user,
    cn.credit_note_date,
    'Credit Note ' || cn.credit_note_number,
    cn.credit_note_number,
    cn.total_amount,
    'posted',
    'credit_note'
  ) RETURNING id INTO tx_id;

  -- Reverse Entries
  -- Dr. Revenue (Reduce Income)
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (tx_id, rev_id, cn.subtotal, 0, 'CN ' || cn.credit_note_number || ' Revenue Reversal', 'approved');

  -- Dr. VAT (Reduce Liability)
  IF vat_id IS NOT NULL AND cn.tax_amount > 0 THEN
    INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
    VALUES (tx_id, vat_id, cn.tax_amount, 0, 'CN ' || cn.credit_note_number || ' VAT Reversal', 'approved');
  END IF;

  -- Cr. Debtors (Reduce Owed)
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (tx_id, ar_id, 0, cn.total_amount, 'CN ' || cn.credit_note_number || ' AR Adjustment', 'approved');

  -- Handle COGS Reversal (IAS 2)
  -- If we have items with product_id, we can calculate the cost to reverse
  IF cogs_id IS NOT NULL AND inventory_id IS NOT NULL THEN
     SELECT COALESCE(SUM(cni.quantity * i.cost_price), 0)
     INTO v_cost
     FROM credit_note_items cni
     JOIN items i ON cni.product_id = i.id
     WHERE cni.credit_note_id = _cn_id
     AND (i.item_type = 'product' OR i.type = 'product');

     IF v_cost > 0 THEN
       -- Dr. Inventory (Put back into stock)
       INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
       VALUES (tx_id, inventory_id, v_cost, 0, 'CN Inventory Return', 'approved');
       
       -- Cr. COGS (Reduce Cost)
       INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
       VALUES (tx_id, cogs_id, 0, v_cost, 'CN COGS Reversal', 'approved');
     END IF;
  END IF;

  UPDATE credit_notes SET status = 'posted' WHERE id = _cn_id;
END;
$$;

-- RPC for Receipt Posting
CREATE OR REPLACE FUNCTION public.post_receipt(
  _receipt_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  ar_id UUID;
  bank_id UUID;
  tx_id UUID;
  v_user UUID;
BEGIN
  SELECT * INTO rec FROM receipts WHERE id = _receipt_id;
  IF rec IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;

  SELECT id INTO ar_id FROM chart_of_accounts WHERE company_id = rec.company_id AND (account_code = 'A041' OR account_code = '1200') LIMIT 1;
  SELECT id INTO bank_id FROM chart_of_accounts WHERE company_id = rec.company_id AND (account_code = 'A043' OR account_code = '1100') LIMIT 1; -- A043 Cash/Equivalents

  SELECT auth.uid() INTO v_user;

  INSERT INTO transactions (company_id, user_id, transaction_date, description, reference_number, total_amount, status, type)
  VALUES (
    rec.company_id,
    v_user,
    rec.receipt_date,
    'Receipt ' || rec.receipt_number,
    rec.receipt_number,
    rec.amount,
    'posted',
    'receipt'
  ) RETURNING id INTO tx_id;

  -- Dr. Bank (Increase Asset)
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (tx_id, bank_id, rec.amount, 0, 'Receipt ' || rec.receipt_number, 'approved');

  -- Cr. Debtors (Decrease Asset)
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (tx_id, ar_id, 0, rec.amount, 'Receipt ' || rec.receipt_number, 'approved');

  UPDATE receipts SET status = 'posted' WHERE id = _receipt_id;
END;
$$;
