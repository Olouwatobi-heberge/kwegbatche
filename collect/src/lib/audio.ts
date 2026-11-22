const ALLOWED_MIME = new Set([
  'audio/webm',
  'video/webm',
  'audio/mp4',
  'video/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'application/ogg',
  'audio/opus',
]);

export function normalizeMime(mime: string): string {
  return mime.split(';')[0]?.trim().toLowerCase() ?? '';
}

export type SniffedAudio = {
  ext: 'webm' | 'm4a' | 'mp3' | 'wav' | 'ogg';
  mime: string;
};

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.subarray(start, end).toString('ascii');
}

export function sniffAudio(buf: Buffer, declaredMime: string): SniffedAudio | null {
  const mime = normalizeMime(declaredMime);
  const loose = mime === '' || mime === 'application/octet-stream';
  if (!loose && !ALLOWED_MIME.has(mime)) return null;
  if (buf.length < 12) return null;

  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WAVE') {
    if (!loose && !['audio/wav', 'audio/wave', 'audio/x-wav'].includes(mime)) return null;
    return { ext: 'wav', mime: 'audio/wav' };
  }

  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    if (!loose && mime !== 'audio/webm' && mime !== 'video/webm' && mime !== 'audio/opus') return null;
    return { ext: 'webm', mime: 'audio/webm' };
  }

  if (ascii(buf, 0, 4) === 'OggS') {
    if (!loose && mime !== 'audio/ogg' && mime !== 'application/ogg' && mime !== 'audio/opus') return null;
    return { ext: 'ogg', mime: 'audio/ogg' };
  }

  if (ascii(buf, 4, 8) === 'ftyp') {
    if (
      !loose &&
      !['audio/mp4', 'video/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac'].includes(mime)
    ) {
      return null;
    }
    return { ext: 'm4a', mime: 'audio/mp4' };
  }

  if (ascii(buf, 0, 3) === 'ID3') {
    if (!loose && mime !== 'audio/mpeg' && mime !== 'audio/mp3') return null;
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }

  if ((mime === 'audio/mpeg' || mime === 'audio/mp3') && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }

  return null;
}
