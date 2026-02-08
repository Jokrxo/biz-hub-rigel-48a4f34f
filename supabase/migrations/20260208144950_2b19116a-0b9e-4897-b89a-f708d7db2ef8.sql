-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id),
  po_number TEXT NOT NULL,
  supplier_name TEXT,
  po_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  currency TEXT DEFAULT 'ZAR',
  exchange_rate NUMERIC(15,4) DEFAULT 1,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view purchase_orders of their company" ON public.purchase_orders FOR SELECT USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can manage purchase_orders of their company" ON public.purchase_orders FOR ALL USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(15,2) DEFAULT 1,
  unit_price NUMERIC(15,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  amount NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view purchase_order_items" ON public.purchase_order_items FOR SELECT USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));
CREATE POLICY "Users can manage purchase_order_items" ON public.purchase_order_items FOR ALL USING (purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())));

-- Add missing columns to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'ZAR';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fiscal_year_start INTEGER DEFAULT 3;