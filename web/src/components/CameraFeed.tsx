import React from 'react';
import { VideoOff } from 'lucide-react';
import type { Camera } from '../data/mock';
import { hideImg } from './ui';

/** Kamera kadri + AI qatlamlari (odam ramkalari, PPE belgilari, xavfli zona) */
export function CameraFeed({ cam, large = false, blurFaces = true }: { cam: Camera; large?: boolean; blurFaces?: boolean }) {
  const hasViolation = cam.people.some((p) => !p.helmet || !p.vest || p.harness === false);
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-slate-950">
      {cam.online ? (
        <>
          <img onError={hideImg} src={cam.img} alt={cam.name} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: cam.pos }} loading="lazy" />
          <div className="absolute inset-0 bg-slate-950/25" />
          {/* xavfli zona */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            {cam.zone && (
              <polygon points={cam.zone.points} fill="rgba(229,56,59,0.28)" stroke="#FF4D4F" strokeWidth="0.6" strokeDasharray="2 1.2" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {cam.zone && (() => {
            const [x, y] = cam.zone.points.split(' ')[0].split(',').map(Number);
            return (
              <span className="absolute rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ left: `${x}%`, top: `calc(${y}% - 20px)` }}>
                ⚠ {cam.zone.label}
              </span>
            );
          })()}
          {/* odamlar */}
          {cam.people.map((p, i) => {
            const bad = !p.helmet || !p.vest || p.harness === false;
            const color = bad ? '#FF4D4F' : '#2BB673';
            return (
              <div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%` }}>
                <div className="absolute inset-0 rounded-[3px] border-2" style={{ borderColor: color, boxShadow: `0 0 0 1px rgba(0,0,0,.25), 0 0 14px ${color}55` }} />
                {blurFaces && <div className="absolute left-1/2 top-[3%] h-[16%] w-[52%] -translate-x-1/2 rounded-full bg-white/10 backdrop-blur-md" />}
                <div className={`absolute -top-[2px] left-0 flex -translate-y-full flex-wrap gap-0.5 ${large ? 'text-[11px]' : 'text-[9px]'}`}>
                  <span className={`rounded-sm px-1 font-semibold text-white ${p.helmet ? 'bg-emerald-600' : 'bg-red-600'}`}>Kaska {p.helmet ? '✓' : '✗'}</span>
                  <span className={`rounded-sm px-1 font-semibold text-white ${p.vest ? 'bg-emerald-600' : 'bg-red-600'}`}>Yelek {p.vest ? '✓' : '✗'}</span>
                  {p.harness !== undefined && (
                    <span className={`rounded-sm px-1 font-semibold text-white ${p.harness ? 'bg-emerald-600' : 'bg-red-600'}`}>Kamar {p.harness ? '✓' : '✗'}</span>
                  )}
                </div>
              </div>
            );
          })}
          {/* sarlavha */}
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            JONLI
          </div>
          <div className="absolute right-2 top-2 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] text-white/90 backdrop-blur">{cam.fps} FPS</div>
          {hasViolation && <div className="absolute inset-0 rounded-xl ring-2 ring-inset ring-red-500/80" />}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
          <VideoOff className="h-8 w-8" />
          <span className="text-sm font-medium">Kamera oflayn</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-white">
        <div>
          <div className={`font-semibold ${large ? 'text-base' : 'text-[13px]'}`}>{cam.name}</div>
          <div className="text-[11px] text-white/70">{cam.id} · {cam.floor}</div>
        </div>
        {cam.online && (
          <div className="text-right text-[11px] text-white/80">
            <b className="text-white">{cam.people.length}</b> kishi
          </div>
        )}
      </div>
    </div>
  );
}
