'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { safeEqual, decrypt } from '@/lib/security/crypto';
import { burnPasswordTime, hashPassword, passwordProblem, verifyPassword } from '@/lib/security/password';
import { rateLimit } from '@/lib/security/ratelimit';
import { clientIp } from '@/lib/security/request';
import {
  createSession, destroyAllSessions, destroySession, getPendingMfaUserId, getUser,
} from '@/lib/security/session';
import { verifyTotp } from '@/lib/security/totp';

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

const GENERIC = "Email yoki parol noto'g'ri (yoki hisob vaqtincha bloklangan).";
const MAX_FAILS = 5;
const LOCK_MIN = 15;

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Email noto'g'ri" }));

/* ---------- Birinchi administrator ---------- */
export async function setupAdmin(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const keep = { fullName: String(fd.get('fullName') ?? '').slice(0, 100), email: String(fd.get('email') ?? '').slice(0, 254) };
  if (!(await rateLimit(`setup:${ip}`, 10, 3600))) return { error: "Juda ko'p urinish. Keyinroq qayta urining.", values: keep };

  const expected = process.env.SETUP_TOKEN;
  if (!expected || expected.length < 16) return { error: 'Server SETUP_TOKEN sozlanmagan.', values: keep };

  const parsed = z.object({
    token: z.string().min(1).max(200),
    fullName: z.string().trim().min(3, 'Ism kamida 3 harf').max(100),
    email: emailSchema,
    password: z.string().max(128),
    password2: z.string().max(128),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri", values: keep };
  const d = parsed.data;

  if (!safeEqual(d.token, expected)) {
    await audit(null, 'setup.bad_token');
    return { error: "O'rnatish kodi noto'g'ri.", values: keep };
  }
  if (d.password !== d.password2) return { error: 'Parollar mos kelmadi.', values: keep };
  const prob = passwordProblem(d.password, d.email);
  if (prob) return { error: prob, values: keep };

  const hash = await hashPassword(d.password);
  // Faqat hech qanday foydalanuvchi bo'lmaganda (poyga holatidan himoya — bitta tranzaksiyada).
  const created = await sql.begin(async (tx) => {
    await tx`LOCK TABLE users IN EXCLUSIVE MODE`;
    const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
    if (n > 0) return null;
    const [u] = await tx<{ id: string }[]>`
      INSERT INTO users (email, full_name, role, password_hash)
      VALUES (${d.email}, ${d.fullName}, 'admin', ${hash}) RETURNING id`;
    return u;
  });
  if (!created) return { error: "Tizim allaqachon o'rnatilgan. Kirish sahifasidan foydalaning.", values: keep };

  await audit(created.id, 'setup.admin_created', d.email);
  await createSession(created.id);
  redirect('/?xush=1');
}

/* ---------- Kirish ---------- */
export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const parsed = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).safeParse(Object.fromEntries(fd));
  const keep = { email: String(fd.get('email') ?? '').slice(0, 254) };
  if (!parsed.success) return { error: GENERIC, values: keep };
  const { email, password } = parsed.data;

  const okIp = await rateLimit(`login:ip:${ip}`, 30, 900);
  const okEmail = await rateLimit(`login:email:${email}`, 10, 900);
  if (!okIp || !okEmail) {
    await audit(null, 'login.rate_limited', email);
    return { error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining.", values: keep };
  }

  const [u] = await sql<{
    id: string; password_hash: string; is_active: boolean; locked_until: Date | null; failed_logins: number; totp_enabled: boolean;
  }[]>`SELECT id, password_hash, is_active, locked_until, failed_logins, totp_enabled FROM users WHERE lower(email) = ${email}`;

  if (!u) {
    await burnPasswordTime(password);
    await audit(null, 'login.fail_unknown', email);
    return { error: GENERIC, values: keep };
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    await burnPasswordTime(password);
    await audit(u.id, 'login.locked');
    return { error: GENERIC, values: keep };
  }
  const valid = await verifyPassword(password, u.password_hash);
  if (!valid || !u.is_active) {
    const fails = u.failed_logins + 1;
    if (fails >= MAX_FAILS) {
      await sql`UPDATE users SET failed_logins = 0, locked_until = now() + make_interval(mins => ${LOCK_MIN}) WHERE id = ${u.id}`;
      await audit(u.id, 'login.lockout');
    } else {
      await sql`UPDATE users SET failed_logins = ${fails} WHERE id = ${u.id}`;
    }
    await audit(u.id, 'login.fail');
    return { error: GENERIC, values: keep };
  }

  await sql`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ${u.id}`;
  await destroySession(); // sessiya fiksatsiyasidan himoya — eski tokenni bekor qilamiz
  if (u.totp_enabled) {
    await createSession(u.id, { mfaPending: true });
    redirect('/login/2fa');
  }
  await createSession(u.id);
  await sql`UPDATE users SET last_login_at = now() WHERE id = ${u.id}`;
  await audit(u.id, 'login.success');
  redirect('/');
}

/* ---------- 2FA ---------- */
export async function verifyMfa(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await getPendingMfaUserId();
  if (!userId) redirect('/login');
  if (!(await rateLimit(`mfa:${userId}`, 6, 300))) {
    await destroySession();
    await audit(userId, 'mfa.rate_limited');
    return { error: "Juda ko'p noto'g'ri kod. Qaytadan kiring." };
  }
  const code = String(fd.get('code') ?? '').replace(/\s/g, '');
  const [u] = await sql<{ totp_secret_enc: string | null; totp_last_step: string }[]>`
    SELECT totp_secret_enc, totp_last_step FROM users WHERE id = ${userId}`;
  if (!u?.totp_secret_enc) return { error: '2FA sozlanmagan.' };
  const step = verifyTotp(decrypt(u.totp_secret_enc), code, Number(u.totp_last_step));
  if (step === null) {
    await audit(userId, 'mfa.fail');
    return { error: "Kod noto'g'ri yoki eskirgan." };
  }
  await sql`UPDATE users SET totp_last_step = ${step}, last_login_at = now() WHERE id = ${userId}`;
  await destroySession();
  await createSession(userId);
  await audit(userId, 'login.success_mfa');
  redirect('/');
}

/* ---------- Chiqish ---------- */
export async function logout() {
  const u = await getUser();
  await destroySession();
  if (u) await audit(u.id, 'logout');
  redirect('/login');
}

/* ---------- Parolni almashtirish ---------- */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const u = await getUser();
  if (!u) redirect('/login');
  if (!(await rateLimit(`pwchange:${u.id}`, 5, 900))) return { error: "Juda ko'p urinish. Keyinroq urining." };
  const parsed = z.object({ current: z.string().min(1).max(128), next: z.string().max(128), next2: z.string().max(128) })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Ma'lumotlar noto'g'ri" };
  const { current, next, next2 } = parsed.data;
  const [row] = await sql<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${u.id}`;
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    await audit(u.id, 'password.change_fail');
    return { error: "Joriy parol noto'g'ri." };
  }
  if (next !== next2) return { error: 'Yangi parollar mos kelmadi.' };
  if (next === current) return { error: "Yangi parol eskisidan farq qilishi kerak." };
  const prob = passwordProblem(next, u.email);
  if (prob) return { error: prob };
  await sql`UPDATE users SET password_hash = ${await hashPassword(next)}, must_change_pw = false, password_changed_at = now() WHERE id = ${u.id}`;
  await destroyAllSessions(u.id, u.tokenHash); // boshqa qurilmalardagi sessiyalar yopiladi
  await audit(u.id, 'password.changed');
  redirect('/?parol=yangilandi');
}
