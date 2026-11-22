import 'server-only';
import { createLocalStore } from './local';
import { createSupabaseStore } from './remote';
import { supabaseConfig } from '../supabase';
import type { Store } from './types';

export function storageMode(): 'supabase' | 'local' | 'missing' {
  if (supabaseConfig()) return 'supabase';
  if (process.env.VERCEL) return 'missing';
  return 'local';
}

let local: Store | null = null;
let remote: Store | null = null;

export function getStore(): Store {
  const mode = storageMode();
  if (mode === 'missing') throw new Error('MISSING_STORE');
  if (mode === 'supabase') {
    if (!remote) remote = createSupabaseStore();
    return remote;
  }
  if (!local) local = createLocalStore();
  return local;
}
