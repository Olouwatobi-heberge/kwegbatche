import type { Recording } from './types';

export const EXPORT_COLUMNS = [
  'file_path',
  'language',
  'intent',
  'phrase_id',
  'sentence',
  'speaker_code',
  'status',
  'duration_ms',
  'gender',
  'age_range',
  'fallback_fr',
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type ExportRow = Record<ExportColumn, string>;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function exportGender(value: string): string {
  if (value === 'femme' || value === 'homme' || value === 'non_dit') return value;
  return '';
}

export function recordingToRow(rec: Recording): ExportRow {
  return {
    file_path: rec.storagePath,
    language: rec.language,
    intent: rec.intent,
    phrase_id: rec.phraseId,
    sentence: rec.sentence,
    speaker_code: rec.speakerCode,
    status: rec.status,
    duration_ms: String(rec.durationMs),
    gender: exportGender(rec.gender),
    age_range: rec.ageRange,
    fallback_fr: rec.fallbackFr ? 'true' : 'false',
  };
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [
    EXPORT_COLUMNS.join(','),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => csvCell(row[column])).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export function toJsonl(rows: ExportRow[]): string {
  if (rows.length === 0) return '';
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}
