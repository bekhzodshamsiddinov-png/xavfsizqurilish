import { z } from 'zod';
import { sql } from '@/lib/db';
import { createAlert, parseJpegBase64, runEscalations } from '@/lib/alerts';
import { authenticateDevice, deviceError } from '@/lib/device-auth';
import { rateLimit } from '@/lib/security/ratelimit';
import { ALERT_TYPES, SEVERITIES, defaultSeverity } from '@/lib/labels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Event = z.object({
  event_id: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  camera_code: z.string().min(1).max(40),
  type: z.enum(ALERT_TYPES),
  severity: z.enum(SEVERITIES).optional(),
  zone_id: z.uuid().optional(),
  detected_at: z.iso.datetime({ offset: true }).optional(),
  detail: z.string().max(300).optional(),
  snapshot_jpeg_b64: z.string().max(560_000).optional(),
}).strict();

/** Qurilmadan xavfsizlik hodisasini qabul qilish. */
export async function POST(req: Request) {
  try {
    const { device, body } = await authenticateDevice(req);
    // Bitta qurilma daqiqasiga 30 tadan ortiq hodisa yubora olmaydi (nosoz yoki buzilgan qurilmadan himoya)
    if (!(await rateLimit(`devev:${device.id}`, 30, 60))) return Response.json({ error: 'Hodisalar juda ko\'p' }, { status: 429 });
    let json: unknown;
    try { json = JSON.parse(body); } catch { return Response.json({ error: 'JSON noto\'g\'ri' }, { status: 400 }); }
    const p = Event.safeParse(json);
    if (!p.success) return Response.json({ error: 'Maydonlar noto\'g\'ri', issues: p.error.issues.slice(0, 5).map((i) => i.path.join('.')) }, { status: 422 });
    const e = p.data;

    // Kamera shu qurilmaga biriktirilgan bo'lishi shart (boshqa obyekt kamerasi nomidan signal yuborib bo'lmaydi)
    const [cam] = await sql<{ id: string }[]>`
      SELECT id FROM cameras WHERE site_id = ${device.siteId} AND code = ${e.camera_code} AND device_id = ${device.id}`;
    if (!cam) return Response.json({ error: 'Kamera bu qurilmaga biriktirilmagan' }, { status: 403 });

    let zoneId: string | null = null;
    if (e.zone_id) {
      const [z0] = await sql<{ id: string }[]>`SELECT id FROM zones WHERE id = ${e.zone_id} AND camera_id = ${cam.id}`;
      if (!z0) return Response.json({ error: 'Zona topilmadi' }, { status: 422 });
      zoneId = z0.id;
    }

    const detectedAt = e.detected_at ? new Date(e.detected_at) : new Date();
    if (Math.abs(Date.now() - detectedAt.getTime()) > 24 * 3600_000) {
      return Response.json({ error: 'detected_at oxirgi 24 soat ichida bo\'lishi kerak' }, { status: 422 });
    }

    let snapshot: Buffer | null = null;
    try { snapshot = parseJpegBase64(e.snapshot_jpeg_b64); } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 422 });
    }

    const r = await createAlert({
      siteId: device.siteId, cameraId: cam.id, zoneId, type: e.type,
      severity: e.severity ?? defaultSeverity[e.type], detail: e.detail, source: 'device',
      eventUid: `dev:${device.id}:${e.event_id}`, snapshot, detectedAt,
    });
    await runEscalations().catch(() => {});
    return Response.json({ ok: true, alert_id: r.id, duplicate: !r.created }, { status: r.created ? 201 : 200 });
  } catch (err) {
    return deviceError(err);
  }
}
