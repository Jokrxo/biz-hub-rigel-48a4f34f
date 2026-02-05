-- Migration to create missing tables/columns as requested
-- This script ensures all requested tables and columns exist, adding to the existing schema where necessary.

-- 1. Branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Budgets
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id);
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS period_end date;

-- 3. Bills (Accounts Payable)
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

-- 4. Purchase Orders
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_date date;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_date date;

-- 5. Quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until date;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- 6. Quote Items
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.items(id);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;

-- 7. Fixed Assets
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS asset_name text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS asset_code text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS salvage_value numeric DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_method text DEFAULT 'straight_line';
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS current_value numeric DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS notes text;

-- 8. Employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_number text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS termination_date date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS basic_salary numeric DEFAULT 0;

-- Enable RLS and create policies if they don't exist
DO $$
BEGIN
    -- Branches
    ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'Users can manage branches') THEN
        CREATE POLICY "Users can manage branches" ON public.branches FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    -- Budgets
    ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budgets' AND policyname = 'Users can manage budgets') THEN
        CREATE POLICY "Users can manage budgets" ON public.budgets FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    -- Bills
    ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bills' AND policyname = 'Users can manage bills') THEN
        CREATE POLICY "Users can manage bills" ON public.bills FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;
    
    -- Purchase Orders
    ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_orders' AND policyname = 'Users can manage purchase_orders') THEN
        CREATE POLICY "Users can manage purchase_orders" ON public.purchase_orders FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    -- Quotes
    ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'Users can manage quotes') THEN
        CREATE POLICY "Users can manage quotes" ON public.quotes FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

    -- Quote Items
    ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quote_items' AND policyname = 'Users can manage quote_items') THEN
        CREATE POLICY "Users can manage quote_items" ON public.quote_items FOR ALL USING (quote_id IN (SELECT id FROM quotes WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())));
    END IF;

    -- Fixed Assets
    ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fixed_assets' AND policyname = 'Users can manage fixed_assets') THEN
        CREATE POLICY "Users can manage fixed_assets" ON public.fixed_assets FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;
    
    -- Employees
    ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Users can manage employees') THEN
        CREATE POLICY "Users can manage employees" ON public.employees FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid()));
    END IF;

END $$;
