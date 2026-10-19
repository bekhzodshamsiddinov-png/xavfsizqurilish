'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { AuthError, requireAction } from '@/lib/security/session';
import { currentSite } from '@/lib/site';
import { ZONE_TYPES } from '@/lib/labels';

export type ZoneFormState = { error?: string; ok?: string; id?: string } | undefined;

const GENERIC = "Amalni bajarib bo'lmadi. Qayta urinib ko'ring.";

const coord = z.number().finite().min(0).max(100);
const pointsSchema = z
  .array(z.tuple([coord, coord]))
  .min(3, 'Kamida 3 nuqta belgilang')
  .max(30, "Ko'pi bilan 30 nuqta bo'lishi mumkin");

function parsePoints(raw: unknown) {
  if (typeof raw !== 'string' || raw.length > 4000) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  const r = pointsSchema.safeParse(v);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Nuqtalar noto'g'ri" } as const;
  return { points: r.data.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number]) } as const;
}

const name = z.string().trim().min(1, 'Zona nomini kiriting').max(80, 'Nom juda uzun');
const zoneType = z.enum(ZONE_TYPES as [string, ...string[]], { error: "Zona turi noto'g'ri" });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Vaqt formati SS:DD bo'lishi kerak");

function authMessage(e: unknown): ZoneFormState {
  if (e instanceof AuthError) return { error: e.message };
  console.error('[zones]', (e as Error)?.message);
  return { error: GENERIC };
}

/** Kamera joriy obyektga tegishli ekanini tekshiradi. */
async function cameraOfSite(cameraId: string, siteId: string) {
  const [c] = await sql<{ id: string }[]>`SELECT id FROM cameras WHERE id = ${cameraId} AND site_id = ${siteId}`;
  return !!c;
}

/** Zona joriy obyekt kamerasiga tegishli ekanini tekshiradi. */
async function zoneOfSite(zoneId: string, siteId: string) {
  const [zr] = await sql<{ id: string; camera_id: string; name: string }[]>`
    SELECT z.id, z.camera_id, z.name FROM zones z JOIN cameras c ON c.id = z.camera_id
    WHERE z.id = ${zoneId} AND c.site_id = ${siteId}`;
  return zr ?? null;
}

/* ---------- Yangi zona ---------- */
export async function createZone(_: ZoneFormState, fd: FormData): Promise<ZoneFormState> {
  let user;
  try { user = await requireAction('zone.edit'); } catch (e) { return authMessage(e); }
  try {
    const parsed = z.object({
      cameraId: z.uuid(),
      name,
      type: zoneType,
      points: z.string().max(4000),
    }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
    const d = parsed.data;

    const pts = parsePoints(d.points);
    if (!pts) return { error: "Nuqtalar noto'g'ri" };
    if ('error' in pts) return { error: pts.error };

    const site = await currentSite();
    if (!site || !(await cameraOfSite(d.cameraId, site.id))) return { error: 'Kamera topilmadi.' };

    const [row] = await sql<{ id: string }[]>`
      INSERT INTO zones (camera_id, name, type, points, created_by)
      VALUES (${d.cameraId}, ${d.name}, ${d.type}, ${sql.json(pts.points)}, ${user.id})
      RETURNING id`;
    await audit(user.id, 'zone.create', row.id, { cameraId: d.cameraId, name: d.name, type: d.type, points: pts.points.length });
    revalidatePath('/zones');
    revalidatePath('/live');
    return { ok: 'Yangi xavfli zona saqlandi va kuzatuvga olindi.', id: row.id };
  } catch (e) {
    return authMessage(e);
  }
}

/* ---------- Zona sozlamalari ---------- */
const SIGNALS = ['siren', 'voice', 'telegram', 'sms'] as const;

export async function updateZone(_: ZoneFormState, fd: FormData): Promise<ZoneFormState> {
  let user;
  try { user = await requireAction('zone.edit'); } catch (e) { return authMessage(e); }
  try {
    const raw = Object.fromEntries(fd);
    const parsed = z.object({
      id: z.uuid(),
      name,
      type: zoneType,
      active: z.literal('on').optional(),
      warn_distance_m: z.coerce.number().min(0.5).max(10).refine((n) => Number.isInteger(n * 2), "Masofa 0,5 m qadam bilan bo'lishi kerak"),
      active_from: hhmm,
      active_to: hhmm,
      signal_siren: z.literal('on').optional(),
      signal_voice: z.literal('on').optional(),
      signal_telegram: z.literal('on').optional(),
      signal_sms: z.literal('on').optional(),
      points: z.string().max(4000).optional(),
    }).safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlar noto'g'ri" };
    const d = parsed.data;

    const rolesParsed = z
      .array(z.string().trim().min(1).max(40))
      .max(20, "Ko'pi bilan 20 ta kasb")
      .safeParse(fd.getAll('allowed_roles'));
    if (!rolesParsed.success) return { error: "Ruxsat etilganlar ro'yxati noto'g'ri" };
    const roles = [...new Set(rolesParsed.data)];

    let newPoints: [number, number][] | null = null;
    if (d.points) {
      const pts = parsePoints(d.points);
      if (!pts) return { error: "Nuqtalar noto'g'ri" };
      if ('error' in pts) return { error: pts.error };
      newPoints = pts.points;
    }

    const site = await currentSite();
    const zone = site ? await zoneOfSite(d.id, site.id) : null;
    if (!zone) return { error: 'Zona topilmadi.' };

    const signals = {
      siren: d.signal_siren === 'on',
      voice: d.signal_voice === 'on',
      telegram: d.signal_telegram === 'on',
      sms: d.signal_sms === 'on',
    } satisfies Record<(typeof SIGNALS)[number], boolean>;

    await sql`
      UPDATE zones SET
        name = ${d.name},
        type = ${d.type},
        active = ${d.active === 'on'},
        warn_distance_m = ${d.warn_distance_m},
        allowed_roles = ${sql.array(roles)},
        signal_siren = ${signals.siren},
        signal_voice = ${signals.voice},
        signal_telegram = ${signals.telegram},
        signal_sms = ${signals.sms},
        active_from = ${d.active_from},
        active_to = ${d.active_to},
        points = COALESCE(${newPoints ? sql.json(newPoints) : null}::jsonb, points),
        updated_at = now()
      WHERE id = ${d.id}`;
    await audit(user.id, 'zone.update', d.id, {
      name: d.name, type: d.type, active: d.active === 'on', warn: d.warn_distance_m,
      roles, signals, from: d.active_from, to: d.active_to, pointsChanged: !!newPoints,
    });
    revalidatePath('/zones');
    revalidatePath('/live');
    return { ok: 'Zona sozlamalari saqlandi.', id: d.id };
  } catch (e) {
    return authMessage(e);
  }
}

/* ---------- Zonani o'chirish ---------- */
export async function deleteZone(_: ZoneFormState, fd: FormData): Promise<ZoneFormState> {
  let user;
  try { user = await requireAction('zone.edit'); } catch (e) { return authMessage(e); }
  try {
    const parsed = z.object({ id: z.uuid() }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { error: "Ma'lumotlar noto'g'ri" };
    const site = await currentSite();
    const zone = site ? await zoneOfSite(parsed.data.id, site.id) : null;
    if (!zone) return { error: 'Zona topilmadi.' };

    await sql`DELETE FROM zones WHERE id = ${zone.id}`;
    await audit(user.id, 'zone.delete', zone.id, { name: zone.name, cameraId: zone.camera_id });
    revalidatePath('/zones');
    revalidatePath('/live');
    return { ok: "Zona o'chirildi." };
  } catch (e) {
    return authMessage(e);
  }
}
