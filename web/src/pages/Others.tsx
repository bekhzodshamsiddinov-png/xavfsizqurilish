import React, { useState } from 'react';
import {
  Search, ShieldCheck, FileDown, Landmark, Cpu, Thermometer, HardDrive, Wifi, WifiOff, RefreshCw,
  Send, MessageSquare, Siren, Languages, EyeOff, Database, Lock, GraduationCap, Plug,
} from 'lucide-react';
import { Card, CardHeader, PageTitle, Button, Toggle, useToast, hideImg } from '../components/ui';
import { HBars, Donut, Columns } from '../components/charts';
import { workers, cameras } from '../data/mock';

/* ---------------- XODIMLAR ---------------- */
export function Workers() {
  const [q, setQ] = useState('');
  const [onlyRisk, setOnlyRisk] = useState(false);
  const toast = useToast();
  const list = workers.filter((w) =>
    (w.name.toLowerCase().includes(q.toLowerCase()) || w.brigade.toLowerCase().includes(q.toLowerCase())) &&
    (!onlyRisk || w.compliance < 85 || w.training === 'muddati'));
  return (
    <div>
      <PageTitle
        title="Xodimlar"
        subtitle="Har bir xodimning himoya vositalariga rioyasi va yo'riqnoma holati"
        action={<Button onClick={() => toast("Xavfsizlik yo'riqnomasiga 2 xodim yozildi")}><GraduationCap className="h-4 w-4" /> Yo'riqnomaga yozish</Button>}
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki brigada bo'yicha qidirish" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#FFC400] focus:ring-2 focus:ring-[#FFC400]/30" />
        </div>
        <button onClick={() => setOnlyRisk(!onlyRisk)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${onlyRisk ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
          Faqat xavf guruhi
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[2fr_1.5fr_1.4fr_0.8fr_1.2fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
          <span>Xodim</span><span>Brigada</span><span>PPE rioyasi</span><span>Buzilish</span><span>Yo'riqnoma</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {list.map((w) => {
            const color = w.compliance >= 90 ? 'bg-emerald-500' : w.compliance >= 80 ? 'bg-amber-400' : 'bg-red-500';
            return (
              <li key={w.id} className="grid grid-cols-2 items-center gap-3 px-5 py-3.5 md:grid-cols-[2fr_1.5fr_1.4fr_0.8fr_1.2fr] md:gap-4">
                <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                    {w.name.split(' ').map((s) => s[0]).join('').slice(0, 2)}
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${w.onSite ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.role} · {w.id}</div>
                  </div>
                </div>
                <div className="text-sm text-slate-600">{w.brigade}</div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${color}`} style={{ width: `${w.compliance}%` }} /></div>
                  <span className="w-10 text-right text-sm font-semibold text-slate-900">{w.compliance}%</span>
                </div>
                <div className={`text-sm font-semibold ${w.violations > 3 ? 'text-red-600' : 'text-slate-700'}`}>{w.violations} ta</div>
                <div>
                  {w.training === 'ok'
                    ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Yo'riqnoma o'tgan</span>
                    : <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Muddati o'tgan</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <EyeOff className="h-3.5 w-3.5" /> Kamerada yuzlar sukut bo'yicha xiralashtiriladi. Xodim shaxsi faqat QR-beyj yoki turniket orqali aniqlanadi.
      </p>
    </div>
  );
}

/* ---------------- HISOBOTLAR ---------------- */
export function Reports() {
  const toast = useToast();
  const hours = ['07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];
  const values = [6, 9, 7, 5, 6, 4, 11, 8, 6, 7, 10, 14, 9];
  return (
    <div>
      <PageTitle
        title="Hisobotlar va tahlil"
        subtitle="Oktabr 2026 · Yunusobod Residence, 3-blok"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toast('PDF hisobot yuklab olinmoqda...')}><FileDown className="h-4 w-4" /> PDF hisobot</Button>
            <Button onClick={() => toast('Inspeksiya formatida eksport tayyorlandi')}><Landmark className="h-4 w-4" /> Inspeksiya uchun eksport</Button>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['−41%', 'Qoidabuzarliklar (oyiga)', 'text-emerald-600'],
          ['0', 'Og\'ir jarohat', 'text-emerald-600'],
          ['1 m 42 s', "O'rtacha javob vaqti", 'text-slate-900'],
          ['6,3%', "Yolg'on signallar ulushi", 'text-amber-600'],
        ].map(([v, l, c]) => (
          <Card key={l} className="p-5">
            <div className={`text-2xl font-bold tracking-tight ${c}`}>{v}</div>
            <div className="mt-1 text-[13px] text-slate-500">{l}</div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="pb-5">
          <CardHeader title="Brigadalar bo'yicha PPE rioyasi" subtitle="Pudratchilar reytingi" />
          <div className="mt-4 px-5">
            <HBars data={[
              { label: '3-brigada (Kran)', value: 97, sub: '2 ta buzilish' },
              { label: '1-brigada (Monolit)', value: 94, sub: '9 ta buzilish' },
              { label: '4-brigada (Elektr)', value: 91, sub: '5 ta buzilish' },
              { label: '5-brigada (Pardozlash)', value: 86, sub: '12 ta buzilish' },
              { label: '2-brigada (Metall)', value: 78, sub: '24 ta buzilish — yo\'riqnoma tavsiya etiladi' },
            ]} />
          </div>
        </Card>
        <Card className="pb-5">
          <CardHeader title="Qoidabuzarlik turlari" subtitle="Oktabr oyi" />
          <div className="mt-4 px-5">
            <Donut center="hodisa" data={[
              { label: 'Kaskasiz', value: 64, color: '#E5383B' },
              { label: 'Yeleksiz', value: 48, color: '#F59E0B' },
              { label: 'Kamarsiz balandlikda', value: 29, color: '#6366F1' },
              { label: 'Xavfli zonaga kirish', value: 22, color: '#0EA5E9' },
              { label: 'Boshqa', value: 9, color: '#94A3B8' },
            ]} />
          </div>
        </Card>
        <Card className="pb-5 lg:col-span-2">
          <CardHeader title="Eng xavfli soatlar" subtitle="Tushlikdan keyin (13:00) va ish oxirida (18:00) e'tibor susayadi — shu vaqtlarda nazoratni kuchaytiring" />
          <div className="mt-4 px-5"><Columns labels={hours} values={values} highlight={[6, 10, 11]} /></div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- KAMERALAR ---------------- */
export function Cameras() {
  const toast = useToast();
  const devices = [
    { name: 'Jetson Orin — 1-blok', cams: 6, load: 41, temp: 49 },
    { name: 'Jetson Orin — 2-blok', cams: 7, load: 58, temp: 54 },
    { name: 'Jetson Orin — 3-blok', cams: 8, load: 77, temp: 61 },
    { name: 'Jetson Orin — hovli', cams: 3, load: 35, temp: 63 },
  ];
  return (
    <div>
      <PageTitle title="Kameralar va qurilmalar" subtitle="Video obyektning o'zida (edge) qayta ishlanadi — internet uzilsa ham signal ishlaydi" action={<Button variant="secondary" onClick={() => toast('Kameralar qayta tekshirildi')}><RefreshCw className="h-4 w-4" /> Tekshirish</Button>} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {devices.map((d) => (
          <Card key={d.name} className="p-5">
            <div className="flex items-center gap-2"><Cpu className="h-5 w-5 text-slate-400" /><span className="text-sm font-semibold text-slate-900">{d.name}</span></div>
            <div className="mt-4 flex items-end justify-between">
              <div><div className="text-2xl font-bold text-slate-900">{d.load}%</div><div className="text-xs text-slate-500">GPU yuklama · {d.cams} kamera</div></div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${d.temp > 60 ? 'text-orange-600' : 'text-slate-600'}`}><Thermometer className="h-4 w-4" />{d.temp}°C</div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${d.load > 70 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${d.load}%` }} /></div>
          </Card>
        ))}
      </div>
      <Card className="mt-4 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {cameras.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                {c.online && <img onError={hideImg} src={c.img} alt="" className="h-full w-full object-cover" style={{ objectPosition: c.pos }} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-500">{c.id} · {c.floor} · {c.device}</div>
              </div>
              <div className="hidden items-center gap-1 text-xs text-slate-500 sm:flex"><HardDrive className="h-3.5 w-3.5" /> {c.storage}%</div>
              {c.online
                ? <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Wifi className="h-3.5 w-3.5" /> Onlayn</span>
                : <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"><WifiOff className="h-3.5 w-3.5" /> Oflayn · 14 daq</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ---------------- SOZLAMALAR ---------------- */
export function SettingsPage() {
  const toast = useToast();
  const [s, setS] = useState({ telegram: true, sms: true, siren: true, blur: true, night: true, retention: 30, lang: "O'zbekcha" });
  const Row = ({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-5 w-5 text-slate-600" /></div>
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">{title}</div><div className="text-xs text-slate-500">{desc}</div></div>
      {children}
    </div>
  );
  return (
    <div>
      <PageTitle title="Sozlamalar" subtitle="Bildirishnomalar, maxfiylik va integratsiyalar" action={<Button onClick={() => toast('Sozlamalar saqlandi')}>Saqlash</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bildirishnomalar" />
          <div className="mt-2 divide-y divide-slate-100">
            <Row icon={Send} title="Telegram bot" desc="@QurilishQalqoniBot — prorablar guruhi"><Toggle on={s.telegram} onChange={(v) => setS({ ...s, telegram: v })} /></Row>
            <Row icon={MessageSquare} title="SMS xabarnoma" desc="Faqat kritik hodisalar uchun"><Toggle on={s.sms} onChange={(v) => setS({ ...s, sms: v })} /></Row>
            <Row icon={Siren} title="Obyektdagi sirena va karnaylar" desc="Zonaga yaqinlashganda avtomatik"><Toggle on={s.siren} onChange={(v) => setS({ ...s, siren: v })} /></Row>
            <Row icon={Languages} title="Ovozli xabar tili" desc="Karnaylardagi ogohlantirish tili">
              <select value={s.lang} onChange={(e) => setS({ ...s, lang: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                <option>O'zbekcha</option><option>Русский</option><option>O'zbek + Rus</option>
              </select>
            </Row>
          </div>
        </Card>
        <Card>
          <CardHeader title="Maxfiylik va ma'lumotlar" subtitle="Shaxsga doir ma'lumotlar to'g'risidagi qonunga muvofiq" />
          <div className="mt-2 divide-y divide-slate-100">
            <Row icon={EyeOff} title="Yuzlarni xiralashtirish" desc="Yozuv va ekranlarda avtomatik"><Toggle on={s.blur} onChange={(v) => setS({ ...s, blur: v })} /></Row>
            <Row icon={Database} title="Video saqlash muddati" desc="Faqat hodisa kliplari uzoqroq saqlanadi">
              <select value={s.retention} onChange={(e) => setS({ ...s, retention: Number(e.target.value) })} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                <option value={7}>7 kun</option><option value={30}>30 kun</option><option value={90}>90 kun</option>
              </select>
            </Row>
            <Row icon={ShieldCheck} title="Tungi qo'riqlash rejimi" desc="20:00 dan keyin har qanday harakat — signal"><Toggle on={s.night} onChange={(v) => setS({ ...s, night: v })} /></Row>
            <Row icon={Lock} title="Ikki bosqichli kirish" desc="Barcha nazoratchilar uchun majburiy"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Yoqilgan</span></Row>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Integratsiyalar" />
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {[
              ['Turniket / QR-beyj', "Kim obyektda ekanini aniq bilish"],
              ['1C / ERP', 'Brigada va pudratchilar ro\'yxati'],
              ['Mavjud kameralar (RTSP / ONVIF)', 'Yangi kamera sotib olmasdan ulash'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl p-4 ring-1 ring-slate-200">
                <Plug className="h-5 w-5 text-slate-400" />
                <div className="mt-2 text-sm font-semibold text-slate-900">{t}</div>
                <div className="text-xs text-slate-500">{d}</div>
                <button onClick={() => toast(`${t} — ulash so'rovi yuborildi`)} className="mt-3 text-xs font-semibold text-slate-900 underline decoration-[#FFC400] decoration-2 underline-offset-4">Ulash</button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
