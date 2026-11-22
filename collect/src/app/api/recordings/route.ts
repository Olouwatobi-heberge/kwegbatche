import { NextRequest } from 'next/server';
import { limits } from '@/lib/limits';
import { allowUpload } from '@/lib/rate-limit';
import { parseSubmission } from '@/lib/submission';
import { getStore } from '@/lib/storage';
import { clientIp, isMissingStore, jsonError, jsonOk, rejectCrossSite } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;

  const declared = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(declared) && declared > limits.maxBytes + 600_000) {
    await allowUpload(clientIp(req), '');
    return jsonError('Fichier trop lourd (2 Mo maximum).', 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Envoi illisible.', 400);
  }

  const ip = clientIp(req);
  const speakerRaw = String(form.get('speakerCode') ?? '');
  const quota = await allowUpload(ip, speakerRaw);
  if (!quota.ok) return jsonError(quota.message, 429);

  if (String(form.get('societe') ?? '').trim() !== '') {
    const shown = speakerRaw.trim();
    return jsonOk({ ok: true, id: '0', speakerCode: shown || 'loc-000000' });
  }

  const parsed = await parseSubmission(form);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  try {
    const saved = await getStore().save(parsed.value);
    return jsonOk({ ok: true, id: saved.id, speakerCode: saved.speakerCode });
  } catch (error) {
    if (isMissingStore(error)) {
      return jsonError(
        'Stockage non configuré. Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.',
        503,
      );
    }
    console.error('save recording failed');
    return jsonError('Enregistrement impossible pour le moment.', 500);
  }
}
