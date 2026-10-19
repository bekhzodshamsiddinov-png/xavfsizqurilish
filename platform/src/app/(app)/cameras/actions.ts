'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { encrypt, randomToken } from '@/lib/security/crypto';
import { requireAction } from '@/lib/security/session';
import { currentSite, SITE_COOKIE } from '@/lib/site';

export type FormState = { error?: string; ok?: string } | undefined;
export type DeviceKeyState = { error?: string; ok?: string; keyId?: string; secret?: string; deviceName?: string } | undefined;

const GENERIC = "Amalni bajarib bo'lmadi. Qaytadan urinib ko'ring.";
const NO_SITE = 'Avval obyekt yarating yoki tanlang.';
const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/', maxAge: 60 * 60 * 24 * 365 };

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Ma'lumotlar noto'g'ri";
const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === '23505';

function done(paths: { layout?: boolean } = {}) {
  revalidatePath('/cameras');
  if (paths.layout) revalidatePath('/', 'layout');
}

/* ======================= OBYEKTLAR ======================= */

const SiteFields = z.object({
  name: z.string().trim().min(3, 'Obyekt nomi kamida 3 belgi').max(100, 'Obyekt nomi 100 belgidan oshmasin'),
  address: z.string().trim().max(200, 'Manzil 200 belgidan oshmasin').default(''),
  floors: z.coerce.number({ error: "Qavatlar soni noto'g'ri" }).int("Qavatlar soni butun son bo'lsin").min(1, 'Qavatlar soni 1–200').max(200, 'Qavatlar soni 1–200'),
});

