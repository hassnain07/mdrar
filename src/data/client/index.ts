/**
 * Active DataSource — selected by VITE_DATA_SOURCE env var.
 * Vite statically replaces import.meta.env.VITE_DATA_SOURCE at build time,
 * so the unused branch is tree-shaken from the bundle.
 *
 * To switch to Supabase: set VITE_DATA_SOURCE=supabase in .env.local
 * and ensure VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are filled in.
 */
import type { DataSource } from './dataSource';

const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock';

if (source !== 'mock' && source !== 'supabase') {
  throw new Error(`Unknown VITE_DATA_SOURCE="${source}". Must be "mock" or "supabase".`);
}

// Both imports are always bundled but only one is used at runtime.
// Vite's tree-shaking removes the unused one in production builds.
import { mockDataSource } from './mock/index';
import { supabaseDataSource } from './supabase/index';

export const dataSource: DataSource = source === 'supabase' ? supabaseDataSource : mockDataSource;
