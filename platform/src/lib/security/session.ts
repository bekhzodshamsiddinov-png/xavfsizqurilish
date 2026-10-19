import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { randomToken, sha256 } from './crypto';
import { clientIp, userAgent } from './request';
import { can, type Perm, type Role } from './rbac';

export const SESSION_COOKIE = '__Host-qq_sid';
const ABSOLUTE_HOURS = 12;   // sessiya maksimal umri
const IDLE_MINUTES = 120;    // harakatsizlikdan keyin chiqib ketish
const MFA_PENDING_MINUTES = 5;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  totpEnabled: boolean;
  mustChangePw: boolean;
  tokenHash: string;
}

/** Yangi sessiya: tasodifiy 256-bit token, bazada faqat uning SHA-256 xeshi saqlanadi. */
export async function createSession(userId: string, opts: { mfaPending?: boolean } = {}) {
  const token = randomToken(32);
  const hash = sha256(token);
  const minutes = opts.mfaPending ? MFA_PENDING_MINUTES : ABSOLUTE_HOURS * 60;
  await sql`
    INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent, mfa_pending)
    VALUES (${hash}, ${userId}, now() + make_interval(mins => ${minutes}), ${await clientIp()}, ${await userAgent()}, ${!!opts.mfaPending})`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: minutes * 60,
  });
}

async function readTokenHash() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  return sha256(token);
}

type Row = {
  id: string; email: string; full_name: string; role: Role; totp_enabled: boolean;
  must_change_pw: boolean; mfa_pending: boolean; last_seen_at: Date;
};

async function loadSession(hash: string): Promise<(Row & { token_hash: string }) | null> {
  const rows = await sql<Row[]>`
    SELECT u.id, u.email, u.full_name, u.role, u.totp_enabled, u.must_change_pw, s.mfa_pending, s.last_seen_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hash}
      AND s.expires_at > now()
      AND s.last_seen_at > now() - make_interval(mins => ${IDLE_MINUTES})
      AND u.is_active`;
  if (!rows[0]) return null;
  if (Date.now() - new Date(rows[0].last_seen_at).getTime() > 60_000) {
    await sql`UPDATE sessions SET last_seen_at = now() WHERE token_hash = ${hash}`;
  }
  return { ...rows[0], token_hash: hash };
}

/** To'liq tasdiqlangan foydalanuvchi (2FA o'tgan). So'rov davomida keshlanadi. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const hash = await readTokenHash();
  if (!hash) return null;
  const r = await loadSession(hash);
  if (!r || r.mfa_pending) return null;
  return {
    id: r.id, email: r.email, fullName: r.full_name, role: r.role,
    totpEnabled: r.totp_enabled, mustChangePw: r.must_change_pw, tokenHash: hash,
  };
});

/** 2FA kodini kutayotgan sessiya. */
export async function getPendingMfaUserId(): Promise<string | null> {
  const hash = await readTokenHash();
  if (!hash) return null;
  const r = await loadSession(hash);
  return r && r.mfa_pending ? r.id : null;
}

export async function destroySession() {
  const hash = await readTokenHash();
  if (hash) await sql`DELETE FROM sessions WHERE token_hash = ${hash}`;
  (await cookies()).delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string, exceptHash?: string) {
  if (exceptHash) await sql`DELETE FROM sessions WHERE user_id = ${userId} AND token_hash <> ${exceptHash}`;
  else await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}

/** Sahifalar uchun: kirmagan bo'lsa — /login, huquq yetmasa — bosh sahifa. */
export async function requirePage(perm: Perm = 'view'): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect('/login');
  if (u.mustChangePw) redirect('/account/password');
  if (!can(u.role, perm)) redirect('/?ruxsat=yoq');
  return u;
}

export class AuthError extends Error {}

/** Server amallari uchun: har bir amal o'zi huquqni qayta tekshiradi. */
export async function requireAction(perm: Perm): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new AuthError('Sessiya tugagan. Qaytadan kiring.');
  if (u.mustChangePw) throw new AuthError('Avval parolni almashtiring.');
  if (!can(u.role, perm)) throw new AuthError("Bu amal uchun huquqingiz yo'q.");
  return u;
}
