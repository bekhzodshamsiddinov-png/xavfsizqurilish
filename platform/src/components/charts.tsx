'use client';

import React, { useState } from 'react';

/* Yarim doira ko'rsatkich (Xavfsizlik indeksi) */
export function Gauge({ value }: { value: number }) {
  const r = 80;
  const c = Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = value >= 85 ? '#2BB673' : value >= 65 ? '#F77F00' : '#E5383B';
  const label = value >= 85 ? 'Yaxshi' : value >= 65 ? "E'tibor talab" : 'Xavfli';
  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <svg viewBox="0 0 200 116" className="w-full">
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#EEF0F3" strokeWidth="16" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="text-4xl font-bold tracking-tight text-slate-900">{value}</div>
        <div className="text-xs font-semibold" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

export interface Series { name: string; color: string; values: number[] }

/* Chiziqli grafik */
export function LineChart({ labels, series, height = 200 }: { labels: string[]; series: Series[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = height, pl = 28, pr = 12, pt = 12, pb = 26;
  const max = Math.ceil(Math.max(...series.flatMap((s) => s.values)) / 5) * 5 || 5;
  const x = (i: number) => pl + (i * (W - pl - pr)) / (labels.length - 1);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  const ticks = [0, max / 2, max];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="#EEF0F3" />
            <text x={pl - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#94A3B8">{t}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#64748B">{l}</text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="#CBD5E1" strokeDasharray="3 3" />}
        {series.map((s) => (
          <g key={s.name}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 0} fill="white" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - 20} y={0} width={40} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg bg-[#14161A] px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="mb-1 font-semibold">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <b>{s.values[hover]}</b>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* Gorizontal bar */
export function HBars({ data }: { data: { label: string; value: number; sub?: string }[] }) {
  return (
    <div className="space-y-3.5">
      {data.map((d) => {
        const color = d.value >= 90 ? '#2BB673' : d.value >= 80 ? '#F59E0B' : '#E5383B';
        return (
          <div key={d.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{d.label}</span>
              <span className="font-semibold text-slate-900">{d.value}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: color }} />
            </div>
            {d.sub && <div className="mt-1 text-xs text-slate-500">{d.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* Donut */
export function Donut({ data, center }: { data: { label: string; value: number; color: string }[]; center: string }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = 52, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#F1F5F9" strokeWidth="18" />
          {data.map((d) => {
            const len = (d.value / total) * C;
            const el = (
              <circle key={d.label} cx="70" cy="70" r={r} fill="none" stroke={d.color} strokeWidth="18"
                strokeDasharray={`${len - 2} ${C - len + 2}`} strokeDashoffset={-acc} />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-slate-900">{total}</div>
          <div className="text-[11px] text-slate-500">{center}</div>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
              {d.label}
            </span>
            <span className="font-semibold text-slate-900">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Vertikal ustunlar (soatlar bo'yicha) */
export function Columns({ labels, values, highlight }: { labels: string[]; values: number[]; highlight?: number[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex h-44 items-end gap-1.5 sm:gap-2">
      {values.map((v, i) => {
        const hot = highlight?.includes(i);
        return (
          <div key={labels[i]} className="group flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">{v}</span>
            <div
              className={`w-full rounded-t-md transition ${hot ? 'bg-[#E5383B]' : 'bg-slate-300 group-hover:bg-slate-400'}`}
              style={{ height: `${(v / max) * 120}px` }}
            />
            <span className="text-[10px] text-slate-500">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
