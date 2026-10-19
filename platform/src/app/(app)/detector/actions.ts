'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { createAlert, parseJpegBase64 } from '@/lib/alerts';
import { rateLimit } from '@/lib/security/ratelimit';
import { AuthError, requireAction } from '@/lib/security/session';
import { currentSite } from '@/lib/site';
import { zoneTypeMeta, type ZoneType } from '@/lib/labels';

type Result = { ok: boolean; error?: string };

const Report = z.object({
  cameraId: z.uuid(),
  zoneId: z.uuid().optional(),
  type: z.enum(['zone_intrusion', 'person_down']),
  people: z.number().int().min(0).max(100),
  snapshot: z.string().max(560_000).optional(),
}).strict();

async function ownedCamera(cameraId: string) {
  const site = await currentSite();
  if (!site) return null;
  const [c] = await sql<{ id: string; site_id: string }[]>`SELECT id, site_id FROM cameras WHERE id = ${cameraId} AND site_id = ${site.id}`;
  return c ?? null;
}

/** Brauzer detektori aniqlagan hodisani saqlaydi. */
export async function reportDetection(input: z.infer<typeof Report>): Promise<Result> {
  try {
    const user = await requireAction('detector.run');
    const p = Report.safeParse(input);
    if (!p.success) return { ok: false, error: "Ma'lumot noto'g'ri" };
    if (!(await rateLimit(`detector:${user.id}`, 20, 60))) return { ok: false, error: "Juda ko'p signal — 1 daqiqa kuting" };
    const cam = await ownedCamera(p.data.cameraId);
    if (!cam) return { ok: false, error: 'Kamera topilmadi' };

    let zoneId: string | null = null;
    let detail = '';
    if (p.data.zoneId) {
      const [z0] = await sql<{ id: string; name: string; type: ZoneType }[]>`SELECT id, name, type FROM zones WHERE id = ${p.data.zoneId} AND camera_id = ${cam.id} AND active`;
      if (!z0) return { ok: false, error: 'Zona topilmadi' };
      zoneId = z0.id;
      detail = `${z0.name} (${zoneTypeMeta[z0.type].label}) — kadrda ${p.data.people} kishi`;
    } else {
      detail = `Odam 6 soniyadan ortiq yotgan holatda aniqlandi`;
    }
    let snap: Buffer | null = null;
    try { snap = parseJpegBase64(p.data.snapshot); } catch { return { ok: false, error: "Kadr formati noto'g'ri" }; }

    await createAlert({
      siteId: cam.site_id, cameraId: cam.id, zoneId, type: p.data.type, severity: 'kritik',
      detail, source: 'browser', eventUid: `br:${randomUUID()}`, snapshot: snap,
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    console.error('[detector]', (e as Error).message);
    return { ok: false, error: 'Server xatosi' };
  }
}

const Frame = z.object({ cameraId: z.uuid(), snapshot: z.string().max(560_000), people: z.number().int().min(0).max(100) }).strict();

/** Jonli kuzatuv sahifasi uchun kadr va "onlayn" holatini yangilaydi. */
export async function pushFrame(input: z.infer<typeof Frame>): Promise<Result> {
  try {
    const user = await requireAction('detector.run');
    const p = Frame.safeParse(input);
    if (!p.success) return { ok: false };
    if (!(await rateLimit(`frame:${user.id}`, 6, 60))) return { ok: false };
    const cam = await ownedCamera(p.data.cameraId);
    if (!cam) return { ok: false };
    let snap: Buffer | null;
    try { snap = parseJpegBase64(p.data.snapshot); } catch { return { ok: false }; }
    await sql`UPDATE cameras SET last_seen_at = now(), last_snapshot = ${snap}, last_snapshot_at = now() WHERE id = ${cam.id}`;
    await sql`
      INSERT INTO daily_stats (site_id, day, persons_checked) VALUES (${cam.site_id}, (now() AT TIME ZONE 'Asia/Tashkent')::date, ${p.data.people})
      ON CONFLICT (site_id, day) DO UPDATE SET persons_checked = daily_stats.persons_checked + EXCLUDED.persons_checked`;
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
