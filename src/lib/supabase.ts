import { supabase as integratedClient } from '@/integrations/supabase/client'

const useStub = String(import.meta.env.VITE_USE_STUB || '').toLowerCase() === 'true'

function createStub() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => builder,
    returns: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
  }
  const channel = {
    on: () => channel,
    subscribe: () => 'SUBSCRIBED',
  }
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: (_event: any, _cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async (_opts: any) => ({ data: { session: null, user: null }, error: null }),
      signUp: async (_opts: any) => ({ data: { user: null }, error: null }),
      resetPasswordForEmail: async (_email: string) => ({ data: {}, error: null }),
      signOut: async () => ({ data: {}, error: null }),
    },
    channel: () => channel,
    removeChannel: () => {},
    from: () => builder,
  } as any
}

export const supabase = useStub ? createStub() : (integratedClient as any)
export type { Database } from '@/integrations/supabase/types'
