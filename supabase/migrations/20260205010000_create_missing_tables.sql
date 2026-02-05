-- Migration to create missing tables/columns as requested
-- This script ensures all requested tables and columns exist.

-- 1. Branches
CREATE TABLE IF NOT EXISTS public.branches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    name text NOT NULL,
    address text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Budgets
CREATE TABLE IF NOT EXISTS public.budgets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    user_id uuid REFERENCES auth.users(id),
    budget_name text,
    budget_year integer,
    budget_month integer,
    category text,
    budgeted_amount numeric DEFAULT 0,
    actual_amount numeric DEFAULT 0,
    variance numeric DEFAULT 0,
    status text DEFAULT 'active',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.chart_of_accounts(id);
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS period_end date;

-- 3. Bills (Accounts Payable)
CREATE TABLE IF NOT EXISTS public.bills (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    supplier_id uuid REFERENCES public.suppliers(id),
    bill_number text,
    bill_date date,
    due_date date,
    amount numeric DEFAULT 0,
    status text DEFAULT 'pending',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;

-- 4. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    supplier_id uuid REFERENCES public.suppliers(id),
    po_number text,
    po_date date,
    subtotal numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    notes text,
    status text DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_number text; -- Redundant with po_number but kept for migration safety
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS order_date date; -- Redundant with po_date but kept for migration safety
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_date date;

-- 4b. Purchase Order Items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    description text,
    quantity numeric DEFAULT 0,
    unit_price numeric DEFAULT 0,
    tax_rate numeric DEFAULT 0,
    amount numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 5. Quotes
CREATE TABLE IF NOT EXISTS public.quotes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    quote_number text,
    customer_name text,
    customer_email text,
    po_number text,
    quote_date date,
    expiry_date date,
    subtotal numeric DEFAULT 0,
    tax_amount numeric DEFAULT 0,
    total_amount numeric DEFAULT 0,
    notes text,
    status text DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valid_until date; -- redundant with expiry_date
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- 6. Quote Items
CREATE TABLE IF NOT EXISTS public.quote_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
    description text,
    quantity numeric DEFAULT 0,
    unit_price numeric DEFAULT 0,
    tax_rate numeric DEFAULT 0,
    amount numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.items(id);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0; -- redundant with amount

-- 7. Fixed Assets
CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    asset_name text,
    cost numeric DEFAULT 0,
    purchase_date date,
    useful_life_years numeric DEFAULT 0,
    accumulated_depreciation numeric DEFAULT 0,
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS asset_code text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS asset_type text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0; -- redundant with cost
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS salvage_value numeric DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS depreciation_method text DEFAULT 'straight_line';
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS current_value numeric DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS notes text;

-- 8. Employees
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id),
    first_name text,
    last_name text,
    email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

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

    -- Purchase Order Items
    ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_order_items' AND policyname = 'Users can manage purchase_order_items') THEN
        CREATE POLICY "Users can manage purchase_order_items" ON public.purchase_order_items FOR ALL USING (purchase_order_id IN (SELECT id FROM purchase_orders WHERE company_id IN (SELECT company_id FROM profiles WHERE user_id = auth.uid())));
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
