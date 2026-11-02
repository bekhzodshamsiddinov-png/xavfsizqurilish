'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { safeEqual, sha256 } from '@/lib/security/crypto';
import { hashPassword, passwordProblem } from '@/lib/security/password';
import { rateLimit } from '@/lib/security/ratelimit';
import { clientIp } from '@/lib/security/request';

export type RecoverState = { error?: string; values?: Record<string, string> } | undefined;

/**
 * Favqulodda administrator parolini tiklash.
 * Faqat Vercel'da ADMIN_RESET_TOKEN o'rnatilgan bo'lsa ishlaydi; har bir kod faqat BIR MARTA ishlatiladi.
 */
export async function recoverAdmin(_: RecoverState, fd: FormData): Promise<RecoverState> {
  const ip = await clientIp();
  const keep = { email: String(fd.get('email') ?? '').slice(0, 254) };
  if (!(await rateLimit(`recover:${ip}`, 5, 3600))) return { error: "Juda ko'p urinish. 1 soatdan so'ng qayta urining.", values: keep };

  const expected = process.env.ADMIN_RESET_TOKEN;
  if (!expected || expected.length < 24) return { error: "Parolni tiklash o'chirilgan." };

  const p = z.object({
    token: z.string().min(1).max(200),
    email: z.string().trim().toLowerCase().max(254),
    password: z.string().max(128),
    password2: z.string().max(128),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri", values: keep };
  const d = p.data;

  if (!safeEqual(d.token, expected)) {
    await audit(null, 'recover.bad_token');
    return { error: "Tiklash kodi noto'g'ri.", values: keep };
  }
  const tokenHash = sha256(expected);
  const [used] = await sql`SELECT 1 FROM app_settings WHERE key = ${'recover_used:' + tokenHash}`;
  if (used) return { error: 'Bu tiklash kodi allaqachon ishlatilgan.' };

  if (d.password !== d.password2) return { error: 'Parollar mos kelmadi.', values: keep };
  const prob = passwordProblem(d.password, d.email);
  if (prob) return { error: prob, values: keep };

  const hash = await hashPassword(d.password);
  const ok = await sql.begin(async (tx) => {
    const [u] = await tx<{ id: string }[]>`
      UPDATE users SET password_hash = ${hash}, must_change_pw = false, password_changed_at = now(),
                       failed_logins = 0, locked_until = NULL, is_active = true
      WHERE lower(email) = ${d.email} AND role = 'admin' RETURNING id`;
    if (!u) return null;
    await tx`DELETE FROM sessions WHERE user_id = ${u.id}`;
    await tx`DELETE FROM rate_events WHERE bucket LIKE ${'loginfail:' + d.email.replace(/[\\%_]/g, '\\$&') + '%'}`;
    await tx`INSERT INTO app_settings (key, value) VALUES (${'recover_used:' + tokenHash}, ${tx.json({ at: new Date().toISOString() })})`;
    return u;
  });
  if (!ok) {
    await audit(null, 'recover.unknown_admin', d.email);
    return { error: 'Bu email bilan administrator topilmadi.', values: keep };
  }
  await audit(ok.id, 'recover.password_reset', d.email);
  redirect('/login?tiklandi=1');
}
