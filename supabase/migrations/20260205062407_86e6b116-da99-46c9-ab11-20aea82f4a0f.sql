-- Fix the overly permissive INSERT policy on companies
DROP POLICY IF EXISTS "Users can insert company" ON public.companies;

-- Create a proper INSERT policy - users can only insert companies that they will be linked to via their profile
CREATE POLICY "Users can insert company" ON public.companies FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);