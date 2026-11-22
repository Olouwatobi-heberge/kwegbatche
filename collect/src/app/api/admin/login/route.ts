import { NextRequest } from 'next/server';
import { adminCode, secretsMatch, withAdminCookie } from '@/lib/auth';
import { clientIp, jsonError, jsonOk, rejectCrossSite } from '@/lib/http';
import { loginAllowed, recordLoginFailure } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;

  const expected = adminCode();
  if (!expected) {
    return jsonError('Le code équipe n’est pas configuré (ADMIN_CODE, 8 caractères minimum).', 503);
  }

  const ip = clientIp(req);
  if (!(await loginAllowed(ip))) {
    return jsonError('Trop de tentatives. Réessayez dans quelques minutes.', 429);
  }

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code || !secretsMatch(code, expected)) {
    await recordLoginFailure(ip);
    return jsonError('Code incorrect.', 401);
  }

  return withAdminCookie(jsonOk({ ok: true }));
}
