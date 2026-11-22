import { zipSync } from 'fflate';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { recordingToRow, toCsv, toJsonl } from '@/lib/export-format';
import { isMissingStore, jsonError } from '@/lib/http';
import { limits } from '@/lib/limits';
import { signedExportUrl } from '@/lib/storage/remote';
import { getStore, storageMode } from '@/lib/storage';
import { isLanguage } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index]);
    }
  }
  const workers = Math.min(size, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return jsonError('Non autorisé.', 401);

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'csv';
  const language = url.searchParams.get('language')?.trim() ?? '';
  if (language && !isLanguage(language)) return jsonError('Langue inconnue.', 400);
  if (format !== 'csv' && format !== 'jsonl' && format !== 'zip') {
    return jsonError('Format inconnu.', 400);
  }

  try {
    const store = getStore();
    const kept = await store.listKept(language || undefined);
    const rows = kept.map(recordingToRow);

    if (format === 'csv') {
      return new NextResponse(`\uFEFF${toCsv(rows)}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="kwegbatche-manifest.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format === 'jsonl') {
      return new NextResponse(toJsonl(rows), {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Content-Disposition': 'attachment; filename="kwegbatche-manifest.jsonl"',
          'Cache-Control': 'no-store',
        },
      });
    }

    const totalBytes = kept.reduce((sum, rec) => sum + rec.sizeBytes, 0);
    if (totalBytes > limits.maxExportBytes) {
      return jsonError(
        'Trop de données pour une seule archive. Filtrez par langue, ou téléchargez le CSV.',
        413,
      );
    }

    const packed = await mapPool(kept, 6, async (rec) => {
      const audio = await store.getAudio(rec.id);
      return { rec, audio };
    });
    const files: Record<string, Uint8Array> = {};
    const included = [];
    for (const item of packed) {
      if (!item.audio) continue;
      files[item.rec.storagePath] = new Uint8Array(item.audio.data);
      included.push(recordingToRow(item.rec));
    }
    files['manifest.csv'] = new TextEncoder().encode(`\uFEFF${toCsv(included)}`);
    const zipped = Buffer.from(zipSync(files, { level: 6 }));

    if (storageMode() === 'supabase' && zipped.length > 3_500_000) {
      const signed = await signedExportUrl(zipped);
      if (!signed) return jsonError('Export impossible pour le moment.', 500);
      return NextResponse.redirect(signed, { status: 302 });
    }

    return new NextResponse(new Uint8Array(zipped), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="kwegbatche-voix-gardees.zip"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (isMissingStore(error)) return jsonError('Stockage non configuré.', 503);
    console.error('export failed');
    return jsonError('Export impossible. Essayez le CSV, ou une seule langue.', 500);
  }
}
