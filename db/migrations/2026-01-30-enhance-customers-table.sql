-- Add missing columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code TEXT UNIQUE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES auth.users(id); 
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for faster search
CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Add customer_id to invoices for better linking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- Add customer_id to transactions for direct linking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);

-- Add customer_id to quotes for better linking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
