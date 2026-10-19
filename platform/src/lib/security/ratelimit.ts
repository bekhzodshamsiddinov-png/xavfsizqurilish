import 'server-only';
import { sql } from '@/lib/db';

/**
 * Sirpanuvchi oyna bo'yicha cheklov (bazada — serverless instansiyalar orasida ham ishlaydi).
 * Atomik: bucket bo'yicha advisory lock ostida yozib, keyin sanaydi — parallel so'rovlar limitni aylanib o'ta olmaydi.
 * true — ruxsat; false — limit oshgan.
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const ok = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${bucket}))`;
    const [{ n }] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM rate_events
      WHERE bucket = ${bucket} AND at > now() - make_interval(secs => ${windowSec})`;
    if (n >= limit) return false;
    await tx`INSERT INTO rate_events (bucket) VALUES (${bucket})`;
    return true;
  });
  if (Math.random() < 0.02) await maintenance().catch(() => {});
  return ok;
}

/** Faqat sanash (yozmasdan) — masalan, faqat muvaffaqiyatsiz urinishlarni hisoblash uchun. */
export async function overLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM rate_events
    WHERE bucket = ${bucket} AND at > now() - make_interval(secs => ${windowSec})`;
  return n >= limit;
}

export async function recordEvent(bucket: string) {
  await sql`INSERT INTO rate_events (bucket) VALUES (${bucket})`;
}

/** Davriy tozalash: eski cheklov yozuvlari va 90 kundan eski hodisa kadrlari. */
async function maintenance() {
  await sql`DELETE FROM rate_events WHERE at < now() - interval '1 day'`;
  await sql`UPDATE alerts SET snapshot = NULL WHERE snapshot IS NOT NULL AND detected_at < now() - interval '90 days'`;
  await sql`DELETE FROM audit_log WHERE at < now() - interval '365 days'`;
}
