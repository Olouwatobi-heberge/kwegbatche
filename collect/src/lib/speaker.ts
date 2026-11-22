import { randomBytes } from 'crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateSpeaker(): string {
  const bytes = randomBytes(6);
  let code = 'loc-';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

export function cleanSpeaker(raw: string): string | null {
  const value = raw.trim();
  if (!value) return generateSpeaker();
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(value)) return null;
  return value;
}
