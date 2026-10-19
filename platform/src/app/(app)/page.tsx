import Link from 'next/link';
import { HardHat, ShieldCheck, BellRing, CalendarCheck2, Video, ArrowRight, Building2, Sparkles, ScanEye, ShieldAlert } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite } from '@/lib/site';
import { alertTypeLabel, severityMeta, timeAgo, type AlertType, type Severity } from '@/lib/labels';
import { Card, CardHeader, Notice, PageTitle, btnClass } from '@/components/ui';
import { Gauge, LineChart } from '@/components/charts';
import { AutoRefresh } from '@/components/auto-refresh';

export const metadata = { title: 'Boshqaruv paneli' };

const riskColor = ['bg-emerald-400', 'bg-amber-300', 'bg-orange-500', 'bg-red-500'];
const riskLabel = ['Xavfsiz', 'Past', "O'rta", 'Yuqori'];
const DAY_LABEL = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', hour12: false }).format(new Date()));
  return h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech';
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePage('view');
  const sp = await searchParams;
  const site = await currentSite();
  const first = user.fullName.split(' ')[0];

  if (!site) {
    return (
      <div>
        <PageTitle title={`${greeting()}, ${first} 👋`} subtitle="Qurilish Qalqoni'ga xush kelibsiz. Boshlash uchun bitta qadam qoldi." />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <Building2 className="h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-lg font-bold">Haqiqiy obyektni qo'shing</h3>
            <p className="mt-1 text-sm text-slate-500">Obyekt, kameralar va edge-qurilmani ro'yxatdan o'tkazing, so'ng xavfli zonalarni chizing.</p>
            {can(user.role, 'camera.edit')
              ? <Link href="/cameras#obyekt" className={btnClass('primary', 'mt-5')}>Obyekt qo'shish</Link>
              : <p className="mt-5 text-sm text-slate-500">Obyekt qo'shish uchun nazoratchi huquqi kerak.</p>}
          </Card>
          <Card className="p-6">
            <Sparkles className="h-8 w-8 text-[#E0A800]" />
            <h3 className="mt-3 text-lg font-bold">Demo ma'lumotlar bilan sinab ko'ring</h3>
            <p className="mt-1 text-sm text-slate-500">16 qavatli namunaviy obyekt, kameralar, zonalar va signallar bilan tizimni bir daqiqada ko'ring.</p>
            {can(user.role, 'settings.manage')
              ? <Link href="/settings#demo" className={btnClass('secondary', 'mt-5')}>Demo yaratish</Link>
              : <p className="mt-5 text-sm text-slate-500">Demo yaratish uchun administrator huquqi kerak.</p>}
          </Card>
        </div>
      </div>
    );
  }

  const [
    [{ workers }], [today], openBySev, [lastCrit], [cams], daily, recent, floorRows,
  ] = await Promise.all([
    sql<{ workers: number }[]>`SELECT count(*)::int AS workers FROM workers WHERE site_id = ${site.id} AND active`,
    sql<{ p: number; v: number }[]>`SELECT coalesce(sum(persons_checked),0)::int AS p, coalesce(sum(ppe_violations),0)::int AS v
        FROM daily_stats WHERE site_id = ${site.id} AND day > (now() AT TIME ZONE 'Asia/Tashkent')::date - 7`,
    sql<{ severity: Severity; n: number }[]>`SELECT severity, count(*)::int AS n FROM alerts WHERE site_id = ${site.id} AND status <> 'hal' GROUP BY severity`,
    sql<{ at: Date | null; created: Date }[]>`SELECT (SELECT max(detected_at) FROM alerts WHERE site_id = ${site.id} AND severity = 'kritik' AND NOT false_positive) AS at,
        (SELECT created_at FROM sites WHERE id = ${site.id}) AS created`,
    sql<{ total: number; online: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE last_seen_at > now() - interval '2 minutes')::int AS online FROM cameras WHERE site_id = ${site.id}`,
    sql<{ d: string; type: AlertType; n: number }[]>`
        SELECT to_char((detected_at AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') AS d, type, count(*)::int AS n
        FROM alerts WHERE site_id = ${site.id} AND detected_at > now() - interval '7 days' AND NOT false_positive
        GROUP BY 1, 2`,
    sql<{ id: string; type: AlertType; severity: Severity; detected_at: Date; floor: string | null; code: string | null; has_snapshot: boolean }[]>`
        SELECT a.id, a.type, a.severity, a.detected_at, c.floor, c.code, (a.snapshot IS NOT NULL) AS has_snapshot
        FROM alerts a LEFT JOIN cameras c ON c.id = a.camera_id
        WHERE a.site_id = ${site.id} AND a.status <> 'hal' ORDER BY a.detected_at DESC LIMIT 6`,
    sql<{ floor: string; n: number }[]>`
        SELECT c.floor, count(a.id)::int AS n FROM cameras c
        LEFT JOIN alerts a ON a.camera_id = c.id AND a.detected_at > now() - interval '7 days' AND NOT a.false_positive
        WHERE c.site_id = ${site.id} GROUP BY c.floor`,
  ]);

  const open = (s: Severity) => openBySev.find((x) => x.severity === s)?.n ?? 0;
  const openTotal = open('kritik') + open('yuqori') + open('orta');
  const compliance = today.p > 0 ? Math.round((1 - today.v / today.p) * 1000) / 10 : null;
  const since = lastCrit.at ?? lastCrit.created;
  const daysSafe = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86400000));
  const index = Math.max(0, Math.min(100, Math.round(100 - open('kritik') * 8 - open('yuqori') * 3 - open('orta') - (compliance !== null ? (100 - compliance) * 0.8 : 0))));

  // 7 kunlik qator
  const days: string[] = [];
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d));
    labels.push(DAY_LABEL[new Date(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent' }).format(d)).getDay()]);
  }
  const series = (t: AlertType) => days.map((d) => daily.find((r) => r.d === d && r.type === t)?.n ?? 0);

  // qavatlar xaritasi
  const floorCount = new Map<number, number>();
  for (const r of floorRows) {
    const m = /(\d+)/.exec(r.floor ?? '');
    if (m) floorCount.set(Number(m[1]), (floorCount.get(Number(m[1])) ?? 0) + r.n);
  }
  const level = (n: number | undefined) => (n === undefined ? -1 : n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3);
  const floors = Math.min(site.floors, 40);

  const kpis = [
    { label: "Ro'yxatdagi xodimlar", value: String(workers), unit: 'faol', icon: HardHat, tone: 'bg-slate-900 text-[#FFC400]', href: '/workers' },
    { label: 'Himoya vositalariga rioya', value: compliance === null ? '—' : `${compliance}%`, unit: compliance === null ? "edge qurilmadan ma'lumot yo'q" : "so'nggi 7 kun", icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600', href: '/reports' },
    { label: 'Ochiq signallar', value: String(openTotal), unit: `${open('kritik')} tasi kritik`, icon: BellRing, tone: 'bg-red-50 text-red-600', href: '/alerts' },
    { label: 'Kritik hodisasiz', value: String(daysSafe), unit: 'kun', icon: CalendarCheck2, tone: 'bg-amber-50 text-amber-600', href: '/reports' },
    { label: 'Onlayn kameralar', value: `${cams.online}/${cams.total}`, unit: cams.total - cams.online ? `${cams.total - cams.online} ta oflayn` : 'hammasi ishlayapti', icon: Video, tone: 'bg-sky-50 text-sky-600', href: '/cameras' },
  ];

  return (
    <div>
      <AutoRefresh seconds={20} />
      {sp.ruxsat === 'yoq' && <div className="mb-4"><Notice tone="warn">Bu bo'limga kirish uchun huquqingiz yetarli emas.</Notice></div>}
      {sp.xush === '1' && <div className="mb-4"><Notice tone="ok">Tizim o'rnatildi! Xavfsizlikni kuchaytirish uchun "Hisobim" bo'limida 2FA ni yoqing.</Notice></div>}
      {!user.totpEnabled && user.role === 'admin' && sp.xush !== '1' && (
        <div className="mb-4"><Notice tone="warn">Administrator hisobingizda ikki bosqichli tasdiqlash (2FA) yoqilmagan. <Link href="/account" className="font-semibold underline">Hozir yoqing →</Link></Notice></div>
      )}
      <PageTitle
        title={`${greeting()}, ${first} 👋`}
        subtitle={`${site.name}${site.address ? ` · ${site.address}` : ''} · ${site.floors} qavat`}
        action={<>
          {can(user.role, 'detector.run') && <Link href="/detector" className={btnClass('secondary')}><ScanEye className="h-4 w-4" /> Detektorni ishga tushirish</Link>}
          <Link href="/live" className={btnClass()}><Video className="h-4 w-4" /> Jonli kuzatuv</Link>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className={`rounded-2xl bg-white p-4 ring-1 ring-slate-200/80 transition hover:ring-slate-300 sm:p-5 ${i === kpis.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></div>
              <div className="mt-4 text-[26px] font-bold leading-none tracking-tight text-slate-900">{k.value}</div>
              <div className="mt-1.5 text-[13px] font-medium text-slate-600">{k.label}</div>
              <div className="text-xs text-slate-400">{k.unit}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 xl:grid-cols-3">
        <Card className="pb-5">
          <CardHeader title="Xavfsizlik indeksi" subtitle="Ochiq signallar va PPE rioyasi asosida" />
          <div className="mt-4 px-5"><Gauge value={index} /></div>
          <div className="mx-5 mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center">
            <div><div className="text-sm font-bold text-red-600">{open('kritik')}</div><div className="text-[11px] text-slate-500">Kritik</div></div>
            <div><div className="text-sm font-bold text-orange-600">{open('yuqori')}</div><div className="text-[11px] text-slate-500">Yuqori</div></div>
            <div><div className="text-sm font-bold text-amber-600">{open('orta')}</div><div className="text-[11px] text-slate-500">O'rta</div></div>
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Qoidabuzarliklar — so'nggi 7 kun" subtitle="Turi bo'yicha (yolg'on signallarsiz)" />
          <div className="px-5 pb-5 pt-3">
            <LineChart labels={labels} series={[
              { name: 'Kaskasiz', color: '#E5383B', values: series('no_helmet') },
              { name: 'Yeleksiz', color: '#F59E0B', values: series('no_vest') },
              { name: 'Kamarsiz', color: '#6366F1', values: series('no_harness') },
              { name: 'Xavfli zona', color: '#0EA5E9', values: series('zone_intrusion') },
            ]} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Hal qilinmagan signallar" subtitle="Eng yangilari"
            action={<Link href="/alerts" className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900">Barchasi <ArrowRight className="h-4 w-4" /></Link>} />
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">🎉 Ochiq signal yo'q — obyektda hammasi joyida.</div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link href={`/alerts?id=${a.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900">
                      {a.has_snapshot ? <img src={`/api/snapshots/alert/${a.id}`} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ShieldAlert className="absolute inset-0 m-auto h-5 w-5 text-slate-500" />}
                      <span className={`absolute left-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${severityMeta[a.severity].dot}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{alertTypeLabel[a.type]}</div>
                      <div className="truncate text-xs text-slate-500">{[a.floor, a.code, timeAgo(a.detected_at)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:inline ${severityMeta[a.severity].chip}`}>{severityMeta[a.severity].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Qavatlar xavf xaritasi" subtitle="So'nggi 7 kundagi signallar" />
          <div className="px-5 pb-5 pt-4">
            <div className="mx-auto flex max-w-[260px] flex-col gap-1">
              {Array.from({ length: floors }, (_, i) => floors - i).map((f) => {
                const l = level(floorCount.get(f));
                return (
                  <div key={f} className="flex items-center gap-2" title={l < 0 ? `${f}-qavat: kamera yo'q` : `${f}-qavat: ${riskLabel[l]} (${floorCount.get(f)} signal)`}>
                    <span className="w-6 text-right text-[11px] font-medium text-slate-400">{f}</span>
                    <div className={`h-[12px] flex-1 rounded-[4px] ${l < 0 ? 'bg-slate-100' : riskColor[l]}`} />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-slate-500">
              {riskLabel.map((l, i) => <span key={l} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${riskColor[i]}`} />{l}</span>)}
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-100 ring-1 ring-slate-200" />Kamera yo'q</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
