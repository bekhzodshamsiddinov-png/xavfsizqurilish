import 'server-only';
import { sql } from '@/lib/db';

/**
 * Sirpanuvchi oyna bo'yicha cheklov (bazada saqlanadi — serverless instansiyalar orasida ham ishlaydi).
 * true — so'rovga ruxsat; false — limit oshgan.
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM rate_events
    WHERE bucket = ${bucket} AND at > now() - make_interval(secs => ${windowSec})`;
  if (n >= limit) return false;
  await sql`INSERT INTO rate_events (bucket) VALUES (${bucket})`;
  if (Math.random() < 0.02) {
    await sql`DELETE FROM rate_events WHERE at < now() - interval '1 day'`;
  }
  return true;
}
