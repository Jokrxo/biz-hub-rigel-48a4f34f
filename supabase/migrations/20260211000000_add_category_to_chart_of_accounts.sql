-- Add category and sub_category columns to chart_of_accounts table
ALTER TABLE public.chart_of_accounts
ADD COLUMN category TEXT,
ADD COLUMN sub_category TEXT;

-- Create index for better query performance
CREATE INDEX idx_chart_of_accounts_category ON public.chart_of_accounts(company_id, category, sub_category);
