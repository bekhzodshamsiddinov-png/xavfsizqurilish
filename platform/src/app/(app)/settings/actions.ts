'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { sendTelegramText } from '@/lib/alerts';
import { deleteDemo, seedDemo } from '@/lib/demo';
import { SITE_COOKIE } from '@/lib/site';
import { audit } from '@/lib/security/audit';
import { generateTempPassword, hashPassword } from '@/lib/security/password';
import { rateLimit } from '@/lib/security/ratelimit';
import { ROLES, type Role } from '@/lib/security/rbac';
import { AuthError, requireAction, type SessionUser } from '@/lib/security/session';

/** `secret` — bir marta ko'rsatiladigan vaqtinchalik parol (bazada faqat xeshi bor). */
export type FormState = { error?: string; ok?: string; secret?: string } | undefined;

const GENERIC = "Amalni bajarib bo'lmadi. Qayta urinib ko'ring.";

class UserFacingError extends Error {}

async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError || e instanceof UserFacingError) return { error: e.message };
    if ((e as { code?: string }).code === '23505') return { error: "Bu email bilan foydalanuvchi allaqachon mavjud." };
    console.error('[settings]', (e as Error).message);
    return { error: GENERIC };
  }
}

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Email noto'g'ri" }));
const roleSchema = z.enum(ROLES as [Role, ...Role[]], { error: "Rol noto'g'ri" });
const chatIdSchema = z.string().trim().max(21).regex(/^(-?\d{5,20})?$/, "Chat ID faqat raqamlardan iborat bo'lishi kerak (masalan, -1001234567890)");
const targetSchema = z.object({ userId: z.uuid({ error: 'Foydalanuvchi topilmadi' }) });

function parseTarget(fd: FormData, self: SessionUser, selfMsg: string) {
  const p = targetSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) throw new UserFacingError('Foydalanuvchi topilmadi.');
  if (p.data.userId === self.id) throw new UserFacingError(selfMsg);
  return p.data.userId;
}

/* ================= Foydalanuvchilar ================= */

export async function createUser(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('user.manage');
  return guard(async () => {
    const parsed = z.object({
      fullName: z.string().trim().min(3, 'Ism kamida 3 harf').max(100),
      email: emailSchema,
      role: roleSchema,
    }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
    const d = parsed.data;
    const temp = generateTempPassword();
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO users (email, full_name, role, password_hash, must_change_pw)
      VALUES (${d.email}, ${d.fullName}, ${d.role}, ${await hashPassword(temp)}, true)
      RETURNING id`;
    await audit(user.id, 'user.created', row.id, { email: d.email, role: d.role });
    revalidatePath('/settings');
    return { ok: `${d.fullName} yaratildi. Vaqtinchalik parolni unga xavfsiz yo'l bilan bering — u faqat hozir ko'rsatiladi.`, secret: temp };
  });
}

export async function changeRole(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('user.manage');
  return guard(async () => {
    const id = parseTarget(fd, user, "O'zingizning rolingizni o'zgartira olmaysiz.");
    const r = roleSchema.safeParse(fd.get('role'));
    if (!r.success) return { error: "Rol noto'g'ri." };
    await sql.begin(async (tx) => {
      const admins = await tx<{ id: string }[]>`SELECT id FROM users WHERE role = 'admin' AND is_active FOR UPDATE`;
      const [t] = await tx<{ role: Role }[]>`SELECT role FROM users WHERE id = ${id} FOR UPDATE`;
      if (!t) throw new UserFacingError('Foydalanuvchi topilmadi.');
      if (r.data !== 'admin' && admins.every((a) => a.id === id)) {
        throw new UserFacingError("Tizimda kamida bitta faol administrator qolishi kerak.");
      }
      await tx`UPDATE users SET role = ${r.data} WHERE id = ${id}`;
    });
    await audit(user.id, 'user.role_changed', id, { role: r.data });
    revalidatePath('/settings');
    return { ok: 'Rol yangilandi.' };
  });
}

export async function setActive(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('user.manage');
  return guard(async () => {
    const id = parseTarget(fd, user, "O'zingizni faolsizlantira olmaysiz.");
    const a = z.enum(['0', '1']).safeParse(fd.get('active'));
    if (!a.success) return { error: "Ma'lumotlar noto'g'ri." };
    const active = a.data === '1';
    await sql.begin(async (tx) => {
      const admins = await tx<{ id: string }[]>`SELECT id FROM users WHERE role = 'admin' AND is_active FOR UPDATE`;
      const [t] = await tx<{ id: string }[]>`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
      if (!t) throw new UserFacingError('Foydalanuvchi topilmadi.');
      if (!active && admins.every((a) => a.id === id)) {
        throw new UserFacingError("Tizimda kamida bitta faol administrator qolishi kerak.");
      }
      await tx`UPDATE users SET is_active = ${active} WHERE id = ${id}`;
      if (!active) await tx`DELETE FROM sessions WHERE user_id = ${id}`;
    });
    await audit(user.id, active ? 'user.activated' : 'user.deactivated', id);
    revalidatePath('/settings');
    return { ok: active ? 'Foydalanuvchi faollashtirildi.' : 'Foydalanuvchi faolsizlantirildi va barcha sessiyalari yopildi.' };
  });
}

