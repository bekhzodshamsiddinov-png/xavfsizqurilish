import Link from 'next/link';
import { Download, BarChart3 } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite } from '@/lib/site';
import { alertTypeLabel, type AlertType } from '@/lib/labels';
import { Card, CardHeader, EmptyState, PageTitle, btnClass } from '@/components/ui';
import { Columns, Donut } from '@/components/charts';
import { PrintButton } from './print-button';

export const metadata = { title: 'Hisobotlar' };

const typeColor: Record<AlertType, string> = {
  no_helmet: '#E5383B', no_vest: '#F59E0B', no_harness: '#6366F1', zone_intrusion: '#0EA5E9',
  person_down: '#7C3AED', after_hours: '#64748B', other: '#94A3B8',
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('view');
  const site = await currentSite();
  if (!site) {
    return (<><PageTitle title="Hisobotlar" /><Card><EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Obyekt yo'q" text="Hisobot uchun avval obyekt qo'shing." action={<Link href="/cameras#obyekt" className={btnClass()}>Obyekt qo'shish</Link>} /></Card></>);
  }
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.d)) ? Number(sp.d) : 30;

  const [[k], byType, byHour, byCam, [ppe]] = await Promise.all([
    sql<{ total: number; fp: number; crit: number; avg_ack: number | null; resolved: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE false_positive)::int AS fp,
             count(*) FILTER (WHERE severity = 'kritik' AND NOT false_positive)::int AS crit,
             avg(extract(epoch FROM acknowledged_at - created_at)) FILTER (WHERE acknowledged_at IS NOT NULL AND source <> 'demo')::float AS avg_ack,
             count(*) FILTER (WHERE status = 'hal')::int AS resolved
      FROM alerts WHERE site_id = ${site.id} AND detected_at > now() - make_interval(days => ${days})`,
    sql<{ type: AlertType; n: number }[]>`
      SELECT type, count(*)::int AS n FROM alerts
      WHERE site_id = ${site.id} AND detected_at > now() - make_interval(days => ${days}) AND NOT false_positive GROUP BY type ORDER BY n DESC`,
    sql<{ h: number; n: number }[]>`
      SELECT extract(hour FROM detected_at AT TIME ZONE 'Asia/Tashkent')::int AS h, count(*)::int AS n FROM alerts
      WHERE site_id = ${site.id} AND detected_at > now() - make_interval(days => ${days}) AND NOT false_positive GROUP BY 1`,
    sql<{ code: string; name: string; floor: string; n: number }[]>`
      SELECT c.code, c.name, c.floor, count(a.id)::int AS n FROM cameras c
      LEFT JOIN alerts a ON a.camera_id = c.id AND a.detected_at > now() - make_interval(days => ${days}) AND NOT a.false_positive
      WHERE c.site_id = ${site.id} GROUP BY c.id ORDER BY n DESC LIMIT 10`,
    sql<{ p: number; v: number }[]>`
      SELECT coalesce(sum(persons_checked),0)::int AS p, coalesce(sum(ppe_violations),0)::int AS v
      FROM daily_stats WHERE site_id = ${site.id} AND day > (now() AT TIME ZONE 'Asia/Tashkent')::date - ${days}::int`,
  ]);

  const hours = Array.from({ length: 14 }, (_, i) => i + 6); // 06:00–19:00
  const hourVals = hours.map((h) => byHour.find((r) => r.h === h)?.n ?? 0);
  const topHours = [...hourVals].map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]).slice(0, 3).filter(([v]) => v > 0).map(([, i]) => i);
  const maxCam = Math.max(1, ...byCam.map((c) => c.n));
  const fpRate = k.total ? Math.round((k.fp / k.total) * 1000) / 10 : 0;
  const compliance = ppe.p ? Math.round((1 - ppe.v / ppe.p) * 1000) / 10 : null;
  const ack = k.avg_ack === null ? '—' : k.avg_ack < 60 ? `${Math.round(k.avg_ack)} s` : `${Math.floor(k.avg_ack / 60)} daq ${Math.round(k.avg_ack % 60)} s`;

  return (
    <div>
      <PageTitle
        title="Hisobotlar va tahlil"
        subtitle={`${site.name} · so'nggi ${days} kun`}
        action={<>
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {[7, 30, 90].map((d) => (
              <Link key={d} href={`/reports?d=${d}`} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${d === days ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>{d} kun</Link>
            ))}
          </div>
          <PrintButton />
          {can(user.role, 'report.export') && <a href="/api/export/alerts" className={btnClass()}><Download className="h-4 w-4" /> CSV (inspeksiya uchun)</a>}
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat value={String(k.total)} label="Jami signallar" />
        <Stat value={String(k.crit)} label="Kritik hodisalar" tone={k.crit ? 'text-red-600' : 'text-emerald-600'} />
        <Stat value={compliance === null ? '—' : `${compliance}%`} label="PPE rioyasi" tone="text-emerald-600" />
        <Stat value={ack} label="O'rtacha javob vaqti" />
        <Stat value={`${fpRate}%`} label="Yolg'on signallar ulushi" tone={fpRate > 10 ? 'text-amber-600' : 'text-slate-900'} />
        <Stat value={k.total ? `${Math.round((k.resolved / k.total) * 100)}%` : '—'} label="Hal qilingan" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="pb-5">
          <CardHeader title="Qoidabuzarlik turlari" />
          <div className="mt-4 px-5">
            {byType.length ? <Donut center="signal" data={byType.map((t) => ({ label: alertTypeLabel[t.type], value: t.n, color: typeColor[t.type] }))} />
              : <p className="py-10 text-center text-sm text-slate-500">Bu davrda signal yo'q.</p>}
          </div>
        </Card>
        <Card className="pb-5">
          <CardHeader title="Kameralar bo'yicha" subtitle="Eng ko'p signal kelgan joylar — nazoratni shu yerda kuchaytiring" />
          <div className="mt-4 space-y-3 px-5">
            {byCam.length === 0 && <p className="py-10 text-center text-sm text-slate-500">Kameralar qo'shilmagan.</p>}
            {byCam.map((c) => (
              <div key={c.code}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700">{c.code} · {c.name} <span className="text-slate-400">({c.floor})</span></span><b>{c.n}</b></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#E5383B]" style={{ width: `${(c.n / maxCam) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="pb-5 lg:col-span-2">
          <CardHeader title="Eng xavfli soatlar" subtitle="Qizil — eng ko'p signal bo'lgan 3 soat. Shu vaqtlarda prorablar nazoratini kuchaytiring." />
          <div className="mt-4 px-5"><Columns labels={hours.map((h) => String(h).padStart(2, '0'))} values={hourVals} highlight={topHours} /></div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ value, label, tone = 'text-slate-900' }: { value: string; label: string; tone?: string }) {
  return (
    <Card className="p-5">
      <div className={`text-2xl font-bold tracking-tight ${tone}`}>{value}</div>
      <div className="mt-1 text-[13px] text-slate-500">{label}</div>
    </Card>
  );
}
