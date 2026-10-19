import 'server-only';
import { sql } from '@/lib/db';
import { clientIp } from './request';

/** Har bir muhim harakat audit jurnaliga yoziladi (kim, qachon, nima, qayerdan). */
export async function audit(userId: string | null, action: string, target = '', meta: Record<string, unknown> = {}) {
  try {
    const ip = await clientIp().catch(() => null);
    await sql`INSERT INTO audit_log (user_id, action, target, ip, meta)
              VALUES (${userId}, ${action}, ${target}, ${ip}, ${sql.json(meta as never)})`;
  } catch (e) {
    console.error('[audit] yozib bo\'lmadi', (e as Error).message);
  }
}
