import { jsonOk } from '@/lib/http';
import { storageMode } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const storage = storageMode();
  return jsonOk({ ok: storage !== 'missing', storage });
}
