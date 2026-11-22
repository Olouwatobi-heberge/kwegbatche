import 'server-only';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import type { Recording, RecordingStatus } from '../types';
import { computeStats } from './stats';
import type { ListFilters, SaveInput, Store } from './types';

type Database = { recordings: Recording[] };

function dataDir(): string {
  return process.env.LOCAL_DATA_DIR?.trim() || path.join(process.cwd(), '.data');
}

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readDb(dir: string): Promise<Database> {
  try {
    const raw = await readFile(path.join(dir, 'recordings.json'), 'utf8');
    const parsed = JSON.parse(raw) as Database;
    if (!Array.isArray(parsed.recordings)) return { recordings: [] };
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { recordings: [] };
    throw error;
  }
}

async function writeDb(dir: string, db: Database) {
  const target = path.join(dir, 'recordings.json');
  const tmp = `${target}.tmp`;
  await writeFile(tmp, JSON.stringify(db));
  await rename(tmp, target);
}

function safeFile(dir: string, storagePath: string): string {
  const root = path.resolve(dir, 'files');
  const full = path.resolve(root, storagePath);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    throw new Error('chemin invalide');
  }
  return full;
}

function matches(rec: Recording, filters: ListFilters): boolean {
  if (filters.language && rec.language !== filters.language) return false;
  if (filters.status && rec.status !== filters.status) return false;
  return true;
}

export function createLocalStore(): Store {
  const dir = dataDir();

  return {
    mode: 'local',
    async save(input: SaveInput) {
      return withLock(async () => {
        await mkdir(dir, { recursive: true });
        const id = randomUUID();
        const storagePath = `${input.language}/${id}.${input.extension}`;
        const full = safeFile(dir, storagePath);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, input.bytes);
        const recording: Recording = {
          id,
          createdAt: new Date().toISOString(),
          language: input.language,
          phraseId: input.phraseId,
          intent: input.intent,
          sentence: input.sentence,
          fallbackFr: input.fallbackFr,
          speakerCode: input.speakerCode,
          gender: input.gender,
          ageRange: input.ageRange,
          consentAt: new Date().toISOString(),
          status: 'pending',
          storagePath,
          mimeType: input.mimeType,
          durationMs: input.durationMs,
          sizeBytes: input.bytes.length,
          reviewedAt: null,
        };
        const db = await readDb(dir);
        db.recordings.push(recording);
        await writeDb(dir, db);
        return recording;
      });
    },
    async list(filters: ListFilters) {
      return withLock(async () => {
        const db = await readDb(dir);
        return db.recordings
          .filter((rec) => matches(rec, filters))
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 300);
      });
    },
    async stats() {
      return withLock(async () => computeStats(await (await readDb(dir)).recordings));
    },
    async setStatus(id: string, status: RecordingStatus) {
      return withLock(async () => {
        const db = await readDb(dir);
        const found = db.recordings.find((rec) => rec.id === id);
        if (!found) return null;
        found.status = status;
        found.reviewedAt = status === 'pending' ? null : new Date().toISOString();
        await writeDb(dir, db);
        return found;
      });
    },
    async getAudio(id: string) {
      return withLock(async () => {
        const db = await readDb(dir);
        const found = db.recordings.find((rec) => rec.id === id);
        if (!found) return null;
        try {
          const data = await readFile(safeFile(dir, found.storagePath));
          return { data, mime: found.mimeType };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
          throw error;
        }
      });
    },
    async listKept(language?: string) {
      return withLock(async () => {
        const db = await readDb(dir);
        return db.recordings
          .filter((rec) => rec.status === 'keep' && (!language || rec.language === language))
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      });
    },
  };
}
