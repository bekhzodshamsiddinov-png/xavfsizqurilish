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

  const [{ n: existing }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  if (existing > 0) return { error: "Tizim allaqachon o'rnatilgan. Kirish sahifasidan foydalaning." };

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

  // 1) IP bo'yicha umumiy cheklov (har qanday urinish)
  if (!(await rateLimit(`login:ip:${ip}`, 30, 900))) {
    return { error: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining.", values: keep };
  }
  // 2) Urinish "slot"i atomik band qilinadi: (email + IP) — 5 ta / 15 daq; email bo'yicha umumiy — 50 ta / 1 soat.
  //    Muvaffaqiyatli kirishda slotlar tozalanadi, ya'ni amalda faqat XATO urinishlar sanaladi.
  //    Shunday qilib begona odam o'z IP'sidan adminni bloklab qo'ya olmaydi, parallel so'rovlar ham limitni aylanib o'tolmaydi.
  const failPair = `loginfail:${email}:${ip}`;
  const failEmail = `loginfail:${email}`;
  if (!(await rateLimit(failPair, MAX_FAILS, LOCK_MIN * 60)) || !(await rateLimit(failEmail, 50, 3600))) {
    await burnPasswordTime(password);
    return { error: GENERIC, values: keep };
  }

  const [u] = await sql<{ id: string; password_hash: string; is_active: boolean; totp_enabled: boolean }[]>`
    SELECT id, password_hash, is_active, totp_enabled FROM users WHERE lower(email) = ${email}`;

  const valid = u ? await verifyPassword(password, u.password_hash) : (await burnPasswordTime(password), false);
  if (!u || !valid || !u.is_active) {
    await audit(u?.id ?? null, u ? 'login.fail' : 'login.fail_unknown', u ? '' : email);
    return { error: GENERIC, values: keep };
  }
  await sql`DELETE FROM rate_events WHERE bucket IN (${failPair}, ${failEmail})`;

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
  // Atomik: bir kodni ikki marta (parallel so'rovda ham) ishlatib bo'lmaydi
  const used = await sql`UPDATE users SET totp_last_step = ${step}, last_login_at = now()
                         WHERE id = ${userId} AND totp_last_step < ${step} RETURNING id`;
  if (!used.length) return { error: "Kod noto'g'ri yoki eskirgan." };
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
