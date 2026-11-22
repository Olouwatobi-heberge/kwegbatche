import type { Language, Recording, RecordingStatus, Stats } from '../types';

export type SaveInput = {
  language: Language;
  phraseId: string;
  intent: string;
  sentence: string;
  fallbackFr: boolean;
  speakerCode: string;
  gender: string;
  ageRange: string;
  durationMs: number;
  mimeType: string;
  extension: string;
  bytes: Buffer;
};

export type ListFilters = {
  language?: string;
  status?: string;
};

export interface Store {
  mode: 'local' | 'supabase';
  save(input: SaveInput): Promise<Recording>;
  list(filters: ListFilters): Promise<Recording[]>;
  stats(): Promise<Stats>;
  setStatus(id: string, status: RecordingStatus): Promise<Recording | null>;
  getAudio(id: string): Promise<{ data: Buffer; mime: string } | null>;
  listKept(language?: string): Promise<Recording[]>;
}
