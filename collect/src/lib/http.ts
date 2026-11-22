import { NextRequest, NextResponse } from 'next/server';

export function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 80);
  return '0.0.0.0';
}

export function rejectCrossSite(req: NextRequest): NextResponse | null {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return jsonError('Requête refusée.', 403);
  }

  const origin = req.headers.get('origin');
  if (origin) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    try {
      if (host && new URL(origin).host !== host) return jsonError('Requête refusée.', 403);
    } catch {
      return jsonError('Requête refusée.', 403);
    }
  }

  if (req.headers.get('x-kwegbatche-client') !== 'web') {
    return jsonError('Requête refusée.', 400);
  }

  return null;
}

export function isMissingStore(error: unknown): boolean {
  return error instanceof Error && error.message === 'MISSING_STORE';
}
