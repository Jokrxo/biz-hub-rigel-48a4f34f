import { createClient } from '@supabase/supabase-js'

// Lovable's Supabase integration might provide these differently
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

// Create a mock client if environment variables are not available
// This allows the app to load while waiting for proper Supabase configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Database = {
  public: {
    Tables: {
      trial_balances: {
        Row: {
          id: string
          user_id: string
          account_name: string
          account_code: string
          debit: number
          credit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_name: string
          account_code: string
          debit?: number
          credit?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          account_name?: string
          account_code?: string
          debit?: number
          credit?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}