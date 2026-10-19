import 'server-only';
import { sql } from '@/lib/db';
import { decrypt, hmacSha256Hex, safeEqual } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/ratelimit';

/**
 * Qurilma so'rovlarini tekshirish:
 *   X-QQ-Key:       qurilma kaliti identifikatori (qqd_...)
 *   X-QQ-Timestamp: unix soniyalar (±300 s — eski so'rovni qayta yuborish hujumidan himoya)
 *   X-QQ-Signature: hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))
 */
export const MAX_BODY = 640 * 1024;
const SKEW_SEC = 300;

/** Tanani bayt chegarasi bilan o'qiydi (Content-Length bo'lmasa ham xotirani to'ldirib bo'lmaydi). */
async function readCapped(req: Request, max: number): Promise<string> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new DeviceAuthError(413, 'So\'rov juda katta');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export class DeviceAuthError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export interface DeviceCtx { id: string; siteId: string; name: string }

export async function authenticateDevice(req: Request): Promise<{ device: DeviceCtx; body: string }> {
  const keyId = req.headers.get('x-qq-key') ?? '';
  const ts = req.headers.get('x-qq-timestamp') ?? '';
  const sig = (req.headers.get('x-qq-signature') ?? '').toLowerCase();

  if (!/^qqd_[A-Za-z0-9_-]{16,48}$/.test(keyId) || !/^\d{10}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) {
    throw new DeviceAuthError(401, 'Imzo sarlavhalari noto\'g\'ri');
  }
  if (Math.abs(Date.now() / 1000 - Number(ts)) > SKEW_SEC) throw new DeviceAuthError(401, 'Vaqt tamg\'asi eskirgan');

  // Autentifikatsiyadan OLDIN IP bo'yicha cheklov — imzosiz so'rovlar bilan bazani bosib bo'lmaydi
  const ip = (req.headers.get('x-vercel-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim().slice(0, 64);
  if (!(await rateLimit(`devip:${ip}`, 600, 60))) throw new DeviceAuthError(429, 'Juda ko\'p so\'rov');

  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_BODY) throw new DeviceAuthError(413, 'So\'rov juda katta');
  const body = await readCapped(req, MAX_BODY);

  const [d] = await sql<{ id: string; site_id: string; name: string; secret_enc: string }[]>`
    SELECT id, site_id, name, secret_enc FROM devices WHERE key_id = ${keyId} AND revoked_at IS NULL`;
  // Kalit topilmasa ham HMAC hisoblanadi — javob vaqti bir xil bo'lishi uchun
  const secret = d ? decrypt(d.secret_enc) : 'x'.repeat(43);
  const expected = hmacSha256Hex(secret, `${ts}.${body}`);
  if (!d || !safeEqual(expected, sig)) throw new DeviceAuthError(401, 'Imzo noto\'g\'ri');

  if (!(await rateLimit(`device:${d.id}`, 240, 60))) throw new DeviceAuthError(429, 'Juda ko\'p so\'rov');
  await sql`UPDATE devices SET last_seen_at = now() WHERE id = ${d.id}`;
  return { device: { id: d.id, siteId: d.site_id, name: d.name }, body };
}

export function deviceError(e: unknown) {
  if (e instanceof DeviceAuthError) return Response.json({ error: e.message }, { status: e.status });
  console.error('[device-api]', (e as Error).message);
  return Response.json({ error: 'Server xatosi' }, { status: 500 });
}
