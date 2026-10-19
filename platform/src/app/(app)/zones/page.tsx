import Link from 'next/link';
import { Building2, Camera } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite, UUID_RE } from '@/lib/site';
import { Card, EmptyState, PageTitle, btnClass } from '@/components/ui';
import { asZoneType, normalizePoints } from '@/components/zone-overlay';
import { ZoneEditor, type EditorCamera, type EditorZone } from './zones.client';

export const dynamic = 'force-dynamic';

type CamRow = { id: string; code: string; name: string; floor: string; last_snapshot_at: Date | null };
type ZoneRow = {
  id: string; camera_id: string; name: string; type: string; points: unknown; active: boolean;
  warn_distance_m: string | number; allowed_roles: string[] | null;
  signal_siren: boolean; signal_voice: boolean; signal_telegram: boolean; signal_sms: boolean;
  active_from: string; active_to: string;
};

export default async function ZonesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage('view');
  const sp = await searchParams;
  const canEdit = can(user.role, 'zone.edit');
  const site = await currentSite();

  if (!site) {
    return (
      <div>
        <PageTitle title="Xavfli zonalar" />
        <Card>
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Obyekt qo'shilmagan"
            text="Zonalarni belgilash uchun avval qurilish obyektini va uning kameralarini qo'shing."
            action={<Link href="/cameras#obyekt" className={btnClass('primary')}>Obyekt qo'shish</Link>}
          />
        </Card>
      </div>
    );
  }

  const cameras = await sql<CamRow[]>`
    SELECT id, code, name, floor, last_snapshot_at FROM cameras WHERE site_id = ${site.id} ORDER BY code`;

  if (!cameras.length) {
    return (
      <div>
        <PageTitle title="Xavfli zonalar" subtitle={site.name} />
        <Card>
          <EmptyState
            icon={<Camera className="h-6 w-6" />}
            title="Kameralar yo'q"
            text="Xavfli zona kamera kadri ustida chiziladi. Avval obyektga kamera qo'shing."
            action={<Link href="/cameras" className={btnClass('primary')}>Kamera qo'shish</Link>}
          />
        </Card>
      </div>
    );
  }

  const camIds = cameras.map((c) => c.id);
  const zoneRows = await sql<ZoneRow[]>`
    SELECT id, camera_id, name, type, points, active, warn_distance_m, allowed_roles,
           signal_siren, signal_voice, signal_telegram, signal_sms,
           to_char(active_from, 'HH24:MI') AS active_from, to_char(active_to, 'HH24:MI') AS active_to
    FROM zones WHERE camera_id = ANY(${sql.array(camIds)}::uuid[])
    ORDER BY updated_at`;

  const zoneCount = await sql<{ zone_id: string; n: number }[]>`
    SELECT zone_id, count(*)::int AS n FROM alerts
    WHERE site_id = ${site.id} AND zone_id IS NOT NULL AND detected_at > now() - interval '24 hours'
    GROUP BY zone_id`;
  const alertsByZone = new Map(zoneCount.map((r) => [r.zone_id, r.n]));

  const wanted = typeof sp.camera === 'string' && UUID_RE.test(sp.camera) ? sp.camera.toLowerCase() : null;
  const selectedCameraId = cameras.find((c) => c.id === wanted)?.id ?? cameras[0].id;

  const editorCameras: EditorCamera[] = cameras.map((c) => ({
    id: c.id, code: c.code, name: c.name, floor: c.floor,
    snapshotVersion: c.last_snapshot_at ? new Date(c.last_snapshot_at).getTime() : null,
  }));
  const zones: EditorZone[] = zoneRows.map((z) => ({
    id: z.id,
    cameraId: z.camera_id,
    name: z.name,
    type: asZoneType(z.type),
    points: normalizePoints(z.points),
    active: z.active,
    warnDistance: Number(z.warn_distance_m),
    allowedRoles: z.allowed_roles ?? [],
    signals: { siren: z.signal_siren, voice: z.signal_voice, telegram: z.signal_telegram, sms: z.signal_sms },
    activeFrom: z.active_from,
    activeTo: z.active_to,
    alerts24h: alertsByZone.get(z.id) ?? 0,
  }));

  return (
    <div>
      <PageTitle
        title="Xavfli zonalar"
        subtitle={canEdit
          ? 'Kamera kadrida zonani chizing — AI unga yaqinlashgan har bir odamni darhol aniqlaydi'
          : "Zonalarni ko'rish rejimi — o'zgartirish uchun nazoratchi huquqi kerak"}
      />
      <ZoneEditor
        key={selectedCameraId}
        cameras={editorCameras}
        zones={zones}
        initialCameraId={selectedCameraId}
        canEdit={canEdit}
      />
    </div>
  );
}
