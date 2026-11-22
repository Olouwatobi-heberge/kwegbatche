import 'server-only';
import { sniffAudio } from './audio';
import { limits } from './limits';
import { getPhrase } from './phrases';
import { promptFor } from './prompt';
import { cleanSpeaker } from './speaker';
import { AGE_RANGES, GENDERS, isLanguage, type Language } from './types';

export type ParsedUpload = {
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

export type ParseResult =
  | { ok: true; value: ParsedUpload }
  | { ok: false; error: string; status: number };

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value) && typeof value === 'object' && typeof (value as File).arrayBuffer === 'function';
}

export async function parseSubmission(form: FormData): Promise<ParseResult> {
  if (String(form.get('consent') ?? '') !== 'yes') {
    return { ok: false, error: 'Le consentement est obligatoire.', status: 400 };
  }

  const languageRaw = String(form.get('language') ?? '');
  if (!isLanguage(languageRaw)) {
    return { ok: false, error: 'Choisissez une langue.', status: 400 };
  }

  const phrase = getPhrase(String(form.get('phraseId') ?? ''));
  if (!phrase) return { ok: false, error: 'Phrase inconnue.', status: 400 };

  const durationMs = Number(form.get('durationMs'));
  if (!Number.isFinite(durationMs) || durationMs < limits.minDurationMs || durationMs > limits.maxDurationMs) {
    return {
      ok: false,
      error: 'La durée doit rester entre une demi-seconde et 20 secondes.',
      status: 400,
    };
  }

  const gender = String(form.get('gender') ?? '').trim();
  if (gender && !GENDERS.includes(gender as (typeof GENDERS)[number])) {
    return { ok: false, error: 'Valeur de sexe non reconnue.', status: 400 };
  }

  const ageRange = String(form.get('ageRange') ?? '').trim();
  if (ageRange && !AGE_RANGES.includes(ageRange as (typeof AGE_RANGES)[number])) {
    return { ok: false, error: 'Tranche d’âge non reconnue.', status: 400 };
  }

  const speakerCode = cleanSpeaker(String(form.get('speakerCode') ?? ''));
  if (!speakerCode) {
    return {
      ok: false,
      error: 'Le code locuteur doit faire 2 à 32 caractères : lettres, chiffres ou tiret.',
      status: 400,
    };
  }

  const audio = form.get('audio');
  if (!isFile(audio)) return { ok: false, error: 'Audio manquant.', status: 400 };
  if (audio.size < limits.minBytes) return { ok: false, error: 'Fichier audio trop petit.', status: 400 };
  if (audio.size > limits.maxBytes) {
    return { ok: false, error: 'Fichier trop lourd (2 Mo maximum).', status: 413 };
  }

  const bytes = Buffer.from(await audio.arrayBuffer());
  if (bytes.length > limits.maxBytes) {
    return { ok: false, error: 'Fichier trop lourd (2 Mo maximum).', status: 413 };
  }
  const sniffed = sniffAudio(bytes, audio.type || '');
  if (!sniffed) return { ok: false, error: 'Format audio non accepté.', status: 400 };

  const shown = promptFor(phrase, languageRaw);
  return {
    ok: true,
    value: {
      language: languageRaw,
      phraseId: phrase.id,
      intent: phrase.intent,
      sentence: shown.text,
      fallbackFr: shown.fallbackFr,
      speakerCode,
      gender,
      ageRange,
      durationMs: Math.round(durationMs),
      mimeType: sniffed.mime,
      extension: sniffed.ext,
      bytes,
    },
  };
}
