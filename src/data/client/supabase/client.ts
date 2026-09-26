import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Only create the client if credentials are present.
// If VITE_DATA_SOURCE=supabase but credentials are missing, the first actual
// call will throw a clear error via the guard below.
export const supabase: SupabaseClient = (url && key)
  ? createClient(url, key)
  : new Proxy({} as SupabaseClient, {
      get(_t, prop) {
        if (prop === 'then') return undefined; // not a Promise
        throw new Error(
          'VITE_DATA_SOURCE=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set in .env.local',
        );
      },
    });
