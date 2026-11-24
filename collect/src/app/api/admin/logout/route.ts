import { NextRequest } from 'next/server';
import { clearAdminCookie } from '@/lib/auth';
import { jsonOk, rejectCrossSite } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;
  return clearAdminCookie(jsonOk({ ok: true }));
}
