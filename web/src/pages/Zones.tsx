import React, { useState } from 'react';
import { PenLine, Trash2, Undo2, Check, Plus, Siren, Volume2, Send, MessageSquare, Clock, Info } from 'lucide-react';
import { Card, CardHeader, PageTitle, Button, Toggle, useToast, hideImg } from '../components/ui';
import { initialZones, zoneTypes, cameras, type Zone } from '../data/mock';

const roles = ['Elektrik', 'Liftchi', 'Prorab', 'Kranchi', 'Xavfsizlik muhandisi'];

export function Zones() {
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [camId, setCamId] = useState('KAM-09');
  const [selectedId, setSelectedId] = useState<string>('Z-01');
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [newType, setNewType] = useState('lift');
  const [allowed, setAllowed] = useState<string[]>(['Liftchi', 'Prorab']);
  const [signals, setSignals] = useState({ sirena: true, ovoz: true, telegram: true, sms: false });
  const toast = useToast();

  const cam = cameras.find((c) => c.id === camId)!;
  const camZones = zones.filter((z) => z.camera === camId);
  const sel = zones.find((z) => z.id === selectedId);
  const typeOf = (k: string) => zoneTypes.find((t) => t.key === k)!;

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    setDraft((d) => [...d, [x, y]]);
  };

  const finish = () => {
    if (draft.length < 3) { toast('Kamida 3 nuqta belgilang'); return; }
    const id = `Z-${String(zones.length + 1).padStart(2, '0')}`;
    const z: Zone = {
      id, name: `${typeOf(newType).label} (yangi)`, type: newType, camera: camId, floor: cam.floor,
      points: draft.map((p) => p.join(',')).join(' '), active: true, distance: 2, alertsToday: 0,
    };
    setZones((zs) => [...zs, z]);
    setSelectedId(id);
    setDraft([]);
    setDrawing(false);
    toast('Yangi xavfli zona saqlandi va kuzatuvga olindi');
  };

  const update = (patch: Partial<Zone>) => sel && setZones((zs) => zs.map((z) => (z.id === sel.id ? { ...z, ...patch } : z)));

  return (
    <div>
      <PageTitle
        title="Xavfli zonalar"
        subtitle="Kamera kadrida zonani chizing — AI unga yaqinlashgan har bir odamni darhol aniqlaydi"
        action={<Button onClick={() => { setDrawing(true); setDraft([]); }}><Plus className="h-4 w-4" /> Yangi zona</Button>}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden xl:sticky xl:top-20">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <select value={camId} onChange={(e) => { setCamId(e.target.value); setDraft([]); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#FFC400]">
              {cameras.filter((c) => c.online).map((c) => <option key={c.id} value={c.id}>{c.id} — {c.name} ({c.floor})</option>)}
            </select>
            <div className="ml-auto flex items-center gap-1.5">
              {!drawing ? (
                <Button variant="secondary" onClick={() => { setDrawing(true); setDraft([]); }}><PenLine className="h-4 w-4" /> Zona chizish</Button>
              ) : (
                <>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {zoneTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <Button variant="ghost" onClick={() => setDraft((d) => d.slice(0, -1))} aria-label="Orqaga"><Undo2 className="h-4 w-4" /></Button>
                  <Button variant="ghost" onClick={() => { setDrawing(false); setDraft([]); }}>Bekor</Button>
                  <Button onClick={finish}><Check className="h-4 w-4" /> Saqlash</Button>
                </>
              )}
            </div>
          </div>

          <div className={`relative aspect-video select-none bg-slate-900 ${drawing ? 'cursor-crosshair' : ''}`} onClick={onCanvasClick}>
            <img onError={hideImg} src={cam.img} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: cam.pos }} draggable={false} />
            <div className="absolute inset-0 bg-slate-950/30" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              {camZones.map((z) => {
                const c = typeOf(z.type).color;
                const active = z.id === selectedId;
                return (
                  <polygon
                    key={z.id}
                    points={z.points}
                    fill={z.active ? `${c}55` : 'rgba(148,163,184,.25)'}
                    stroke={z.active ? c : '#94A3B8'}
                    strokeWidth={active ? 3 : 1.5}
                    strokeDasharray={z.active ? undefined : '6 4'}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer"
                    onClick={(e) => { if (!drawing) { e.stopPropagation(); setSelectedId(z.id); } }}
                  />
                );
              })}
              {draft.length > 0 && (
                <polyline points={draft.map((p) => p.join(',')).join(' ')} fill="rgba(255,196,0,.25)" stroke="#FFC400" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              )}
            </svg>
            {draft.map(([x, y], i) => (
              <span key={i} className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#FFC400] shadow" style={{ left: `${x}%`, top: `${y}%` }} />
            ))}
            {camZones.map((z) => {
              const [x, y] = z.points.split(' ')[0].split(',').map(Number);
              return (
                <span key={z.id} className="pointer-events-none absolute rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ left: `${x}%`, top: `calc(${y}% - 20px)`, background: z.active ? typeOf(z.type).color : '#64748B' }}>
                  {z.name}
                </span>
              );
            })}
            {drawing && (
              <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-[#FFC400] px-4 py-1.5 text-xs font-bold text-slate-900 shadow-lg">
                Kadr ustiga bosib nuqtalar qo'ying · {draft.length} nuqta
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            Zonani quruvchi-muhandis bilan birga belgilang: lift va zina shaxtalari, to'siqsiz derazalar, elektr shchitlari, kran radiusi va chuqurlar.
          </div>
        </Card>

        <div className="space-y-4">
          {sel && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{sel.id} · {sel.camera}</div>
                  <input value={sel.name} onChange={(e) => update({ name: e.target.value })} className="mt-1 w-full rounded-lg border border-transparent px-1 py-0.5 text-lg font-bold text-slate-900 outline-none hover:border-slate-200 focus:border-[#FFC400]" />
                </div>
                <Toggle on={sel.active} onChange={(v) => update({ active: v })} label="Faol" />
              </div>

              <label className="mt-4 block text-sm font-semibold text-slate-700">Zona turi</label>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {zoneTypes.map((t) => (
                  <button key={t.key} onClick={() => update({ type: t.key })} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ring-1 transition ${sel.type === t.key ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />{t.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Ogohlantirish masofasi</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-900">{sel.distance} m</span>
              </div>
              <input type="range" min={0.5} max={8} step={0.5} value={sel.distance} onChange={(e) => update({ distance: Number(e.target.value) })} className="mt-2 w-full accent-[#FFC400]" />
              <div className="flex justify-between text-[11px] text-slate-400"><span>0,5 m</span><span>8 m</span></div>

              <div className="mt-5 text-sm font-semibold text-slate-700">Kirishga ruxsat etilganlar</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {roles.map((r) => {
                  const on = allowed.includes(r);
                  return (
                    <button key={r} onClick={() => setAllowed((a) => (on ? a.filter((x) => x !== r) : [...a, r]))} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      {on ? '✓ ' : ''}{r}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 text-sm font-semibold text-slate-700">Signal turlari</div>
              <div className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {([
                  ['sirena', 'Mahalliy sirena va chiroq', Siren],
                  ['ovoz', "Ovozli xabar (o'zbek / rus)", Volume2],
                  ['telegram', 'Telegram — prorab va nazoratchi', Send],
                  ['sms', 'SMS — xavfsizlik boshlig\'i', MessageSquare],
                ] as const).map(([k, label, Icon]) => (
                  <div key={k} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 text-sm text-slate-700">{label}</span>
                    <Toggle on={signals[k]} onChange={(v) => setSignals((s) => ({ ...s, [k]: v }))} label={label} />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                <Clock className="h-4 w-4 shrink-0 text-slate-400" /><span>Faol vaqt: <b className="text-slate-900">har kuni 07:00 – 20:00</b>, tunda — qo'riqlash rejimi</span>
              </div>

              <Button variant="ghost" className="mt-3 w-full !text-red-600 hover:!bg-red-50" onClick={() => { setZones((zs) => zs.filter((z) => z.id !== sel.id)); setSelectedId(''); toast("Zona o'chirildi"); }}>
                <Trash2 className="h-4 w-4" /> Zonani o'chirish
              </Button>
            </Card>
          )}

          <Card>
            <CardHeader title="Barcha zonalar" subtitle={`${zones.filter((z) => z.active).length} ta faol · ${zones.length} ta jami`} />
            <ul className="mt-3 divide-y divide-slate-100 pb-2">
              {zones.map((z) => (
                <li key={z.id}>
                  <button onClick={() => { setSelectedId(z.id); setCamId(z.camera); }} className={`flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50 ${z.id === selectedId ? 'bg-amber-50/60' : ''}`}>
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: z.active ? typeOf(z.type).color : '#CBD5E1' }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{z.name}</div>
                      <div className="text-xs text-slate-500">{z.floor} · {z.camera}</div>
                    </div>
                    {z.alertsToday > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">{z.alertsToday}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
