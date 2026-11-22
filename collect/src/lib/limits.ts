function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export const limits = {
  maxBytes: 2_000_000,
  minBytes: 150,
  minDurationMs: 300,
  maxDurationMs: 20_000,
  maxExportBytes: 80 * 1024 * 1024,
  ipPerMinute: intFromEnv('COLLECT_LIMIT_IP_PER_MIN', 60),
  ipPerHour: intFromEnv('COLLECT_LIMIT_IP_PER_HOUR', 500),
  speakerPerMinute: intFromEnv('COLLECT_LIMIT_SPEAKER_PER_MIN', 20),
  speakerPerHour: intFromEnv('COLLECT_LIMIT_SPEAKER_PER_HOUR', 150),
  loginPer15Min: intFromEnv('COLLECT_LIMIT_LOGIN_PER_15MIN', 15),
};

export const CLIENT_MAX_MS = 15_000;
