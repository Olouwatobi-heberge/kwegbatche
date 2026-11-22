-- KwèGbaTché, collecte de voix.
-- A coller dans Supabase : SQL Editor, New query, Run.
-- La clé service_role contourne les règles RLS. Le navigateur ne l'a pas.

create extension if not exists pgcrypto;

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  language text not null check (language in ('fon', 'yoruba', 'fr')),
  phrase_id text not null,
  intent text not null,
  sentence text not null,
  fallback_fr boolean not null default false,
  speaker_code text not null,
  gender text not null default '',
  age_range text not null default '',
  consent_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'keep', 'reject')),
  storage_path text not null,
  mime_type text not null,
  duration_ms integer not null,
  size_bytes integer not null,
  reviewed_at timestamptz
);

create index if not exists recordings_language_status_idx
  on public.recordings (language, status);

create index if not exists recordings_speaker_idx
  on public.recordings (speaker_code);

create index if not exists recordings_created_idx
  on public.recordings (created_at desc);

alter table public.recordings enable row level security;

create table if not exists public.rate_buckets (
  ip_hash text not null,
  bucket text not null,
  count integer not null default 0,
  primary key (ip_hash, bucket)
);

alter table public.rate_buckets enable row level security;

create or replace function public.bump_rate(p_hash text, p_bucket text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.rate_buckets as r (ip_hash, bucket, count)
  values (p_hash, p_bucket, 1)
  on conflict (ip_hash, bucket)
  do update set count = r.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.bump_rate(text, text) from public, anon, authenticated;
grant execute on function public.bump_rate(text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  2097152,
  array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac']
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exports',
  'exports',
  false,
  104857600,
  array['application/zip', 'text/csv', 'application/x-ndjson']
)
on conflict (id) do update
set public = false;
