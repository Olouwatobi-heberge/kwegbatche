import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'kgb_admin';
const MAX_AGE_SEC = 60 * 60 * 12;

export function adminCode(): string | null {
  const code = process.env.ADMIN_CODE?.trim() ?? '';
  if (code.length < 8) return null;
  return code;
}

export function secretsMatch(input: string, expected: string): boolean {
  const left = createHash('sha256').update(input).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

function sign(exp: number, code: string): string {
  const payload = String(exp);
  const mac = createHmac('sha256', code).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function verifyToken(token: string | undefined): boolean {
  const code = adminCode();
  if (!token || !code) return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = createHmac('sha256', code).update(payload).digest('base64url');
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isAdmin(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(COOKIE)?.value);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.VERCEL === '1',
    path: '/',
  };
}

export function withAdminCookie(res: NextResponse) {
  const code = adminCode();
  if (!code) return res;
  const exp = Date.now() + MAX_AGE_SEC * 1000;
  res.cookies.set(COOKIE, sign(exp, code), { ...cookieOptions(), maxAge: MAX_AGE_SEC });
  return res;
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return res;
}
