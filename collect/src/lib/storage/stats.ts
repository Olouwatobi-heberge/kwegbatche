import { LANGUAGES, type Language, type Recording, type Stats } from '../types';

export function emptyStats(): Stats {
  const byLanguage = {
    fon: { pending: 0, keep: 0, reject: 0, total: 0 },
    yoruba: { pending: 0, keep: 0, reject: 0, total: 0 },
    fr: { pending: 0, keep: 0, reject: 0, total: 0 },
  };
  return { byLanguage, bySpeaker: [], total: 0 };
}

export function computeStats(
  rows: Array<Pick<Recording, 'language' | 'status' | 'speakerCode'>>,
): Stats {
  const stats = emptyStats();
  const speakers = new Map<string, { total: number; keep: number; languages: Set<Language> }>();

  for (const row of rows) {
    if (!LANGUAGES.includes(row.language)) continue;
    const bucket = stats.byLanguage[row.language];
    bucket.total += 1;
    bucket[row.status] += 1;
    stats.total += 1;

    const speaker = speakers.get(row.speakerCode) ?? {
      total: 0,
      keep: 0,
      languages: new Set<Language>(),
    };
    speaker.total += 1;
    if (row.status === 'keep') speaker.keep += 1;
    speaker.languages.add(row.language);
    speakers.set(row.speakerCode, speaker);
  }

  stats.bySpeaker = [...speakers.entries()]
    .map(([speakerCode, value]) => ({
      speakerCode,
      total: value.total,
      keep: value.keep,
      languages: [...value.languages],
    }))
    .sort((a, b) => b.total - a.total || a.speakerCode.localeCompare(b.speakerCode, 'fr'));

  return stats;
}
