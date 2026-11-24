import { NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isMissingStore, jsonError, jsonOk } from '@/lib/http';
import { getStore } from '@/lib/storage';
import { isStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!isAdmin(req)) return jsonError('Non autorisé.', 401);
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) return jsonError('Identifiant invalide.', 400);

  const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
  const status = typeof body?.status === 'string' ? body.status : '';
  if (!isStatus(status)) return jsonError('Statut invalide.', 400);

  try {
    const updated = await getStore().setStatus(id, status);
    if (!updated) return jsonError('Piste introuvable.', 404);
    return jsonOk({ recording: updated });
  } catch (error) {
    if (isMissingStore(error)) {
      return jsonError('Stockage non configuré.', 503);
    }
    console.error('update status failed');
    return jsonError('Mise à jour impossible.', 500);
  }
}
