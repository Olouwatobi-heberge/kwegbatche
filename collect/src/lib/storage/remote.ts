import 'server-only';
import { randomUUID } from 'crypto';
import type { Recording, RecordingStatus } from '../types';
import { computeStats } from './stats';
import { getSupabase, supabaseConfig } from '../supabase';
import type { ListFilters, SaveInput, Store } from './types';

function asBlob(bytes: Buffer, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

type Row = {
  id: string;
  created_at: string;
  language: Recording['language'];
  phrase_id: string;
  intent: string;
  sentence: string;
  fallback_fr: boolean;
  speaker_code: string;
  gender: string;
  age_range: string;
  consent_at: string;
  status: RecordingStatus;
  storage_path: string;
  mime_type: string;
  duration_ms: number;
  size_bytes: number;
  reviewed_at: string | null;
};

function fromRow(row: Row): Recording {
  return {
    id: row.id,
    createdAt: row.created_at,
    language: row.language,
    phraseId: row.phrase_id,
    intent: row.intent,
    sentence: row.sentence,
    fallbackFr: row.fallback_fr,
    speakerCode: row.speaker_code,
    gender: row.gender ?? '',
    ageRange: row.age_range ?? '',
    consentAt: row.consent_at,
    status: row.status,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    durationMs: row.duration_ms,
    sizeBytes: row.size_bytes,
    reviewedAt: row.reviewed_at,
  };
}

export function createSupabaseStore(): Store {
  const supabase = getSupabase();
  const config = supabaseConfig();
  if (!supabase || !config) throw new Error('MISSING_STORE');
  const bucket = config.bucket;

  return {
    mode: 'supabase',
    async save(input: SaveInput) {
      const id = randomUUID();
      const storagePath = `${input.language}/${id}.${input.extension}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(
        storagePath,
        asBlob(input.bytes, input.mimeType),
        { contentType: input.mimeType, upsert: false },
      );
      if (uploadError) throw new Error(uploadError.message);

      const createdAt = new Date().toISOString();
      const row: Row = {
        id,
        created_at: createdAt,
        language: input.language,
        phrase_id: input.phraseId,
        intent: input.intent,
        sentence: input.sentence,
        fallback_fr: input.fallbackFr,
        speaker_code: input.speakerCode,
        gender: input.gender,
        age_range: input.ageRange,
        consent_at: createdAt,
        status: 'pending',
        storage_path: storagePath,
        mime_type: input.mimeType,
        duration_ms: input.durationMs,
        size_bytes: input.bytes.length,
        reviewed_at: null,
      };
      const { error } = await supabase.from('recordings').insert(row);
      if (error) {
        await supabase.storage.from(bucket).remove([storagePath]);
        throw new Error(error.message);
      }
      return fromRow(row);
    },
    async list(filters: ListFilters) {
      let query = supabase.from('recordings').select('*').order('created_at', { ascending: false }).limit(300);
      if (filters.language) query = query.eq('language', filters.language);
      if (filters.status) query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return ((data ?? []) as Row[]).map(fromRow);
    },
    async stats() {
      const rows: Array<Pick<Recording, 'language' | 'status' | 'speakerCode'>> = [];
      const page = 1000;
      for (let from = 0; from < 20_000; from += page) {
        const { data, error } = await supabase
          .from('recordings')
          .select('language,status,speaker_code')
          .range(from, from + page - 1);
        if (error) throw new Error(error.message);
        const batch = data ?? [];
        for (const row of batch) {
          rows.push({
            language: row.language as Recording['language'],
            status: row.status as RecordingStatus,
            speakerCode: String(row.speaker_code ?? ''),
          });
        }
        if (batch.length < page) break;
      }
      return computeStats(rows);
    },
    async setStatus(id: string, status: RecordingStatus) {
      const reviewedAt = status === 'pending' ? null : new Date().toISOString();
      const { data, error } = await supabase
        .from('recordings')
        .update({ status, reviewed_at: reviewedAt })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return fromRow(data as Row);
    },
    async getAudio(id: string) {
      const { data, error } = await supabase.from('recordings').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = fromRow(data as Row);
      const downloaded = await supabase.storage.from(bucket).download(row.storagePath);
      if (downloaded.error || !downloaded.data) return null;
      const bytes = Buffer.from(await downloaded.data.arrayBuffer());
      return { data: bytes, mime: row.mimeType };
    },
    async listKept(language?: string) {
      const out: Recording[] = [];
      const page = 1000;
      for (let from = 0; from < 5000; from += page) {
        let query = supabase
          .from('recordings')
          .select('*')
          .eq('status', 'keep')
          .order('created_at', { ascending: true })
          .range(from, from + page - 1);
        if (language) query = query.eq('language', language);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const batch = (data ?? []) as Row[];
        out.push(...batch.map(fromRow));
        if (batch.length < page) break;
      }
      return out;
    },
  };
}

export async function signedExportUrl(bytes: Buffer): Promise<string | null> {
  const supabase = getSupabase();
  const config = supabaseConfig();
  if (!supabase || !config) return null;
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const objectPath = `zips/kwegbatche-voix-${stamp}-${randomUUID()}.zip`;
  const { error } = await supabase.storage.from(config.exportBucket).upload(
    objectPath,
    asBlob(bytes, 'application/zip'),
    { contentType: 'application/zip', upsert: false },
  );
  if (error) throw new Error(error.message);
  const signed = await supabase.storage.from(config.exportBucket).createSignedUrl(objectPath, 60 * 60, {
    download: 'kwegbatche-voix-gardees.zip',
  });
  if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || 'lien export vide');
  return signed.data.signedUrl;
}
