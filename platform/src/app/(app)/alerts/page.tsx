import Link from 'next/link';
import { BellRing, CheckCircle2, Download, MapPin, Camera as CamIcon, Clock, X, ShieldAlert } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite, UUID_RE } from '@/lib/site';
import {
  ALERT_TYPES, SEVERITIES, alertTypeLabel, fmtDateTime, severityMeta, statusMeta, timeAgo,
  type AlertStatus, type AlertType, type Severity,
} from '@/lib/labels';
import { Card, EmptyState, PageTitle, btnClass } from '@/components/ui';
import { AlertActions } from './alert-actions.client';
import { AutoRefresh } from '@/components/auto-refresh';

export const metadata = { title: 'Ogohlantirishlar' };

type Row = {
  id: string; type: AlertType; severity: Severity; status: AlertStatus; detail: string; detected_at: Date; source: string;
  has_snapshot: boolean; camera_name: string | null; camera_code: string | null; floor: string | null; zone_name: string | null;
  assignee: string | null; resolver: string | null; resolved_at: Date | null; acknowledged_at: Date | null;
  false_positive: boolean; escalation_level: number; notes: string;
};

const PAGE = 40;

export default async function AlertsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('view');
  const site = await currentSite();
  const sp = await searchParams;
  if (!site) {
    return (<><PageTitle title="Ogohlantirishlar markazi" /><Card><EmptyState icon={<BellRing className="h-6 w-6" />} title="Obyekt yo'q" text="Avval obyekt va kameralarni qo'shing." action={<Link href="/cameras#obyekt" className={btnClass()}>Obyekt qo'shish</Link>} /></Card></>);
  }

  // Filtrlar faqat ruxsat etilgan qiymatlar ro'yxatidan olinadi
  const status = (['yangi', 'korib', 'hal'] as const).find((s) => s === sp.status) ?? null;
  const sev = SEVERITIES.find((s) => s === sp.sev) ?? null;
  const type = ALERT_TYPES.find((t) => t === sp.type) ?? null;
  const page = Math.max(0, Math.min(1000, Number.parseInt(sp.page ?? '0', 10) || 0));
  const selectedId = sp.id && UUID_RE.test(sp.id) ? sp.id : null;

  const base = sql`
    SELECT a.id, a.type, a.severity, a.status, a.detail, a.detected_at, a.source, (a.snapshot IS NOT NULL) AS has_snapshot,
           c.name AS camera_name, c.code AS camera_code, c.floor, z.name AS zone_name,
           ua.full_name AS assignee, ur.full_name AS resolver, a.resolved_at, a.acknowledged_at, a.false_positive, a.escalation_level, a.notes
    FROM alerts a
    LEFT JOIN cameras c ON c.id = a.camera_id
    LEFT JOIN zones z ON z.id = a.zone_id
    LEFT JOIN users ua ON ua.id = a.assignee_id
    LEFT JOIN users ur ON ur.id = a.resolved_by`;

  const [list, counts, selected] = await Promise.all([
    sql<Row[]>`${base}
      WHERE a.site_id = ${site.id}
        ${status ? sql`AND a.status = ${status}` : sql``}
        ${sev ? sql`AND a.severity = ${sev}` : sql``}
        ${type ? sql`AND a.type = ${type}` : sql``}
      ORDER BY (a.status = 'yangi') DESC, a.detected_at DESC
      LIMIT ${PAGE + 1} OFFSET ${page * PAGE}`,
    sql<{ status: AlertStatus; n: number }[]>`SELECT status, count(*)::int AS n FROM alerts WHERE site_id = ${site.id} GROUP BY status`,
    selectedId ? sql<Row[]>`${base} WHERE a.id = ${selectedId} AND a.site_id = ${site.id}` : Promise.resolve([] as Row[]),
  ]);
  const hasMore = list.length > PAGE;
  const rows = list.slice(0, PAGE);
  const count = (s: AlertStatus) => counts.find((c) => c.status === s)?.n ?? 0;
  const sel = selected[0];

  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { status, sev, type, page: page ? String(page) : null, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/alerts?${s}` : '/alerts';
  };

  return (
    <div>
      <AutoRefresh seconds={15} />
      <PageTitle
        title="Ogohlantirishlar markazi"
        subtitle="Har bir kritik signal avtomatik eskalatsiya qilinadi: joyida sirena → prorabga Telegram → 2 daqiqada javob bo'lmasa xavfsizlik boshlig'iga"
        action={can(user.role, 'report.export') ? (
          <a href={`/api/export/alerts`} className={btnClass('secondary')}><Download className="h-4 w-4" /> CSV eksport</a>
        ) : undefined}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {(['yangi', 'korib', 'hal'] as AlertStatus[]).map((s) => (
          <Link key={s} href={qs({ status: status === s ? null : s, page: null })}
            className={`rounded-2xl p-4 ring-1 transition ${status === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}>
            <div className="text-2xl font-bold">{count(s)}</div>
            <div className={`text-xs font-medium sm:text-sm ${status === s ? 'text-slate-300' : 'text-slate-500'}`}>{statusMeta[s].label}</div>
          </Link>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Link href={qs({ sev: null, page: null })} className={chip(!sev)}>Barcha darajalar</Link>
        {SEVERITIES.map((s) => (
          <Link key={s} href={qs({ sev: s, page: null })} className={chip(sev === s)}>
            <span className={`h-2 w-2 rounded-full ${severityMeta[s].dot}`} />{severityMeta[s].label}
          </Link>
        ))}
        <span className="mx-1 w-px shrink-0 bg-slate-200" />
        <Link href={qs({ type: null, page: null })} className={chip(!type)}>Barcha turlar</Link>
        {ALERT_TYPES.map((t) => (
          <Link key={t} href={qs({ type: t, page: null })} className={chip(type === t)}>{alertTypeLabel[t]}</Link>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />} title="Bu filtrda signal yo'q" text="Obyektda hammasi joyida ko'rinadi." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((a) => (
              <li key={a.id}>
                <Link href={qs({ id: a.id })} scroll={false} className={`flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 sm:px-5 ${a.id === selectedId ? 'bg-amber-50/60' : ''}`}>
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900">
                    {a.has_snapshot ? <img src={`/api/snapshots/alert/${a.id}`} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ShieldAlert className="absolute inset-0 m-auto h-6 w-6 text-slate-500" />}
                    <div className={`absolute inset-x-0 bottom-0 h-1 ${severityMeta[a.severity].dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${severityMeta[a.severity].chip}`}>{severityMeta[a.severity].label}</span>
                      {a.escalation_level >= 2 && a.status === 'yangi' && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Eskalatsiya</span>}
                      {a.false_positive && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Yolg'on signal</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{alertTypeLabel[a.type]}{a.zone_name ? ` — ${a.zone_name}` : ''}</div>
                    <div className="truncate text-xs text-slate-500">{[a.floor, a.camera_code, a.assignee].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta[a.status].chip}`}>{statusMeta[a.status].label}</span>
                    <span className="text-xs text-slate-400">{timeAgo(a.detected_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {(page > 0 || hasMore) && (
        <div className="mt-4 flex justify-between">
          {page > 0 ? <Link href={qs({ page: String(page - 1) })} className={btnClass('secondary')}>← Oldingi</Link> : <span />}
          {hasMore && <Link href={qs({ page: String(page + 1) })} className={btnClass('secondary')}>Keyingi →</Link>}
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/50 backdrop-blur-sm">
          <Link href={qs({ id: null })} scroll={false} className="absolute inset-0" aria-label="Yopish" />
          <aside className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            <div className="relative aspect-video bg-gradient-to-br from-slate-700 to-slate-950">
              {sel.has_snapshot
                ? <img src={`/api/snapshots/alert/${sel.id}`} alt="Dalil kadri" className="h-full w-full object-cover" />
                : <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Dalil kadri yo'q</div>}
              <Link href={qs({ id: null })} scroll={false} className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white"><X className="h-5 w-5" /></Link>
              <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">{fmtDateTime(sel.detected_at)}</span>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityMeta[sel.severity].chip}`}>{severityMeta[sel.severity].label}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta[sel.status].chip}`}>{statusMeta[sel.status].label}</span>
                <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  {sel.source === 'device' ? 'Edge qurilma' : sel.source === 'browser' ? 'Brauzer detektori' : 'Demo'}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{alertTypeLabel[sel.type]}</h3>
              {sel.detail && <p className="mt-1 text-sm text-slate-600">{sel.detail}</p>}

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Info icon={MapPin} label="Joy" value={sel.floor || '—'} />
                <Info icon={CamIcon} label="Kamera" value={sel.camera_code || '—'} />
                <Info icon={Clock} label="Vaqt" value={timeAgo(sel.detected_at)} />
              </div>
              {sel.zone_name && <p className="mt-3 text-sm text-slate-600">Zona: <b>{sel.zone_name}</b></p>}

              <div className="mt-6 text-sm font-semibold text-slate-900">Holat tarixi</div>
              <ol className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>• Aniqlandi: {fmtDateTime(sel.detected_at)}</li>
                {sel.escalation_level >= 2 && <li className="text-red-700">• Eskalatsiya qilindi (2 daqiqada javob bo'lmadi)</li>}
                {sel.acknowledged_at && <li>• Qabul qilindi: {fmtDateTime(sel.acknowledged_at)}{sel.assignee ? ` — ${sel.assignee}` : ''}</li>}
                {sel.resolved_at && <li>• Yopildi: {fmtDateTime(sel.resolved_at)}{sel.resolver ? ` — ${sel.resolver}` : ''}</li>}
                {sel.notes && <li className="rounded-lg bg-slate-50 p-2 text-slate-700">“{sel.notes}”</li>}
              </ol>

              <div className="mt-6">
                <AlertActions id={sel.id} status={sel.status} canHandle={can(user.role, 'alert.handle')} canReopen={can(user.role, 'zone.edit')} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function chip(active: boolean) {
  return `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`;
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-slate-400" />
      <div className="mt-1 text-slate-500">{label}</div>
      <div className="truncate font-semibold text-slate-900">{value}</div>
    </div>
  );
}
