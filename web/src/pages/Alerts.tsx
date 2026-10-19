import React, { useMemo, useState } from 'react';
import { X, Siren, Send, PhoneCall, CheckCircle2, UserCheck, Download, MapPin, Camera as CamIcon, Clock } from 'lucide-react';
import { Card, PageTitle, Button, useToast, timeAgo, hideImg } from '../components/ui';
import { alerts as seed, severityMeta, statusMeta, type AlertItem, type Severity, type AlertStatus } from '../data/mock';

export function Alerts() {
  const [items, setItems] = useState<AlertItem[]>(seed);
  const [sev, setSev] = useState<Severity | 'all'>('all');
  const [st, setSt] = useState<AlertStatus | 'all'>('all');
  const [open, setOpen] = useState<AlertItem | null>(null);
  const toast = useToast();

  const list = useMemo(() => items.filter((a) => (sev === 'all' || a.severity === sev) && (st === 'all' || a.status === st)), [items, sev, st]);
  const count = (s: AlertStatus) => items.filter((a) => a.status === s).length;

  const setStatus = (id: string, status: AlertStatus) => {
    setItems((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
    setOpen((o) => (o && o.id === id ? { ...o, status } : o));
  };

  return (
    <div>
      <PageTitle
        title="Ogohlantirishlar markazi"
        subtitle="Har bir signal avtomatik eskalatsiya qilinadi: joyida sirena → prorab → xavfsizlik bo'limi"
        action={<Button variant="secondary" onClick={() => toast('Excel fayl tayyorlanmoqda...')}><Download className="h-4 w-4" /> Eksport</Button>}
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {(['yangi', 'korib', 'hal'] as AlertStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setSt(st === s ? 'all' : s)}
            className={`rounded-2xl p-4 text-left ring-1 transition ${st === s ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white ring-slate-200 hover:ring-slate-300'}`}
          >
            <div className="text-2xl font-bold">{count(s)}</div>
            <div className={`text-xs font-medium sm:text-sm ${st === s ? 'text-slate-300' : 'text-slate-500'}`}>{statusMeta[s].label}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {(['all', 'kritik', 'yuqori', 'orta'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSev(s)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              sev === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {s !== 'all' && <span className={`h-2 w-2 rounded-full ${severityMeta[s].dot}`} />}
            {s === 'all' ? 'Barcha darajalar' : severityMeta[s].label}
          </button>
        ))}
      </div>

      <Card>
        <ul className="divide-y divide-slate-100">
          {list.map((a) => (
            <li key={a.id}>
              <button onClick={() => setOpen(a)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                  <img onError={hideImg} src={a.img} alt="" className="h-full w-full object-cover" style={{ objectPosition: a.pos }} />
                  <div className={`absolute inset-x-0 bottom-0 h-1 ${severityMeta[a.severity].dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-400">{a.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${severityMeta[a.severity].chip}`}>{severityMeta[a.severity].label}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{a.type}</div>
                  <div className="truncate text-xs text-slate-500">{a.floor} · {a.camera} · {a.assignee}</div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta[a.status].chip}`}>{statusMeta[a.status].label}</span>
                  <span className="text-xs text-slate-400">{timeAgo(a.minutesAgo)}</span>
                </div>
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="flex flex-col items-center px-5 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-7 w-7 text-emerald-500" /></div>
              <div className="mt-3 font-semibold text-slate-900">Bu filtrda ogohlantirish yo'q</div>
              <div className="text-sm text-slate-500">Obyektda hammasi joyida ko'rinadi</div>
            </li>
          )}
        </ul>
      </Card>

      {/* Tafsilotlar paneli */}
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/50 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video bg-slate-900">
              <img onError={hideImg} src={open.img} alt="" className="h-full w-full object-cover" style={{ objectPosition: open.pos }} />
              <div className="absolute inset-[22%_38%_12%_30%] rounded border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,.6)]" />
              <button onClick={() => setOpen(null)} className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white"><X className="h-5 w-5" /></button>
              <span className="absolute bottom-3 left-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">Dalil kadri · {timeAgo(open.minutesAgo)}</span>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${severityMeta[open.severity].chip}`}>{severityMeta[open.severity].label}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta[open.status].chip}`}>{statusMeta[open.status].label}</span>
                <span className="ml-auto font-mono text-xs text-slate-400">{open.id}</span>
              </div>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{open.type}</h3>
              <p className="mt-1 text-sm text-slate-600">{open.detail}</p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Info icon={MapPin} label="Joy" value={open.floor} />
                <Info icon={CamIcon} label="Kamera" value={open.camera} />
                <Info icon={Clock} label="Vaqt" value={timeAgo(open.minutesAgo)} />
              </div>

              <div className="mt-6 text-sm font-semibold text-slate-900">Eskalatsiya zanjiri</div>
              <ol className="mt-3 space-y-0">
                <Step icon={Siren} time="0 s" title="Joyida sirena va ovozli ogohlantirish" desc={`"Diqqat! Xavfli zona. Orqaga qayting." — ${open.floor} karnayi`} done />
                <Step icon={Send} time="30 s" title="Prorabga Telegram xabar + rasm" desc={open.assignee} done={open.minutesAgo >= 1} />
                <Step icon={PhoneCall} time="2 daq" title="Xavfsizlik bo'limi boshlig'iga qo'ng'iroq" desc="Agar 2 daqiqada tasdiqlanmasa" done={open.status !== 'yangi' || open.minutesAgo >= 2} last />
              </ol>

              <div className="mt-6 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => { setStatus(open.id, 'korib'); toast("Mas'uliyat o'zingizga olindi"); }}>
                  <UserCheck className="h-4 w-4" /> Men olaman
                </Button>
                <Button onClick={() => { setStatus(open.id, 'hal'); toast('Hodisa hal qilindi deb belgilandi'); }}>
                  <CheckCircle2 className="h-4 w-4" /> Hal qilindi
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Icon className="h-4 w-4 text-slate-400" />
      <div className="mt-1 text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Step({ icon: Icon, time, title, desc, done, last }: { icon: React.ElementType; time: string; title: string; desc: string; done?: boolean; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-5">
      {!last && <span className={`absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">{time}</span>
          <span className="text-sm font-semibold text-slate-900">{title}</span>
        </div>
        <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
      </div>
    </li>
  );
}
