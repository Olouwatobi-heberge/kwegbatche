import { NextRequest } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { isMissingStore, jsonError, jsonOk } from '@/lib/http';
import { getStore } from '@/lib/storage';
import { isLanguage, isStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return jsonError('Non autorisé.', 401);

  const url = new URL(req.url);
  const language = url.searchParams.get('language')?.trim() ?? '';
  const status = url.searchParams.get('status')?.trim() ?? '';
  if (language && !isLanguage(language)) return jsonError('Langue inconnue.', 400);
  if (status && !isStatus(status)) return jsonError('Statut inconnu.', 400);

  try {
    const store = getStore();
    const [recordings, stats] = await Promise.all([
      store.list({ language, status }),
      store.stats(),
    ]);
    return jsonOk({ recordings, stats });
  } catch (error) {
    if (isMissingStore(error)) {
      return jsonError(
        'Stockage non configuré. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
        503,
      );
    }
    console.error('list recordings failed');
    return jsonError('Lecture impossible pour le moment.', 500);
  }
}
