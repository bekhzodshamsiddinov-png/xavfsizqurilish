import { z } from 'zod';
import { sql } from '@/lib/db';
import { parseJpegBase64, runEscalations } from '@/lib/alerts';
import { authenticateDevice, deviceError } from '@/lib/device-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Heartbeat = z.object({
  cameras: z.array(z.object({
    code: z.string().min(1).max(40),
    snapshot_jpeg_b64: z.string().max(560_000).optional(),
  }).strict()).max(16),
  stats: z.object({
    persons_checked: z.number().int().min(0).max(100_000),
    ppe_violations: z.number().int().min(0).max(100_000),
  }).strict().optional(),
}).strict();

/**
 * Qurilmaning "tirikligi" + kamera kadrlari + statistikasi.
 * Javobda qurilma kameralari uchun faol xavfli zonalar konfiguratsiyasi qaytadi —
 * shu tariqa veb-panelda chizilgan zona bir necha soniyada obyektdagi qurilmaga yetib boradi.
 */
export async function POST(req: Request) {
  try {
    const { device, body } = await authenticateDevice(req);
    let json: unknown;
    try { json = JSON.parse(body); } catch { return Response.json({ error: 'JSON noto\'g\'ri' }, { status: 400 }); }
    const p = Heartbeat.safeParse(json);
    if (!p.success) return Response.json({ error: 'Maydonlar noto\'g\'ri' }, { status: 422 });

    const total = p.data.cameras.reduce((n, c) => n + (c.snapshot_jpeg_b64?.length ?? 0), 0);
    if (total > 560_000) return Response.json({ error: 'Kadrlar umumiy hajmi juda katta' }, { status: 413 });

    for (const c of p.data.cameras) {
      let snap: Buffer | null = null;
      try { snap = parseJpegBase64(c.snapshot_jpeg_b64); } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 422 });
      }
      if (snap) {
        await sql`UPDATE cameras SET last_seen_at = now(), last_snapshot = ${snap}, last_snapshot_at = now()
                  WHERE site_id = ${device.siteId} AND code = ${c.code} AND device_id = ${device.id}`;
      } else {
        await sql`UPDATE cameras SET last_seen_at = now() WHERE site_id = ${device.siteId} AND code = ${c.code} AND device_id = ${device.id}`;
      }
    }

    if (p.data.stats) {
      const { persons_checked, ppe_violations } = p.data.stats;
      await sql`
        INSERT INTO daily_stats (site_id, day, persons_checked, ppe_violations)
        VALUES (${device.siteId}, (now() AT TIME ZONE 'Asia/Tashkent')::date, ${persons_checked}, ${Math.min(ppe_violations, persons_checked)})
        ON CONFLICT (site_id, day) DO UPDATE SET
          persons_checked = daily_stats.persons_checked + EXCLUDED.persons_checked,
          ppe_violations  = daily_stats.ppe_violations + EXCLUDED.ppe_violations`;
    }

    await runEscalations().catch(() => {});
    const zones = await sql`
      SELECT z.id, c.code AS camera_code, z.name, z.type, z.points, z.warn_distance_m::float AS warn_distance_m,
             z.allowed_roles, z.signal_siren, z.signal_voice, to_char(z.active_from,'HH24:MI') AS active_from, to_char(z.active_to,'HH24:MI') AS active_to
      FROM zones z JOIN cameras c ON c.id = z.camera_id
      WHERE c.device_id = ${device.id} AND z.active`;
    return Response.json({ ok: true, server_time: new Date().toISOString(), zones });
  } catch (err) {
    return deviceError(err);
  }
}
