import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function cleanBucket(value: string | undefined, fallback: string): string {
  const name = (value ?? '').trim();
  if (/^[a-z0-9][a-z0-9_-]{0,40}$/.test(name)) return name;
  return fallback;
}

export function supabaseConfig(): {
  url: string;
  key: string;
  bucket: string;
  exportBucket: string;
} | null {
  const url = (process.env.SUPABASE_URL ?? '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return {
    url,
    key,
    bucket: cleanBucket(process.env.SUPABASE_BUCKET, 'recordings'),
    exportBucket: cleanBucket(process.env.SUPABASE_EXPORT_BUCKET, 'exports'),
  };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const config = supabaseConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
