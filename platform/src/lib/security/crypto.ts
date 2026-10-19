import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(input: string | Buffer) {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Hex(secret: string, data: string | Buffer) {
  return createHmac('sha256', secret).update(data).digest('hex');
}

/** Vaqtga bog'liq bo'lmagan taqqoslash (timing attack'dan himoya). */
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY sozlanmagan');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY 32 bayt (base64) bo'lishi kerak");
  return k;
}

/** AES-256-GCM: maxfiy qiymatlarni bazada shifrlangan holda saqlash uchun. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error("Shifrlangan qiymat formati noto'g'ri");
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
