import Link from 'next/link';
import { ArrowLeft, BellRing, Building2, Camera, ChevronRight, PenLine, TriangleAlert, VideoOff } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite, UUID_RE } from '@/lib/site';
import {
  alertTypeLabel, fmtDateTime, severityMeta, statusMeta, timeAgo, zoneTypeMeta,
  type AlertStatus, type AlertType, type Severity,
} from '@/lib/labels';
import { Card, CardHeader, EmptyState, PageTitle, btnClass } from '@/components/ui';
import { FramePlaceholder, ZoneOverlay, asZoneType, normalizePoints, type ZonePoly } from '@/components/zone-overlay';
import { AutoRefresh } from './refresher.client';

export const dynamic = 'force-dynamic';

type CamRow = {
  id: string; code: string; name: string; floor: string;
  last_seen_at: Date | null; last_snapshot_at: Date | null; online: boolean; open_alerts: number;
};
type ZoneRow = { id: string; camera_id: string; name: string; type: string; points: unknown; active: boolean; warn_distance_m: string | number };
type AlertRow = {
  id: string; type: AlertType; severity: Severity; status: AlertStatus; detail: string;
  detected_at: Date; zone_name: string | null;
};

const FILTERS = [
  { key: 'all', label: 'Barchasi' },
  { key: 'signal', label: 'Signal bor' },
  { key: 'offline', label: 'Oflayn' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

export default async function LivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage('view');
  const sp = await searchParams;
  const site = await currentSite();

  if (!site) {
    return (
      <div>
        <PageTitle title="Jonli kuzatuv" />
        <Card>
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Obyekt qo'shilmagan"
            text="Jonli kuzatuv uchun avval qurilish obyektini va kameralarni qo'shing."
            action={<Link href="/cameras#obyekt" className={btnClass('primary')}>Obyekt qo'shish</Link>}
          />
        </Card>
      </div>
    );
  }

  const cameras = await sql<CamRow[]>`
    SELECT c.id, c.code, c.name, c.floor, c.last_seen_at, c.last_snapshot_at,
           COALESCE(c.last_seen_at > now() - interval '2 minutes', false) AS online,
           (SELECT count(*)::int FROM alerts a
             WHERE a.camera_id = c.id AND a.site_id = ${site.id}
               AND a.status IN ('yangi','korib') AND a.detected_at > now() - interval '24 hours') AS open_alerts
    FROM cameras c WHERE c.site_id = ${site.id} ORDER BY c.code`;

  if (!cameras.length) {
    return (
      <div>
        <PageTitle title="Jonli kuzatuv" subtitle={site.name} />
        <Card>
          <EmptyState
            icon={<Camera className="h-6 w-6" />}
            title="Kameralar yo'q"
            text="Obyektga hali kamera ulanmagan. Kamera va qurilmani qo'shganingizdan so'ng kadrlar shu yerda ko'rinadi."
            action={<Link href="/cameras" className={btnClass('primary')}>Kamera qo'shish</Link>}
          />
        </Card>
      </div>
    );
  }

  const zoneRows = await sql<ZoneRow[]>`
    SELECT id, camera_id, name, type, points, active, warn_distance_m
    FROM zones WHERE camera_id = ANY(${sql.array(cameras.map((c) => c.id))}::uuid[])
    ORDER BY updated_at`;
  const zonesByCam = new Map<string, (ZonePoly & { warn: number })[]>();
  for (const z of zoneRows) {
    const list = zonesByCam.get(z.camera_id) ?? [];
    list.push({ id: z.id, name: z.name, type: asZoneType(z.type), points: normalizePoints(z.points), active: z.active, warn: Number(z.warn_distance_m) });
    zonesByCam.set(z.camera_id, list);
  }

  /* ---------- Bitta kamera ko'rinishi ---------- */
  const camParam = typeof sp.cam === 'string' && UUID_RE.test(sp.cam) ? sp.cam.toLowerCase() : null;
  const selected = camParam ? cameras.find((c) => c.id === camParam) : undefined;
  if (selected) {
    const alerts = await sql<AlertRow[]>`
      SELECT a.id, a.type, a.severity, a.status, a.detail, a.detected_at, z.name AS zone_name
      FROM alerts a LEFT JOIN zones z ON z.id = a.zone_id
      WHERE a.camera_id = ${selected.id} AND a.site_id = ${site.id}
      ORDER BY a.detected_at DESC LIMIT 10`;
    const zones = zonesByCam.get(selected.id) ?? [];
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link href="/live" className={btnClass('ghost', '!px-3')}><ArrowLeft className="h-4 w-4" /> Barcha kameralar</Link>
          <AutoRefresh />
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
          <Card className="overflow-hidden">
            <div className="bg-[#0B0C0E] p-3 sm:p-4">
              <Frame cam={selected} zones={zones} large />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{selected.code}{selected.floor ? ` · ${selected.floor}` : ''}</div>
                <h1 className="mt-0.5 truncate text-xl font-bold text-slate-900">{selected.name}</h1>
                <div className="mt-1 text-xs text-slate-500">
                  Oxirgi kadr: {fmtDateTime(selected.last_snapshot_at)}
                </div>
              </div>
              {can(user.role, 'zone.edit') && (
                <Link href={`/zones?camera=${selected.id}`} className={btnClass('secondary')}>
                  <PenLine className="h-4 w-4" /> Zonalarni tahrirlash
                </Link>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Xavfli zonalar" subtitle={zones.length ? `${zones.filter((z) => z.active).length} ta faol · ${zones.length} ta jami` : undefined} />
              {zones.length ? (
                <ul className="mt-3 divide-y divide-slate-100 pb-2">
                  {zones.map((z) => (
                    <li key={z.id} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: z.active ? zoneTypeMeta[z.type].color : '#CBD5E1' }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{z.name}</div>
                        <div className="text-xs text-slate-500">{zoneTypeMeta[z.type].label} · {String(z.warn).replace('.', ',')} m</div>
                      </div>
                      {!z.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Nofaol</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 pt-2 text-sm text-slate-500">Bu kamerada xavfli zona belgilanmagan.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="So'nggi signallar" subtitle="Ushbu kamera bo'yicha oxirgi 10 ta" />
              {alerts.length ? (
                <ul className="mt-3 divide-y divide-slate-100 pb-2">
                  {alerts.map((a) => (
                    <li key={a.id}>
                      <Link href={`/alerts?id=${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${severityMeta[a.severity]?.dot ?? 'bg-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{alertTypeLabel[a.type] ?? a.type}</div>
                          <div className="truncate text-xs text-slate-500">
                            {timeAgo(a.detected_at)}{a.zone_name ? ` · ${a.zone_name}` : ''}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta[a.status]?.chip ?? ''}`}>{statusMeta[a.status]?.label ?? a.status}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 pt-2 text-sm text-slate-500">Bu kamera bo&apos;yicha signal qayd etilmagan.</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Kameralar to'ri ---------- */
  const f: FilterKey = FILTERS.some((x) => x.key === sp.f) ? (sp.f as FilterKey) : 'all';
  const counts: Record<FilterKey, number> = {
    all: cameras.length,
    signal: cameras.filter((c) => c.open_alerts > 0).length,
    offline: cameras.filter((c) => !c.online).length,
  };
  const list = cameras.filter((c) => (f === 'signal' ? c.open_alerts > 0 : f === 'offline' ? !c.online : true));
  const onlineCount = cameras.length - counts.offline;

  return (
    <div>
      <PageTitle
        title="Jonli kuzatuv"
        subtitle={`${site.name} · ${onlineCount} / ${cameras.length} kamera onlayn`}
        action={<AutoRefresh />}
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === 'all' ? '/live' : `/live?f=${x.key}`}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              f === x.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {x.label}
            <span className={`rounded-full px-1.5 text-[11px] ${f === x.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{counts[x.key]}</span>
          </Link>
        ))}
      </div>

      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} href={`/live?cam=${c.id}`} className="group block rounded-xl transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400]">
              <Frame cam={c} zones={zonesByCam.get(c.id) ?? []} />
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={f === 'signal' ? <BellRing className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
            title={f === 'signal' ? "Ochiq signal yo'q" : 'Oflayn kamera yo\'q'}
            text={f === 'signal' ? "So'nggi 24 soatda hal qilinmagan signali bor kamera topilmadi." : 'Barcha kameralar hozir onlayn.'}
            action={<Link href="/live" className={btnClass('secondary')}>Barcha kameralar</Link>}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------- Kamera kadri (server komponent) ---------- */
function Frame({ cam, zones, large = false }: { cam: CamRow; zones: ZonePoly[]; large?: boolean }) {
  const version = cam.last_snapshot_at ? new Date(cam.last_snapshot_at).getTime() : null;
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900 ${cam.open_alerts > 0 ? 'ring-2 ring-red-500/80' : ''}`}>
      {version !== null ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/snapshots/camera/${cam.id}?t=${version}`}
            alt={cam.name}
            loading={large ? 'eager' : 'lazy'}
            className={`absolute inset-0 h-full w-full object-cover ${cam.online ? '' : 'grayscale'}`}
          />
          <div className="absolute inset-0 bg-slate-950/20" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
            <VideoOff className="h-8 w-8" />
            <span className="text-sm font-medium">Kadr yo&apos;q</span>
          </div>
        </div>
      )}

      <ZoneOverlay zones={zones} labels={large || zones.length <= 3} small={!large} />

      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
        {cam.online ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Onlayn
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {cam.last_seen_at ? `Oflayn — ${timeAgo(cam.last_seen_at)}` : 'Oflayn — hali ulanmagan'}
          </>
        )}
      </div>

      {cam.open_alerts > 0 && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white shadow" title="So'nggi 24 soatdagi ochiq signallar">
          <BellRing className="h-3.5 w-3.5" /> {cam.open_alerts}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-white">
        <div className="min-w-0">
          <div className={`truncate font-semibold ${large ? 'text-base' : 'text-[13px]'}`}>{cam.name}</div>
          <div className="truncate text-[11px] text-white/70">{cam.code}{cam.floor ? ` · ${cam.floor}` : ''}</div>
        </div>
        {zones.length > 0 && (
          <div className="shrink-0 text-right text-[11px] text-white/80">
            <b className="text-white">{zones.filter((z) => z.active).length}</b> zona
          </div>
        )}
      </div>
    </div>
  );
}
