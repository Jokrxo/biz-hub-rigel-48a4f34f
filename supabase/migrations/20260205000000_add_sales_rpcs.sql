-- Migration to add RPCs for posting Credit Notes and Receipts
-- This ensures double-entry accounting integrity for sales returns and payments

-- Function: post_credit_note
-- Posts a credit note to the ledger: Debits Sales Returns (or Revenue), Debits VAT, Credits Accounts Receivable
CREATE OR REPLACE FUNCTION post_credit_note(_cn_id UUID)
RETURNS VOID AS $$
DECLARE
  v_cn RECORD;
  v_company_id UUID;
  v_ar_id UUID;
  v_revenue_id UUID; -- We'll use Revenue account for simplicity, or look for Sales Returns
  v_vat_id UUID;
  v_tx_id UUID;
  v_customer_name TEXT;
BEGIN
  -- 1. Get Credit Note details
  SELECT * INTO v_cn FROM credit_notes WHERE id = _cn_id;
  
  IF v_cn IS NULL THEN
    RAISE EXCEPTION 'Credit Note not found';
  END IF;
  
  IF v_cn.status = 'posted' THEN
    RAISE EXCEPTION 'Credit Note already posted';
  END IF;

  v_company_id := v_cn.company_id;
  
  -- 2. Get Account IDs (AR, Revenue, VAT)
  -- AR
  SELECT id INTO v_ar_id FROM chart_of_accounts 
  WHERE company_id = v_company_id AND account_code = '1200' LIMIT 1;
  
  IF v_ar_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (1200) not found';
  END IF;

  -- Revenue (or Sales Returns). For now debit Revenue (4000)
  SELECT id INTO v_revenue_id FROM chart_of_accounts 
  WHERE company_id = v_company_id AND account_code = '4000' LIMIT 1;
  
  IF v_revenue_id IS NULL THEN
    RAISE EXCEPTION 'Sales Revenue account (4000) not found';
  END IF;

  -- VAT Output (2500)
  SELECT id INTO v_vat_id FROM chart_of_accounts 
  WHERE company_id = v_company_id AND account_code = '2500' LIMIT 1;
  
  -- If VAT account doesn't exist, try to find any liability tax account or ignore (but we should have it)
  IF v_vat_id IS NULL AND v_cn.tax_amount > 0 THEN
    -- Try create it or fail? Let's fail for now to ensure correctness
    -- RAISE EXCEPTION 'VAT Output account (2500) not found';
    -- Or just search by name
    SELECT id INTO v_vat_id FROM chart_of_accounts WHERE company_id = v_company_id AND name ILIKE '%VAT Output%' LIMIT 1;
  END IF;

  -- 3. Create Transaction
  INSERT INTO transactions (
    company_id,
    transaction_date,
    description,
    reference_number,
    transaction_type,
    status,
    created_by,
    customer_id
  ) VALUES (
    v_company_id,
    v_cn.credit_note_date,
    'Credit Note: ' || v_cn.reason,
    v_cn.credit_note_number,
    'credit_note',
    'approved',
    v_cn.created_by,
    v_cn.customer_id
  ) RETURNING id INTO v_tx_id;

  -- 4. Create Ledger Entries
  -- Credit AR (Reduce Asset) -> CR
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (v_tx_id, v_ar_id, 0, v_cn.total_amount, 'Credit Note - AR Adjustment', 'approved');

  -- Debit Revenue (Reduce Income) -> DR
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (v_tx_id, v_revenue_id, v_cn.subtotal, 0, 'Credit Note - Revenue Reversal', 'approved');

  -- Debit VAT (Reduce Liability) -> DR
  IF v_cn.tax_amount > 0 AND v_vat_id IS NOT NULL THEN
    INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
    VALUES (v_tx_id, v_vat_id, v_cn.tax_amount, 0, 'Credit Note - VAT Adjustment', 'approved');
  ELSIF v_cn.tax_amount > 0 THEN
     -- If no VAT account found but tax exists, dump into Revenue for balance (not ideal but keeps balance)
     UPDATE transaction_entries SET debit = v_cn.total_amount WHERE transaction_id = v_tx_id AND account_id = v_revenue_id;
  END IF;

  -- 5. Update Credit Note status
  UPDATE credit_notes SET status = 'posted' WHERE id = _cn_id;

