'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  Check, Clock, Info, MessageSquare, PenLine, Plus, Send, Siren, Trash2, Undo2, Volume2, X,
} from 'lucide-react';
import { FormMessage, SubmitButton, Toggle } from '@/components/client';
import { Card, CardHeader, Field, btnClass, inputClass } from '@/components/ui';
import { FramePlaceholder, ZoneOverlay, pointsAttr, type Point } from '@/components/zone-overlay';
import { ZONE_TYPES, zoneTypeMeta, type ZoneType } from '@/lib/labels';
import { createZone, deleteZone, updateZone } from './actions';

export interface EditorCamera { id: string; code: string; name: string; floor: string; snapshotVersion: number | null }
export interface EditorZone {
  id: string; cameraId: string; name: string; type: ZoneType; points: Point[]; active: boolean;
  warnDistance: number; allowedRoles: string[];
  signals: { siren: boolean; voice: boolean; telegram: boolean; sms: boolean };
  activeFrom: string; activeTo: string; alerts24h: number;
}

const TRADES = ['Elektrik', 'Liftchi', 'Prorab', 'Kranchi', 'Payvandchi', 'Xavfsizlik muhandisi'];
const MAX_POINTS = 30;

export function ZoneEditor({ cameras, zones, initialCameraId, canEdit }: {
  cameras: EditorCamera[]; zones: EditorZone[]; initialCameraId: string; canEdit: boolean;
}) {
  const [camId, setCamId] = useState(initialCameraId);
  const [selectedId, setSelectedId] = useState<string | null>(() => zones.find((z) => z.cameraId === initialCameraId)?.id ?? null);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<Point[]>([]);
  const [newType, setNewType] = useState<ZoneType>('lift');
  const [newName, setNewName] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});

  const [createState, createAction] = useActionState(createZone, undefined);
  const [deleteState, deleteAction] = useActionState(deleteZone, undefined);

  const cam = cameras.find((c) => c.id === camId) ?? cameras[0];
  const camZones = useMemo(() => zones.filter((z) => z.cameraId === cam.id), [zones, cam.id]);
  const sel = zones.find((z) => z.id === selectedId) ?? null;

  // Yangi zona saqlangach — uni tanlab, chizish rejimidan chiqamiz.
  const lastCreated = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (createState?.id && createState.id !== lastCreated.current) {
      lastCreated.current = createState.id;
      setSelectedId(createState.id);
      setDrawing(false);
      setDraft([]);
      setNewName('');
    }
  }, [createState]);

  const lastDeleteOk = useRef<typeof deleteState>(undefined);
  useEffect(() => {
    if (deleteState?.ok && deleteState !== lastDeleteOk.current) {
      lastDeleteOk.current = deleteState;
      setSelectedId(null);
    }
  }, [deleteState]);

  const switchCamera = (id: string) => {
    setCamId(id);
    setDraft([]);
    setDrawing(false);
    setSelectedId(zones.find((z) => z.cameraId === id)?.id ?? null);
    try { window.history.replaceState(null, '', `/zones?camera=${id}`); } catch { /* ahamiyatsiz */ }
  };

  const startDrawing = () => { setDrawing(true); setDraft([]); setHint(null); };
  const cancelDrawing = () => { setDrawing(false); setDraft([]); setHint(null); };

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing) return;
    if (draft.length >= MAX_POINTS) { setHint(`Ko'pi bilan ${MAX_POINTS} ta nuqta`); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n * 10) / 10));
    const x = clamp(((e.clientX - r.left) / r.width) * 100);
    const y = clamp(((e.clientY - r.top) / r.height) * 100);
    setHint(null);
    setDraft((d) => [...d, [x, y]]);
  };

  const onCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (draft.length < 3) { e.preventDefault(); setHint('Kamida 3 nuqta belgilang'); }
  };

  const showImg = cam.snapshotVersion !== null && !imgFailed[cam.id];
  const activeCount = zones.filter((z) => z.active).length;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
      <Card className="overflow-hidden xl:sticky xl:top-20">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <select
            value={cam.id}
            onChange={(e) => switchCamera(e.target.value)}
            aria-label="Kamera"
            className="max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#FFC400]"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}{c.floor ? ` (${c.floor})` : ''}</option>
            ))}
          </select>
          {canEdit && (
            <div className="ml-auto flex items-center gap-1.5">
              {!drawing ? (
                <button type="button" onClick={startDrawing} className={btnClass('primary')}>
                  <Plus className="h-4 w-4" /> Yangi zona
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setDraft((d) => d.slice(0, -1))} disabled={!draft.length} className={btnClass('ghost', '!px-3')} aria-label="Oxirgi nuqtani olib tashlash">
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={cancelDrawing} className={btnClass('ghost')}>
                    <X className="h-4 w-4" /> Bekor
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div
          className={`relative aspect-video select-none overflow-hidden bg-slate-900 ${drawing ? 'cursor-crosshair' : ''}`}
          onClick={onCanvasClick}
        >
          {showImg ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/snapshots/camera/${cam.id}?t=${cam.snapshotVersion}`}
                alt={cam.name}
                draggable={false}
                onError={() => setImgFailed((m) => ({ ...m, [cam.id]: true }))}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/25" />
            </>
          ) : (
            <FramePlaceholder text="Kadr hali kelmagan — zona baribir chizilishi mumkin" />
          )}

          <ZoneOverlay
            zones={camZones}
            selectedId={selectedId}
            onSelect={drawing ? undefined : (id) => setSelectedId(id)}
          />

          {draft.length > 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <polygon
                points={pointsAttr(draft)}
                fill={`${zoneTypeMeta[newType].color}40`}
                stroke="#FFC400"
                strokeWidth="2"
                strokeDasharray={draft.length < 3 ? '5 4' : undefined}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {draft.map(([x, y], i) => (
            <span
              key={i}
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#FFC400] shadow"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          ))}

          {drawing && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#FFC400] px-4 py-1.5 text-xs font-bold text-slate-900 shadow-lg">
              Kadr ustiga bosib nuqtalar qo&apos;ying · {draft.length} nuqta
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {cam.code}{cam.floor ? ` · ${cam.floor}` : ''}
          </div>
        </div>

        {canEdit && drawing && (
          <form action={createAction} onSubmit={onCreateSubmit} className="space-y-3 border-t border-slate-100 p-4">
            <input type="hidden" name="cameraId" value={cam.id} />
            <input type="hidden" name="points" value={JSON.stringify(draft)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Zona nomi">
                <input
                  name="name"
                  required
                  maxLength={80}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`${zoneTypeMeta[newType].label}${cam.floor ? `, ${cam.floor}` : ''}`}
                  className={inputClass}
                />
              </Field>
              <Field label="Zona turi">
                <select name="type" value={newType} onChange={(e) => setNewType(e.target.value as ZoneType)} className={inputClass}>
                  {ZONE_TYPES.map((t) => <option key={t} value={t}>{zoneTypeMeta[t].label}</option>)}
                </select>
              </Field>
            </div>
            {hint && <div className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">{hint}</div>}
            <FormMessage state={createState?.error ? createState : undefined} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Kamida 3, ko&apos;pi bilan {MAX_POINTS} ta nuqta. Hozir: <b className="text-slate-800">{draft.length}</b></span>
              <SubmitButton pendingText="Saqlanmoqda..."><Check className="h-4 w-4" /> Zonani saqlash</SubmitButton>
            </div>
          </form>
        )}

        <div className="flex items-start gap-2 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Zonani quruvchi-muhandis bilan birga belgilang: lift va zina shaxtalari, to&apos;siqsiz derazalar, elektr shchitlari, kran radiusi va chuqurlar.
        </div>
      </Card>

      <div className="space-y-4">
        {!drawing && createState?.ok && <FormMessage state={{ ok: createState.ok }} />}
        {deleteState && <FormMessage state={deleteState} />}

        {sel ? (
          <ZoneDetails key={sel.id} zone={sel} canEdit={canEdit} deleteAction={deleteAction} />
        ) : (
          <Card className="p-5 text-sm text-slate-500">
            {camZones.length
              ? 'Tafsilotlarni ko\'rish uchun kadrdagi yoki ro\'yxatdagi zonani tanlang.'
              : canEdit
                ? 'Bu kamerada hali zona yo\'q. "Yangi zona" tugmasini bosib, kadr ustida chizing.'
                : 'Bu kamerada hali zona belgilanmagan.'}
          </Card>
        )}

        <Card>
          <CardHeader title="Barcha zonalar" subtitle={`${activeCount} ta faol · ${zones.length} ta jami`} />
          {zones.length ? (
            <ul className="mt-3 divide-y divide-slate-100 pb-2">
              {zones.map((z) => {
                const c = cameras.find((x) => x.id === z.cameraId);
                return (
                  <li key={z.id}>
                    <button
                      type="button"
                      onClick={() => { if (z.cameraId !== cam.id) switchCamera(z.cameraId); setSelectedId(z.id); setDrawing(false); setDraft([]); }}
                      className={`flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-slate-50 ${z.id === selectedId ? 'bg-amber-50/60' : ''}`}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: z.active ? zoneTypeMeta[z.type].color : '#CBD5E1' }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">{z.name}</div>
                        <div className="truncate text-xs text-slate-500">
                          {c ? `${c.code}${c.floor ? ` · ${c.floor}` : ''}` : ''} · {zoneTypeMeta[z.type].label}{!z.active ? ' · nofaol' : ''}
                        </div>
                      </div>
                      {z.alerts24h > 0 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600" title="So'nggi 24 soatdagi signallar">{z.alerts24h}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 pb-5 pt-2 text-sm text-slate-500">Hali birorta zona belgilanmagan.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Tanlangan zona tafsilotlari ---------- */

const SIGNAL_ROWS = [
  ['signal_siren', 'siren', 'Mahalliy sirena va chiroq', Siren],
  ['signal_voice', 'voice', "Ovozli xabar (o'zbek / rus)", Volume2],
  ['signal_telegram', 'telegram', 'Telegram — prorab va nazoratchi', Send],
  ['signal_sms', 'sms', "SMS — xavfsizlik boshlig'i", MessageSquare],
] as const;

function ZoneDetails({ zone, canEdit, deleteAction }: {
  zone: EditorZone; canEdit: boolean; deleteAction: (fd: FormData) => void;
}) {
  const [state, action] = useActionState(updateZone, undefined);
  const [type, setType] = useState<ZoneType>(zone.type);
  const [distance, setDistance] = useState(zone.warnDistance);
  const [roles, setRoles] = useState<string[]>(zone.allowedRoles);
  const [customRole, setCustomRole] = useState('');

  const allTrades = useMemo(() => [...new Set([...TRADES, ...roles])], [roles]);

  const addCustom = () => {
    const v = customRole.trim().slice(0, 40);
    if (v && !roles.includes(v) && roles.length < 20) setRoles((r) => [...r, v]);
    setCustomRole('');
  };

  return (
    <Card className="p-5">
      <form action={action}>
        <input type="hidden" name="id" value={zone.id} />
        <input type="hidden" name="type" value={type} />
        {roles.map((r) => <input key={r} type="hidden" name="allowed_roles" value={r} />)}

        <fieldset disabled={!canEdit} className="min-w-0 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {zoneTypeMeta[type].label} · {zone.points.length} nuqta
              </div>
              <input
                name="name"
                defaultValue={zone.name}
                required
                maxLength={80}
                aria-label="Zona nomi"
                className="mt-1 w-full rounded-lg border border-transparent px-1 py-0.5 text-lg font-bold text-slate-900 outline-none hover:border-slate-200 focus:border-[#FFC400] disabled:bg-transparent disabled:hover:border-transparent"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-500">Faol</span>
              <Toggle name="active" defaultChecked={zone.active} label="Zona faol" />
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700">Zona turi</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {ZONE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold ring-1 transition disabled:cursor-default ${type === t ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 disabled:hover:bg-white'}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: zoneTypeMeta[t].color }} />
                  <span className="min-w-0 truncate">{zoneTypeMeta[t].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Ogohlantirish masofasi</span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-900">{String(distance).replace('.', ',')} m</span>
            </div>
            <input
              type="range"
              name="warn_distance_m"
              min={0.5}
              max={10}
              step={0.5}
              value={distance}
              onChange={(e) => setDistance(Number(e.target.value))}
              className="mt-2 w-full accent-[#FFC400]"
              aria-label="Ogohlantirish masofasi, metr"
            />
            <div className="flex justify-between text-[11px] text-slate-400"><span>0,5 m</span><span>10 m</span></div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700">Kirishga ruxsat etilganlar</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allTrades.map((r) => {
                const on = roles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRoles((a) => (on ? a.filter((x) => x !== r) : [...a, r]))}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${on ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {on ? '✓ ' : ''}{r}
                  </button>
                );
              })}
            </div>
            {canEdit && (
              <div className="mt-2 flex gap-1.5">
                <input
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
                  maxLength={40}
                  placeholder="Boshqa kasb..."
                  className={`${inputClass} !py-1.5`}
                />
                <button type="button" onClick={addCustom} className={btnClass('secondary', '!px-3 !py-1.5')} aria-label="Kasb qo'shish">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-700">Signal turlari</div>
            <div className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {SIGNAL_ROWS.map(([name, key, label, Icon]) => (
                <div key={name} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-sm text-slate-700">{label}</span>
                  <Toggle name={name} defaultChecked={zone.signals[key]} label={label} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock className="h-4 w-4 text-slate-400" /> Faol vaqt (har kuni)
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Boshlanishi">
                <input type="time" name="active_from" defaultValue={zone.activeFrom} required className={inputClass} />
              </Field>
              <Field label="Tugashi">
                <input type="time" name="active_to" defaultValue={zone.activeTo} required className={inputClass} />
              </Field>
            </div>
          </div>
        </fieldset>

        {canEdit && (
          <div className="mt-5 space-y-3">
            <FormMessage state={state} />
            <SubmitButton className="w-full" pendingText="Saqlanmoqda..."><Check className="h-4 w-4" /> Sozlamalarni saqlash</SubmitButton>
          </div>
        )}
      </form>

      {canEdit && (
        <form
          action={deleteAction}
          onSubmit={(e) => { if (!window.confirm(`"${zone.name}" zonasini o'chirasizmi? Bu amalni qaytarib bo'lmaydi.`)) e.preventDefault(); }}
          className="mt-2"
        >
          <input type="hidden" name="id" value={zone.id} />
          <SubmitButton variant="ghost" className="w-full !text-red-600 hover:!bg-red-50" pendingText="O'chirilmoqda...">
            <Trash2 className="h-4 w-4" /> Zonani o&apos;chirish
          </SubmitButton>
        </form>
      )}

      {!canEdit && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          <PenLine className="h-4 w-4 shrink-0" /> Zonani o&apos;zgartirish uchun nazoratchi yoki administrator huquqi kerak.
        </p>
      )}
    </Card>
  );
}
