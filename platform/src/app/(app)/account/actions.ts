'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { decrypt, encrypt, sha256 } from '@/lib/security/crypto';
import { verifyPassword } from '@/lib/security/password';
import { rateLimit } from '@/lib/security/ratelimit';
import { AuthError, destroyAllSessions, requireAction } from '@/lib/security/session';
import { newTotpSecret, verifyTotp } from '@/lib/security/totp';

export type FormState = { error?: string; ok?: string } | undefined;

const GENERIC = "Amalni bajarib bo'lmadi. Qayta urinib ko'ring.";
const TOO_MANY = "Juda ko'p urinish. 10 daqiqadan so'ng qayta urining.";

const codeSchema = z.string().transform((s) => s.replace(/\s/g, '')).pipe(z.string().regex(/^\d{6}$/, '6 xonali kodni kiriting'));

/** Barcha amallar uchun umumiy xato ushlagich: ichki tafsilot foydalanuvchiga chiqmaydi. */
async function guard(fn: () => Promise<FormState>): Promise<FormState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    console.error('[account]', (e as Error).message);
    return { error: GENERIC };
  }
}

/** Sessiyaning HTML'ga chiqariladigan qisqa, qaytarib bo'lmaydigan identifikatori. */
function opaqueId(tokenHash: string) {
  return sha256(tokenHash).slice(0, 12);
}

/* ---------------- 2FA ---------------- */

export async function startTotp(_: FormState): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    if (!(await rateLimit(`totp-setup:${user.id}`, 10, 600))) return { error: TOO_MANY };
    const secret = newTotpSecret();
    // Faqat 2FA hali yoqilmagan bo'lsa (yoqilgan sirni ustidan yozib bo'lmaydi).
    const rows = await sql`
      UPDATE users SET totp_secret_enc = ${encrypt(secret)}, totp_enabled = false
      WHERE id = ${user.id} AND totp_enabled = false RETURNING id`;
    if (!rows.length) return { error: '2FA allaqachon yoqilgan.' };
    await audit(user.id, 'mfa.setup_started');
    revalidatePath('/account');
    return { ok: 'QR kodni ilovada skanerlang va kodni kiriting.' };
  });
}

export async function cancelTotp(_: FormState): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    await sql`UPDATE users SET totp_secret_enc = NULL WHERE id = ${user.id} AND totp_enabled = false`;
    revalidatePath('/account');
    return { ok: '2FA sozlash bekor qilindi.' };
  });
}

export async function confirmTotp(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    const parsed = z.object({ code: codeSchema }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kod noto'g'ri" };
    if (!(await rateLimit(`totp-setup:${user.id}`, 10, 600))) return { error: TOO_MANY };

    const [u] = await sql<{ totp_secret_enc: string | null; totp_enabled: boolean; totp_last_step: string }[]>`
      SELECT totp_secret_enc, totp_enabled, totp_last_step FROM users WHERE id = ${user.id}`;
    if (!u?.totp_secret_enc) return { error: "Avval '2FA ni yoqish' tugmasini bosing." };
    if (u.totp_enabled) return { error: '2FA allaqachon yoqilgan.' };

    const step = verifyTotp(decrypt(u.totp_secret_enc), parsed.data.code, Number(u.totp_last_step));
    if (step === null) {
      await audit(user.id, 'mfa.setup_fail');
      return { error: "Kod noto'g'ri yoki eskirgan. Telefon vaqti to'g'riligini tekshiring." };
    }
    await sql`UPDATE users SET totp_enabled = true, totp_last_step = ${step} WHERE id = ${user.id} AND totp_enabled = false`;
    await destroyAllSessions(user.id, user.tokenHash); // 2FA'dan oldin o'g'irlangan sessiyalar ham yopiladi
    await audit(user.id, 'mfa.enabled');
    revalidatePath('/account');
    return { ok: "2FA yoqildi. Endi har kirishda ilovadagi kod so'raladi." };
  });
}

export async function disableTotp(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    const parsed = z.object({ password: z.string().min(1, 'Parolni kiriting').max(128), code: codeSchema })
      .safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
    if (!(await rateLimit(`totp-setup:${user.id}`, 10, 600))) return { error: TOO_MANY };

    const [u] = await sql<{ password_hash: string; totp_secret_enc: string | null; totp_enabled: boolean; totp_last_step: string }[]>`
      SELECT password_hash, totp_secret_enc, totp_enabled, totp_last_step FROM users WHERE id = ${user.id}`;
    if (!u?.totp_enabled || !u.totp_secret_enc) return { error: '2FA yoqilmagan.' };

    const pwOk = await verifyPassword(parsed.data.password, u.password_hash);
    const step = verifyTotp(decrypt(u.totp_secret_enc), parsed.data.code, Number(u.totp_last_step));
    if (!pwOk || step === null) {
      await audit(user.id, 'mfa.disable_fail');
      return { error: "Parol yoki kod noto'g'ri." };
    }
    await sql`UPDATE users SET totp_enabled = false, totp_secret_enc = NULL, totp_last_step = ${step} WHERE id = ${user.id}`;
    await destroyAllSessions(user.id, user.tokenHash);
    await audit(user.id, 'mfa.disabled');
    revalidatePath('/account');
    return { ok: "2FA o'chirildi. Hisobingizni himoya qilish uchun uni qayta yoqishni tavsiya qilamiz." };
  });
}

/* ---------------- Sessiyalar ---------------- */

export async function revokeSession(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    const parsed = z.object({ sid: z.string().regex(/^[0-9a-f]{12}$/) }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: "Sessiya topilmadi." };
    const rows = await sql<{ token_hash: string }[]>`
      SELECT token_hash FROM sessions WHERE user_id = ${user.id} AND NOT mfa_pending`;
    const match = rows.find((r) => opaqueId(r.token_hash) === parsed.data.sid);
    if (!match) return { error: 'Sessiya topilmadi yoki allaqachon yopilgan.' };
    if (match.token_hash === user.tokenHash) return { error: "Joriy sessiyani yopish uchun menyudagi 'Chiqish' tugmasidan foydalaning." };
    await sql`DELETE FROM sessions WHERE token_hash = ${match.token_hash} AND user_id = ${user.id}`;
    await audit(user.id, 'session.revoked', parsed.data.sid);
    revalidatePath('/account');
    return { ok: 'Sessiya yopildi.' };
  });
}

export async function revokeOtherSessions(_: FormState): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    await destroyAllSessions(user.id, user.tokenHash);
    await audit(user.id, 'session.revoked_all_others');
    revalidatePath('/account');
    return { ok: 'Boshqa barcha qurilmalardagi sessiyalar yopildi.' };
  });
}

/* ---------------- Telegram ---------------- */

export async function saveTelegramChat(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('view');
  return guard(async () => {
    const parsed = z.object({
      chatId: z.string().trim().max(21).regex(/^(-?\d{5,20})?$/, "Chat ID faqat raqamlardan iborat bo'lishi kerak (masalan, 123456789)"),
    }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Chat ID noto'g'ri" };
    const value = parsed.data.chatId || null;
    await sql`UPDATE users SET telegram_chat_id = ${value} WHERE id = ${user.id}`;
    await audit(user.id, 'account.telegram_updated', '', { set: Boolean(value) });
    revalidatePath('/account');
    return { ok: value ? 'Telegram chat ID saqlandi.' : "Telegram chat ID o'chirildi." };
  });
}
