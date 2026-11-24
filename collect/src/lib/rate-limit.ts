import 'server-only';
import { createHash } from 'crypto';
import { limits } from './limits';
import { getSupabase } from './supabase';

type Bucket = { count: number; reset: number };

const memory = new Map<string, Bucket>();
let warned = false;

function salt(): string {
  return process.env.RATE_LIMIT_SALT?.trim() || process.env.ADMIN_CODE?.trim() || 'kwegbatche-collect';
}

export function hashKey(value: string): string {
  return createHash('sha256').update(`${salt()}|${value}`).digest('hex');
}

function prune(now: number) {
  if (memory.size < 4000) return;
  for (const [key, bucket] of memory) {
    if (bucket.reset <= now) memory.delete(key);
  }
}

function peek(key: string, now: number): number {
  const found = memory.get(key);
  if (!found || found.reset <= now) return 0;
  return found.count;
}

function hit(key: string, limit: number, windowMs: number, now: number): boolean {
  prune(now);
  const found = memory.get(key);
  if (!found || found.reset <= now) {
    memory.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (found.count >= limit) return false;
  found.count += 1;
  return true;
}

async function bumpDb(hash: string, bucket: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('bump_rate', { p_hash: hash, p_bucket: bucket });
  if (error) {
    if (!warned) {
      warned = true;
      console.error('Limite de débit indisponible, repli mémoire.');
    }
    return null;
  }
  return typeof data === 'number' ? data : Number(data);
}

async function countDb(hash: string, bucket: string): Promise<number | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('rate_buckets')
    .select('count')
    .eq('ip_hash', hash)
    .eq('bucket', bucket)
    .maybeSingle();
  if (error || !data) return error ? null : 0;
  return typeof data.count === 'number' ? data.count : 0;
}

const TOO_MANY = 'Trop d’envois. Patientez un peu, puis réessayez.';

export async function allowUpload(
  ip: string,
  speakerRaw: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = Date.now();
  const minute = Math.floor(now / 60_000);
  const hour = Math.floor(now / 3_600_000);
  const ipHash = hashKey(`ip:${ip}`);
  const rules: Array<{ mem: string; hash: string; bucket: string; limit: number; windowMs: number }> = [
    {
      mem: `ipm:${ipHash}:${minute}`,
      hash: ipHash,
      bucket: `m:${minute}`,
      limit: limits.ipPerMinute,
      windowMs: 60_000,
    },
    {
      mem: `iph:${ipHash}:${hour}`,
      hash: ipHash,
      bucket: `h:${hour}`,
      limit: limits.ipPerHour,
      windowMs: 3_600_000,
    },
  ];

  const speaker = speakerRaw.trim().slice(0, 40);
  if (speaker) {
    const speakerHash = hashKey(`sp:${speaker}`);
    rules.push(
      {
        mem: `spm:${speakerHash}:${minute}`,
        hash: speakerHash,
        bucket: `sm:${minute}`,
        limit: limits.speakerPerMinute,
        windowMs: 60_000,
      },
      {
        mem: `sph:${speakerHash}:${hour}`,
        hash: speakerHash,
        bucket: `sh:${hour}`,
        limit: limits.speakerPerHour,
        windowMs: 3_600_000,
      },
    );
  }

  for (const rule of rules) {
    if (!hit(rule.mem, rule.limit, rule.windowMs, now)) {
      return { ok: false, message: TOO_MANY };
    }
  }

  const counts = await Promise.all(rules.map((rule) => bumpDb(rule.hash, rule.bucket)));
  for (let i = 0; i < rules.length; i += 1) {
    const count = counts[i];
    if (count !== null && count > rules[i].limit) return { ok: false, message: TOO_MANY };
  }
  return { ok: true };
}

function loginWindow(now: number): string {
  return `login:${Math.floor(now / (15 * 60_000))}`;
}

export async function loginAllowed(ip: string): Promise<boolean> {
  const now = Date.now();
  const bucket = loginWindow(now);
  const hash = hashKey(`ip:${ip}`);
  if (peek(`${bucket}:${hash}`, now) >= limits.loginPer15Min) return false;
  const db = await countDb(hash, bucket);
  if (db !== null && db >= limits.loginPer15Min) return false;
  return true;
}

export async function recordLoginFailure(ip: string): Promise<void> {
  const now = Date.now();
  const bucket = loginWindow(now);
  const hash = hashKey(`ip:${ip}`);
  hit(`${bucket}:${hash}`, limits.loginPer15Min, 15 * 60_000, now);
  await bumpDb(hash, bucket);
}
