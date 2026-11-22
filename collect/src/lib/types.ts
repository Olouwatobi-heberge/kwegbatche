export type Language = 'fon' | 'yoruba' | 'fr';

export type RecordingStatus = 'pending' | 'keep' | 'reject';

export type Phrase = {
  id: string;
  intent: string;
  fr: string;
  fon: string;
  yo: string;
};

export type Recording = {
  id: string;
  createdAt: string;
  language: Language;
  phraseId: string;
  intent: string;
  sentence: string;
  fallbackFr: boolean;
  speakerCode: string;
  gender: string;
  ageRange: string;
  consentAt: string;
  status: RecordingStatus;
  storagePath: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
  reviewedAt: string | null;
};

export type LangStat = {
  pending: number;
  keep: number;
  reject: number;
  total: number;
};

export type SpeakerStat = {
  speakerCode: string;
  total: number;
  keep: number;
  languages: Language[];
};

export type Stats = {
  byLanguage: Record<Language, LangStat>;
  bySpeaker: SpeakerStat[];
  total: number;
};

export const LANGUAGES: Language[] = ['fon', 'yoruba', 'fr'];

export const GENDERS = ['femme', 'homme', 'autre', 'non_dit'] as const;
export const AGE_RANGES = ['18-25', '26-35', '36-50', '51+'] as const;

export function isLanguage(value: string): value is Language {
  return value === 'fon' || value === 'yoruba' || value === 'fr';
}

export function isStatus(value: string): value is RecordingStatus {
  return value === 'pending' || value === 'keep' || value === 'reject';
}