export async function createSite(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('camera.edit');
  const p = SiteFields.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  try {
    const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sites`;
    const [s] = await sql<{ id: string }[]>`
      INSERT INTO sites (name, address, floors) VALUES (${p.data.name}, ${p.data.address}, ${p.data.floors}) RETURNING id`;
    if (n === 0) (await cookies()).set(SITE_COOKIE, s.id, COOKIE_OPTS);
    await audit(user.id, 'site.create', s.id, { name: p.data.name, floors: p.data.floors });
  } catch (e) {
    console.error('[cameras] createSite', (e as Error).message);
    return { error: GENERIC };
  }
  done({ layout: true });
  return { ok: 'Obyekt yaratildi.' };
}

export async function updateSite(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('camera.edit');
  const p = SiteFields.extend({ siteId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const d = p.data;
  try {
    const r = await sql`UPDATE sites SET name = ${d.name}, address = ${d.address}, floors = ${d.floors} WHERE id = ${d.siteId} RETURNING id`;
    if (!r.length) return { error: 'Obyekt topilmadi.' };
    await audit(user.id, 'site.update', d.siteId, { name: d.name, floors: d.floors });
  } catch (e) {
    console.error('[cameras] updateSite', (e as Error).message);
    return { error: GENERIC };
  }
  done({ layout: true });
  return { ok: 'Saqlandi.' };
}

export async function deleteSite(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('settings.manage');
  const p = z.object({ siteId: z.uuid(), confirmName: z.string().max(100) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  try {
    const [s] = await sql<{ id: string; name: string }[]>`SELECT id, name FROM sites WHERE id = ${p.data.siteId}`;
    if (!s) return { error: 'Obyekt topilmadi.' };
    if (p.data.confirmName.trim() !== s.name) return { error: "Tasdiqlash uchun obyekt nomini aynan yozing." };
    await sql`DELETE FROM sites WHERE id = ${s.id}`;
    const jar = await cookies();
    if (jar.get(SITE_COOKIE)?.value === s.id) jar.delete(SITE_COOKIE);
    await audit(user.id, 'site.delete', s.id, { name: s.name });
  } catch (e) {
    console.error('[cameras] deleteSite', (e as Error).message);
    return { error: GENERIC };
  }
  done({ layout: true });
  return { ok: "Obyekt o'chirildi." };
}

/* ======================= KAMERALAR ======================= */

const CameraFields = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, "Kod: 1–40 belgi, faqat lotin harf, raqam, - va _"),
  name: z.string().trim().min(1, 'Kamera nomini kiriting').max(100, 'Nom 100 belgidan oshmasin'),
  floor: z.string().trim().max(40, 'Qavat 40 belgidan oshmasin').default(''),
});

export async function createCamera(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('camera.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = CameraFields.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const d = p.data;
  try {
    const [c] = await sql<{ id: string }[]>`
      INSERT INTO cameras (site_id, code, name, floor) VALUES (${site.id}, ${d.code}, ${d.name}, ${d.floor}) RETURNING id`;
    await audit(user.id, 'camera.create', c.id, { siteId: site.id, code: d.code });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: 'Bu obyektda shu kodli kamera allaqachon bor.' };
    console.error('[cameras] createCamera', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: "Kamera qo'shildi." };
}

export async function updateCamera(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('camera.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = CameraFields.extend({ cameraId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const d = p.data;
  try {
    const r = await sql`UPDATE cameras SET code = ${d.code}, name = ${d.name}, floor = ${d.floor}
                        WHERE id = ${d.cameraId} AND site_id = ${site.id} RETURNING id`;
    if (!r.length) return { error: 'Kamera topilmadi.' };
    await audit(user.id, 'camera.update', d.cameraId, { code: d.code });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: 'Bu obyektda shu kodli kamera allaqachon bor.' };
    console.error('[cameras] updateCamera', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: 'Saqlandi.' };
}

export async function deleteCamera(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('camera.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({ cameraId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  try {
    const r = await sql<{ code: string }[]>`DELETE FROM cameras WHERE id = ${p.data.cameraId} AND site_id = ${site.id} RETURNING code`;
    if (!r.length) return { error: 'Kamera topilmadi.' };
    await audit(user.id, 'camera.delete', p.data.cameraId, { code: r[0].code });
  } catch (e) {
    console.error('[cameras] deleteCamera', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: "Kamera o'chirildi." };
}

/** Kamerani shu obyektdagi faol qurilmaga bog'lash (deviceId bo'sh — bog'lanishni uzish). */
export async function bindCamera(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('camera.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({ cameraId: z.uuid(), deviceId: z.union([z.literal(''), z.uuid()]) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  const { cameraId, deviceId } = p.data;
  try {
    if (deviceId) {
      const [dev] = await sql`SELECT id FROM devices WHERE id = ${deviceId} AND site_id = ${site.id} AND revoked_at IS NULL`;
      if (!dev) return { error: 'Qurilma topilmadi yoki bekor qilingan.' };
    }
    const r = await sql`UPDATE cameras SET device_id = ${deviceId || null} WHERE id = ${cameraId} AND site_id = ${site.id} RETURNING id`;
    if (!r.length) return { error: 'Kamera topilmadi.' };
    await audit(user.id, deviceId ? 'camera.bind' : 'camera.unbind', cameraId, deviceId ? { deviceId } : {});
  } catch (e) {
    console.error('[cameras] bindCamera', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: deviceId ? "Qurilmaga bog'landi." : 'Bog\'lanish uzildi.' };
}

/* ======================= EDGE QURILMALAR ======================= */

export async function createDevice(_: DeviceKeyState, fd: FormData): Promise<DeviceKeyState> {
  const user = await requireAction('device.manage');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({
    name: z.string().trim().min(2, 'Qurilma nomi kamida 2 belgi').max(80, 'Nom 80 belgidan oshmasin'),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const keyId = 'qqd_' + randomToken(18);
  const secret = randomToken(32);
  try {
    const [d] = await sql<{ id: string }[]>`
      INSERT INTO devices (site_id, name, key_id, secret_enc)
      VALUES (${site.id}, ${p.data.name}, ${keyId}, ${encrypt(secret)}) RETURNING id`;
    await audit(user.id, 'device.create', d.id, { siteId: site.id, name: p.data.name, keyId });
  } catch (e) {
    console.error('[cameras] createDevice', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: "Qurilma qo'shildi.", keyId, secret, deviceName: p.data.name };
}

export async function rotateDeviceSecret(_: DeviceKeyState, fd: FormData): Promise<DeviceKeyState> {
  const user = await requireAction('device.manage');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({ deviceId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  const secret = randomToken(32);
  let row: { key_id: string; name: string } | undefined;
  try {
    [row] = await sql<{ key_id: string; name: string }[]>`
      UPDATE devices SET secret_enc = ${encrypt(secret)}
      WHERE id = ${p.data.deviceId} AND site_id = ${site.id} AND revoked_at IS NULL
      RETURNING key_id, name`;
    if (!row) return { error: 'Qurilma topilmadi yoki bekor qilingan.' };
    await audit(user.id, 'device.rotate_secret', p.data.deviceId, { keyId: row.key_id });
  } catch (e) {
    console.error('[cameras] rotateDeviceSecret', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: 'Yangi maxfiy kalit yaratildi. Eski kalit endi ishlamaydi.', keyId: row.key_id, secret, deviceName: row.name };
}

export async function revokeDevice(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('device.manage');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({ deviceId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  const id = p.data.deviceId;
  try {
    const res = await sql.begin(async (tx) => {
      const r = await tx<{ key_id: string }[]>`
        UPDATE devices SET revoked_at = now() WHERE id = ${id} AND site_id = ${site.id} AND revoked_at IS NULL RETURNING key_id`;
      if (!r.length) return null;
      const cams = await tx`UPDATE cameras SET device_id = NULL WHERE device_id = ${id} AND site_id = ${site.id} RETURNING id`;
      return { keyId: r[0].key_id, unbound: cams.length };
    });
    if (!res) return { error: 'Qurilma topilmadi yoki allaqachon bekor qilingan.' };
    await audit(user.id, 'device.revoke', id, res);
  } catch (e) {
    console.error('[cameras] revokeDevice', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: 'Qurilma bekor qilindi.' };
}
