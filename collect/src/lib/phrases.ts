import 'server-only';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Phrase } from './types';

function locate(): string {
  const candidates = [
    path.join(process.cwd(), 'script', 'phrases.csv'),
    path.join(process.cwd(), 'collect', 'script', 'phrases.csv'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('phrases.csv introuvable');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

export function loadPhrases(): Phrase[] {
  const rows = parseCsv(readFileSync(locate(), 'utf8'));
  const header = rows[0]?.map((value) => value.trim()) ?? [];
  if (header.join(',') !== 'id,intent,fr,fon,yo') {
    throw new Error('En-tête CSV invalide');
  }

  const phrases: Phrase[] = [];
  const seen = new Set<string>();
  for (const cells of rows.slice(1)) {
    const [id = '', intent = '', fr = '', fon = '', yo = ''] = cells.map((value) => value.trim());
    if (!/^[a-z0-9_]+$/.test(id)) throw new Error(`Identifiant de phrase invalide : ${id}`);
    if (!/^[a-z0-9_]+$/.test(intent)) throw new Error(`Intention invalide : ${intent}`);
    if (!fr) throw new Error(`Phrase française vide : ${id}`);
    if (seen.has(id)) throw new Error(`Identifiant en double : ${id}`);
    seen.add(id);
    phrases.push({ id, intent, fr, fon, yo });
  }

  return phrases;
}

export function getPhrase(id: string): Phrase | undefined {
  return loadPhrases().find((phrase) => phrase.id === id);
}
