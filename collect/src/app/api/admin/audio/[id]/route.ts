import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isMissingStore, jsonError } from '@/lib/http';
import { getStore } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!isAdmin(req)) return jsonError('Non autorisé.', 401);
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return jsonError('Identifiant invalide.', 400);

  try {
    const audio = await getStore().getAudio(id);
    if (!audio) return jsonError('Audio introuvable.', 404);
    return new NextResponse(new Uint8Array(audio.data), {
      headers: {
        'Content-Type': audio.mime,
        'Content-Length': String(audio.data.length),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (isMissingStore(error)) return jsonError('Stockage non configuré.', 503);
    console.error('audio read failed');
    return jsonError('Lecture audio impossible.', 500);
  }
}
