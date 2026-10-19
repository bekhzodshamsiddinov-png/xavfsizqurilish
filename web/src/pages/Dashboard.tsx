import React from 'react';
import { HardHat, ShieldCheck, BellRing, CalendarCheck2, Video, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardHeader, PageTitle, Button, timeAgo, hideImg } from '../components/ui';
import { Gauge, LineChart } from '../components/charts';
import { alerts, severityMeta, weekDays, weeklyViolations, floorRisk } from '../data/mock';
import type { PageKey } from '../components/layout';

const kpis = [
  { label: 'Bugun obyektda', value: '142', unit: 'xodim', icon: HardHat, trend: '+6', up: true, tone: 'bg-slate-900 text-[#FFC400]' },
  { label: 'Himoya vositalariga rioya', value: '94%', unit: 'PPE', icon: ShieldCheck, trend: '+3,2%', up: true, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Faol ogohlantirishlar', value: '4', unit: '3 tasi kritik', icon: BellRing, trend: '-2', up: false, tone: 'bg-red-50 text-red-600' },
  { label: 'Hodisasiz kunlar', value: '38', unit: 'kun', icon: CalendarCheck2, trend: 'rekord: 61', up: true, tone: 'bg-amber-50 text-amber-600' },
  { label: 'Onlayn kameralar', value: '23/24', unit: '1 ta oflayn', icon: Video, trend: '96%', up: true, tone: 'bg-sky-50 text-sky-600' },
];

const riskColor = ['bg-emerald-400', 'bg-amber-300', 'bg-orange-500', 'bg-red-500'];
const riskLabel = ['Xavfsiz', 'Past', "O'rta", 'Yuqori'];

export function Dashboard({ go }: { go: (p: PageKey) => void }) {
  const live = alerts.filter((a) => a.status !== 'hal').slice(0, 5);
  return (
    <div>
      <PageTitle
        title="Xayrli tong, Bekhzod 👋"
        subtitle="Dushanba, 19-oktabr · Yunusobod Residence, 3-blok · 16 qavat"
        action={<Button onClick={() => go('live')}><Video className="h-4 w-4" /> Jonli kuzatuvni ochish</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 sm:gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className={`p-4 sm:p-5 ${i === kpis.length - 1 ? 'col-span-2 md:col-span-1' : ''}`}>
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-5 w-5" /></div>
                <span className={`flex items-center gap-1 text-xs font-semibold ${k.up ? 'text-emerald-600' : 'text-red-600'}`}>
                  {k.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{k.trend}
                </span>
              </div>
              <div className="mt-4 text-[26px] font-bold leading-none tracking-tight text-slate-900">{k.value}</div>
              <div className="mt-1.5 text-[13px] font-medium text-slate-600">{k.label}</div>
              <div className="text-xs text-slate-400">{k.unit}</div>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 xl:grid-cols-3">
        <Card className="pb-5">
          <CardHeader title="Xavfsizlik indeksi" subtitle="PPE, zonalar va hodisalar asosida" />
          <div className="mt-4 px-5"><Gauge value={87} /></div>
          <div className="mx-5 mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center">
            <div><div className="text-sm font-bold text-slate-900">96%</div><div className="text-[11px] text-slate-500">Kaska</div></div>
            <div><div className="text-sm font-bold text-slate-900">91%</div><div className="text-[11px] text-slate-500">Yelek</div></div>
            <div><div className="text-sm font-bold text-orange-600">84%</div><div className="text-[11px] text-slate-500">Kamar</div></div>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Qoidabuzarliklar — so'nggi 7 kun" subtitle="Turi bo'yicha · haftalik pasayish 41%" />
          <div className="px-5 pb-5 pt-3">
            <LineChart
              labels={weekDays}
              series={[
                { name: 'Kaskasiz', color: '#E5383B', values: weeklyViolations.kaska },
                { name: 'Yeleksiz', color: '#F59E0B', values: weeklyViolations.yelek },
                { name: 'Kamarsiz (balandlikda)', color: '#6366F1', values: weeklyViolations.kamar },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Jonli ogohlantirishlar"
            subtitle="Hal qilinmagan hodisalar"
            action={<button onClick={() => go('alerts')} className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900">Barchasi <ArrowRight className="h-4 w-4" /></button>}
          />
          <ul className="mt-3 divide-y divide-slate-100">
            {live.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                  <img onError={hideImg} src={a.img} alt="" className="h-full w-full object-cover" style={{ objectPosition: a.pos }} />
                  <span className={`absolute left-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${severityMeta[a.severity].dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-900">{a.type}</div>
                  <div className="truncate text-xs text-slate-500">{a.floor} · {a.camera} · {timeAgo(a.minutesAgo)}</div>
                </div>
                <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:inline ${severityMeta[a.severity].chip}`}>{severityMeta[a.severity].label}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Qavatlar xavf xaritasi" subtitle="Bugungi signallar bo'yicha" />
          <div className="px-5 pb-5 pt-4">
            <div className="mx-auto flex max-w-[260px] flex-col gap-1">
              {floorRisk.map((_, idx) => {
                const floor = floorRisk.length - idx;
                const r = floorRisk[floor - 1];
                return (
                  <div key={floor} className="group flex items-center gap-2">
                    <span className="w-6 text-right text-[11px] font-medium text-slate-400">{floor}</span>
                    <div className={`h-[14px] flex-1 rounded-[4px] ${riskColor[r]} transition group-hover:brightness-95`} title={`${floor}-qavat: ${riskLabel[r]}`} />
                    <span className="w-14 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100">{riskLabel[r]}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-slate-500">
              {riskLabel.map((l, i) => (
                <span key={l} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${riskColor[i]}`} />{l}</span>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
