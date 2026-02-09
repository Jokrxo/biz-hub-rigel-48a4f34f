import { supabase as integratedClient, hasSupabaseEnv as _hasEnv } from '@/integrations/supabase/client'

// Export a non-generic client to avoid TS issues when local types don't include certain tables
export const supabase = integratedClient as any
export const hasSupabaseEnv = _hasEnv
export type { Database } from '@/integrations/supabase/types'
