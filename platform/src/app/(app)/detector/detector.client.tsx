'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Square, Loader2, Volume2, VolumeX, Users, ShieldAlert, Camera as CamIcon } from 'lucide-react';
import { zoneTypeMeta, type ZoneType } from '@/lib/labels';
import { btnClass } from '@/components/ui';
import { pushFrame, reportDetection } from './actions';

type Cam = { id: string; code: string; name: string; floor: string };
type Zone = { id: string; camera_id: string; name: string; type: ZoneType; points: [number, number][] };
type Det = { bbox: [number, number, number, number]; class: string; score: number };
type Model = { detect: (v: HTMLVideoElement) => Promise<Det[]> };

const REPORT_COOLDOWN_MS = 30_000;
const FRAME_EVERY_MS = 15_000;
const DOWN_PERSIST_MS = 6_000;

function inside([x, y]: [number, number], poly: [number, number][]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function distToSeg(p: [number, number], a: [number, number], b: [number, number]) {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const nearPoly = (p: [number, number], poly: [number, number][], margin: number) =>
  poly.some((a, i) => distToSeg(p, a, poly[(i + 1) % poly.length]) < margin);

export function Detector({ cameras, zones }: { cameras: Cam[]; zones: Zone[] }) {
  const [camId, setCamId] = useState(cameras[0].id);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sound, setSound] = useState(true);
  const [people, setPeople] = useState(0);
  const [status, setStatus] = useState<'ok' | 'warn' | 'danger'>('ok');
  const [log, setLog] = useState<{ t: string; text: string; ok: boolean }[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Model | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(false);
  const lastReport = useRef<Record<string, number>>({});
  const lastFrame = useRef(0);
  const downSince = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const camZones = zones.filter((z) => z.camera_id === camId);
  const zonesRef = useRef(camZones);
  zonesRef.current = camZones;
  const camRef = useRef(camId);
  camRef.current = camId;

  const addLog = (text: string, ok = true) =>
    setLog((l) => [{ t: new Date().toLocaleTimeString('uz-UZ'), text, ok }, ...l].slice(0, 8));

  const alarm = useCallback(() => {
    if (!soundRef.current) return;
    try {
      const ctx = audioRef.current ?? (audioRef.current = new AudioContext());
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.35);
      o.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.7);
      g.gain.value = 0.15;
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.7);
      const u = new SpeechSynthesisUtterance("Diqqat! Xavfli zona. Orqaga qayting.");
      const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('uz')) ?? speechSynthesis.getVoices().find((x) => x.lang.startsWith('tr'));
      if (v) u.voice = v;
      u.rate = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* ovoz ixtiyoriy */ }
  }, []);

  const snapshot = (dets: Det[], hotZone?: string) => {
    const v = videoRef.current!;
    const c = document.createElement('canvas');
    const scale = Math.min(1, 640 / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.lineWidth = 3;
    for (const z of zonesRef.current) {
      ctx.strokeStyle = z.id === hotZone ? '#FF3B30' : zoneTypeMeta[z.type].color;
      ctx.beginPath();
      z.points.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (x / 100) * c.width, (y / 100) * c.height));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.strokeStyle = '#FFC400';
    for (const d of dets) ctx.strokeRect(d.bbox[0] * scale, d.bbox[1] * scale, d.bbox[2] * scale, d.bbox[3] * scale);
    return c.toDataURL('image/jpeg', 0.72).split(',')[1];
  };

  const loop = useCallback(async () => {
    const v = videoRef.current, cv = canvasRef.current, model = modelRef.current;
    if (!runRef.current || !v || !cv || !model) return;
    if (v.readyState >= 2 && v.videoWidth) {
      const dets = (await model.detect(v)).filter((d) => d.class === 'person' && d.score > 0.5);
      const W = v.videoWidth, H = v.videoHeight;
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      let level: 'ok' | 'warn' | 'danger' = 'ok';
      let hit: Zone | null = null;
      const now = Date.now();

      for (const z of zonesRef.current) {
        ctx.beginPath();
        z.points.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (x / 100) * W, (y / 100) * H));
        ctx.closePath();
        ctx.fillStyle = zoneTypeMeta[z.type].color + '40';
        ctx.fill();
        ctx.lineWidth = Math.max(2, W / 320);
        ctx.strokeStyle = zoneTypeMeta[z.type].color;
        ctx.stroke();
      }

      let lying = false;
      for (const d of dets) {
        const [x, y, w, h] = d.bbox;
        const foot: [number, number] = [((x + w / 2) / W) * 100, ((y + h) / H) * 100];
        let state: 'ok' | 'warn' | 'danger' = 'ok';
        for (const z of zonesRef.current) {
          if (inside(foot, z.points)) { state = 'danger'; hit = hit ?? z; }
          else if (state === 'ok' && nearPoly(foot, z.points, 4)) state = 'warn';
        }
        if (w > h * 1.4) lying = true;
        if (state === 'danger') level = 'danger';
        else if (state === 'warn' && level === 'ok') level = 'warn';
        const color = state === 'danger' ? '#FF3B30' : state === 'warn' ? '#FF9500' : '#34C759';
        ctx.lineWidth = Math.max(3, W / 240);
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(14, W / 50)}px sans-serif`;
        ctx.fillText(state === 'danger' ? 'XAVFLI ZONA!' : state === 'warn' ? 'Yaqinlashmoqda' : `Odam ${Math.round(d.score * 100)}%`, x + 4, Math.max(18, y - 6));
      }
      setPeople(dets.length);
      setStatus(level);

      if (hit) {
        const key = hit.id;
        if (now - (lastReport.current[key] ?? 0) > REPORT_COOLDOWN_MS) {
          lastReport.current[key] = now;
          alarm();
          const r = await reportDetection({ cameraId: camRef.current, zoneId: hit.id, type: 'zone_intrusion', people: dets.length, snapshot: snapshot(dets, hit.id) });
          addLog(r.ok ? `Signal yuborildi: ${hit.name}` : `Xato: ${r.error}`, r.ok);
        }
      }

      if (lying) {
        downSince.current ??= now;
        if (now - downSince.current > DOWN_PERSIST_MS && now - (lastReport.current.down ?? 0) > REPORT_COOLDOWN_MS * 2) {
          lastReport.current.down = now;
          alarm();
          const r = await reportDetection({ cameraId: camRef.current, type: 'person_down', people: dets.length, snapshot: snapshot(dets) });
          addLog(r.ok ? 'Signal: yotgan / qulagan odam' : `Xato: ${r.error}`, r.ok);
        }
      } else downSince.current = null;

      if (now - lastFrame.current > FRAME_EVERY_MS) {
        lastFrame.current = now;
        pushFrame({ cameraId: camRef.current, snapshot: snapshot(dets), people: dets.length }).catch(() => {});
      }
    }
    setTimeout(() => requestAnimationFrame(() => void loop()), 250);
  }, [alarm]);

  const start = async () => {
    setError('');
    setPhase('loading');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Brauzeringiz kamerani qo\'llab-quvvatlamaydi (HTTPS kerak).');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      if (!modelRef.current) {
        await import('@tensorflow/tfjs');
        const coco = await import('@tensorflow-models/coco-ssd');
        modelRef.current = (await coco.load({ base: 'lite_mobilenet_v2' })) as unknown as Model;
      }
      runRef.current = true;
      setPhase('running');
      addLog('Detektor ishga tushdi');
      void loop();
    } catch (e) {
      stop();
      setPhase('error');
      const msg = (e as Error).name === 'NotAllowedError' ? 'Kameraga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.' : (e as Error).message || "Noma'lum xato";
      setError(msg);
    }
  };

  const stop = () => {
    runRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPhase((p) => (p === 'error' ? p : 'idle'));
    setStatus('ok');
  };

  useEffect(() => () => { runRef.current = false; streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  const banner = {
    ok: { cls: 'bg-emerald-600', text: 'Xavfsiz' },
    warn: { cls: 'bg-orange-500', text: 'Diqqat: xavfli zonaga yaqinlashish' },
    danger: { cls: 'bg-red-600 animate-pulse', text: 'XAVFLI ZONA — ogohlantirish berildi!' },
  }[status];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="overflow-hidden rounded-2xl bg-[#0B0C0E] ring-1 ring-slate-800">
        <div className="relative aspect-video w-full">
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-fill" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {phase !== 'running' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
              {phase === 'loading' ? (<><Loader2 className="h-8 w-8 animate-spin text-[#FFC400]" /><div>AI modeli yuklanmoqda (birinchi marta ~5 MB)...</div></>)
                : (<><CamIcon className="h-10 w-10 text-slate-500" /><div className="max-w-sm text-sm">Kamerani yoqing. Kadrdagi odam oyog'i zona ichiga kirsa — sirena chalinadi va signal yuboriladi.</div></>)}
              {error && <div className="max-w-md rounded-lg bg-red-600/20 px-3 py-2 text-sm text-red-200">{error}</div>}
            </div>
          )}
          {phase === 'running' && (
            <div className={`absolute inset-x-0 top-0 px-4 py-2 text-center text-sm font-bold text-white ${banner.cls}`}>{banner.text}</div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <label className="text-sm font-semibold text-slate-700">Qaysi kamera nomidan ishlaydi</label>
          <select value={camId} disabled={phase === 'running' || phase === 'loading'} onChange={(e) => setCamId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold">
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name} ({c.floor})</option>)}
          </select>
          <div className="mt-2 text-xs text-slate-500">
            {camZones.length ? `${camZones.length} ta faol xavfli zona: ${camZones.map((z) => z.name).join(', ')}` : "Bu kamerada faol zona yo'q — avval \"Xavfli zonalar\" bo'limida chizing."}
          </div>
          <div className="mt-4 flex gap-2">
            {phase === 'running'
              ? <button onClick={stop} className={btnClass('danger', 'flex-1')}><Square className="h-4 w-4" /> To'xtatish</button>
              : <button onClick={start} disabled={phase === 'loading'} className={btnClass('primary', 'flex-1')}><Play className="h-4 w-4" /> Kamerani yoqish</button>}
            <button onClick={() => setSound(!sound)} className={btnClass('secondary')} aria-label="Ovoz">
              {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-3"><Users className="mx-auto h-4 w-4 text-slate-400" /><div className="mt-1 text-xl font-bold">{people}</div><div className="text-[11px] text-slate-500">kadrda odam</div></div>
            <div className="rounded-xl bg-slate-50 p-3"><ShieldAlert className="mx-auto h-4 w-4 text-slate-400" /><div className="mt-1 text-xl font-bold">{log.filter((l) => l.text.startsWith('Signal')).length}</div><div className="text-[11px] text-slate-500">yuborilgan signal</div></div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="text-sm font-semibold text-slate-700">Hodisalar jurnali</div>
          <ul className="mt-2 space-y-1.5 text-xs">
            {log.length === 0 && <li className="text-slate-400">Hozircha hodisa yo'q</li>}
            {log.map((l, i) => <li key={i} className={l.ok ? 'text-slate-600' : 'text-red-600'}><span className="font-mono text-slate-400">{l.t}</span> {l.text}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