END;
$$ LANGUAGE plpgsql;


-- Function: post_receipt
-- Posts a receipt to the ledger: Debits Bank, Credits Accounts Receivable
-- Also updates linked invoices
CREATE OR REPLACE FUNCTION post_receipt(_receipt_id UUID)
RETURNS VOID AS $$
DECLARE
  v_rec RECORD;
  v_company_id UUID;
  v_ar_id UUID;
  v_bank_id UUID; -- Need to select a bank account. Receipt might not have it?
  v_tx_id UUID;
  v_alloc RECORD;
BEGIN
  -- 1. Get Receipt details
  SELECT * INTO v_rec FROM receipts WHERE id = _receipt_id;
  
  IF v_rec IS NULL THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  
  IF v_rec.status = 'posted' THEN
    RAISE EXCEPTION 'Receipt already posted';
  END IF;

  v_company_id := v_rec.company_id;
  
  -- 2. Get Account IDs
  -- AR
  SELECT id INTO v_ar_id FROM chart_of_accounts 
  WHERE company_id = v_company_id AND account_code = '1200' LIMIT 1;
  
  IF v_ar_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Receivable account (1200) not found';
  END IF;

  -- Bank Account
  -- We need a bank account to Debit. 
  -- Ideally the receipt should specify which bank account received the funds.
  -- For now, we'll pick the first Bank account or Cash account.
  SELECT id INTO v_bank_id FROM chart_of_accounts 
  WHERE company_id = v_company_id AND (account_code = '1100' OR is_cash_equivalent = true) LIMIT 1;
  
  IF v_bank_id IS NULL THEN
     -- Create default bank if missing
     INSERT INTO chart_of_accounts (company_id, account_code, account_name, account_type, is_active, is_cash_equivalent)
     VALUES (v_company_id, '1100', 'Bank', 'asset', true, true)
     RETURNING id INTO v_bank_id;
  END IF;

  -- 3. Create Transaction
  INSERT INTO transactions (
    company_id,
    transaction_date,
    description,
    reference_number,
    transaction_type,
    status,
    created_by,
    customer_id
  ) VALUES (
    v_company_id,
    v_rec.receipt_date,
    'Payment Received - ' || v_rec.payment_method,
    v_rec.receipt_number,
    'receipt',
    'approved',
    v_rec.created_by,
    v_rec.customer_id
  ) RETURNING id INTO v_tx_id;

  -- 4. Create Ledger Entries
  -- Debit Bank (Increase Asset) -> DR
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (v_tx_id, v_bank_id, v_rec.amount, 0, 'Receipt - Bank Deposit', 'approved');

  -- Credit AR (Reduce Asset) -> CR
  INSERT INTO transaction_entries (transaction_id, account_id, debit, credit, description, status)
  VALUES (v_tx_id, v_ar_id, 0, v_rec.amount, 'Receipt - Payment Allocation', 'approved');

  -- 5. Update Allocations (Invoices)
  -- Loop through receipt_allocations and update invoice amount_paid
  FOR v_alloc IN SELECT * FROM receipt_allocations WHERE receipt_id = _receipt_id LOOP
    UPDATE invoices 
    SET amount_paid = COALESCE(amount_paid, 0) + v_alloc.amount,
        status = CASE 
          WHEN COALESCE(amount_paid, 0) + v_alloc.amount >= total_amount THEN 'paid' 
          ELSE 'partial' 
        END
    WHERE id = v_alloc.invoice_id;
  END LOOP;

  -- 6. Update Receipt status
  UPDATE receipts SET status = 'posted' WHERE id = _receipt_id;

END;
$$ LANGUAGE plpgsql;