export async function resetPassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('user.manage');
  return guard(async () => {
    const id = parseTarget(fd, user, "O'z parolingizni 'Hisobim' sahifasida almashtiring.");
    const temp = generateTempPassword();
    const hash = await hashPassword(temp);
    const rows = await sql.begin(async (tx) => {
      const r = await tx`
        UPDATE users SET password_hash = ${hash}, must_change_pw = true, password_changed_at = now(),
                         failed_logins = 0, locked_until = NULL
        WHERE id = ${id} RETURNING id`;
      await tx`DELETE FROM sessions WHERE user_id = ${id}`;
      return r;
    });
    if (!rows.length) return { error: 'Foydalanuvchi topilmadi.' };
    await audit(user.id, 'user.password_reset', id);
    revalidatePath('/settings');
    return { ok: "Yangi vaqtinchalik parol yaratildi, foydalanuvchi sessiyalari yopildi. Parol faqat hozir ko'rsatiladi.", secret: temp };
  });
}

export async function unlockUser(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('user.manage');
  return guard(async () => {
    const p = targetSchema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: 'Foydalanuvchi topilmadi.' };
    const [t] = await sql<{ email: string }[]>`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ${p.data.userId} RETURNING lower(email) AS email`;
    if (!t) return { error: 'Foydalanuvchi topilmadi.' };
    const prefix = `loginfail:${t.email}`;
    await sql`DELETE FROM rate_events WHERE bucket = ${prefix} OR left(bucket, ${prefix.length + 1}) = ${prefix + ':'}`;
    await audit(user.id, 'user.unlocked', p.data.userId);
    revalidatePath('/settings');
    return { ok: 'Blok olib tashlandi.' };
  });
}

export async function resetTotp(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('user.manage');
  return guard(async () => {
    const id = parseTarget(fd, user, "O'z 2FA sozlamangizni 'Hisobim' sahifasida o'zgartiring.");
    const rows = await sql`UPDATE users SET totp_enabled = false, totp_secret_enc = NULL WHERE id = ${id} RETURNING id`;
    if (!rows.length) return { error: 'Foydalanuvchi topilmadi.' };
    await sql`DELETE FROM sessions WHERE user_id = ${id}`;
    await audit(user.id, 'user.mfa_reset', id);
    revalidatePath('/settings');
    return { ok: "2FA o'chirildi. Foydalanuvchi keyingi kirishda uni qayta yoqishi mumkin." };
  });
}

/* ================= Telegram ================= */

export async function saveTelegram(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('settings.manage');
  return guard(async () => {
    const parsed = z.object({
      enabled: z.literal('on').optional(),
      chatId: chatIdSchema,
      escalationChatId: chatIdSchema,
    }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
    const value = { enabled: parsed.data.enabled === 'on', chatId: parsed.data.chatId, escalationChatId: parsed.data.escalationChatId };
    if (value.enabled && !value.chatId) return { error: 'Telegramni yoqish uchun guruh chat ID kiriting.' };
    await sql`
      INSERT INTO app_settings (key, value) VALUES ('telegram', ${sql.json(value)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    await audit(user.id, 'settings.telegram_updated', 'telegram', value);
    revalidatePath('/settings');
    return { ok: 'Telegram sozlamalari saqlandi.' };
  });
}

export async function testTelegram(_: FormState): Promise<FormState> {
  const user = await requireAction('settings.manage');
  return guard(async () => {
    if (!(await rateLimit(`tg-test:${user.id}`, 5, 600))) return { error: "Juda ko'p urinish. 10 daqiqadan so'ng qayta urining." };
    if (!process.env.TELEGRAM_BOT_TOKEN) return { error: 'Serverda TELEGRAM_BOT_TOKEN sozlanmagan.' };
    const [row] = await sql<{ value: { chatId?: string } }[]>`SELECT value FROM app_settings WHERE key = 'telegram'`;
    const chatId = row?.value?.chatId ?? '';
    if (!/^-?\d{5,20}$/.test(chatId)) return { error: 'Avval guruh chat ID ni saqlang.' };
    const ok = await sendTelegramText(chatId, '✅ <b>Qurilish Qalqoni</b>\nSinov xabari: Telegram integratsiyasi ishlayapti.').catch(() => false);
    await audit(user.id, 'settings.telegram_test', 'telegram', { ok });
    return ok
      ? { ok: 'Sinov xabari yuborildi. Guruhni tekshiring.' }
      : { error: "Xabar yuborilmadi. Bot guruhga qo'shilganini va chat ID to'g'riligini tekshiring." };
  });
}

/* ================= Demo ma'lumotlar ================= */

export async function createDemo(_: FormState): Promise<FormState> {
  const user = await requireAction('settings.manage');
  return guard(async () => {
    if (!(await rateLimit(`demo:${user.id}`, 5, 600))) return { error: "Juda ko'p urinish. Keyinroq urining." };
    const siteId = await seedDemo(user.id);
    (await cookies()).set(SITE_COOKIE, siteId, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 365 });
    await audit(user.id, 'demo.created', siteId);
    revalidatePath('/', 'layout');
    return { ok: "Demo obyekt yaratildi va tanlandi. Boshqaruv paneliga o'ting." };
  });
}

export async function removeDemo(_: FormState): Promise<FormState> {
  const user = await requireAction('settings.manage');
  return guard(async () => {
    const n = await deleteDemo();
    await audit(user.id, 'demo.deleted', '', { sites: n });
    revalidatePath('/', 'layout');
    return { ok: n ? `Demo ma'lumotlar o'chirildi (${n} ta obyekt).` : "O'chiriladigan demo ma'lumot yo'q." };
  });
}
