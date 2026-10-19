import type React from 'react';
import { zoneTypeMeta, type ZoneType, ZONE_TYPES } from '@/lib/labels';

export type Point = [number, number];

export interface ZonePoly {
  id: string;
  name: string;
  type: ZoneType;
  points: Point[];
  active: boolean;
}

/** Bazadan kelgan jsonb `points` qiymatini xavfsiz shaklga keltiradi (noto'g'ri nuqtalar tashlanadi). */
export function normalizePoints(raw: unknown): Point[] {
  if (!Array.isArray(raw)) return [];
  const out: Point[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const x = Number(p[0]);
    const y = Number(p[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push([Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y))]);
  }
  return out;
}

export function asZoneType(t: string): ZoneType {
  return (ZONE_TYPES as string[]).includes(t) ? (t as ZoneType) : 'boshqa';
}

export const pointsAttr = (pts: Point[]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

/** Yorliq uchun eng yuqori nuqta. */
function labelAnchor(pts: Point[]): Point {
  return pts.reduce((a, b) => (b[1] < a[1] ? b : a), pts[0]);
}

/**
 * Kadr ustidagi zona qatlami (SVG viewBox 0 0 100 100, foizli koordinatalar).
 * Server va mijoz komponentlarida ishlaydi; `onSelect` faqat mijoz tomonida beriladi.
 */
export function ZoneOverlay({
  zones, selectedId, onSelect, labels = true, small = false,
}: {
  zones: ZonePoly[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  labels?: boolean;
  small?: boolean;
}) {
  const drawable = zones.filter((z) => z.points.length >= 3);
  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {drawable.map((z) => {
          const c = zoneTypeMeta[z.type].color;
          const sel = z.id === selectedId;
          return (
            <polygon
              key={z.id}
              points={pointsAttr(z.points)}
              fill={z.active ? `${c}55` : 'rgba(148,163,184,.25)'}
              stroke={z.active ? c : '#94A3B8'}
              strokeWidth={sel ? 3 : small ? 1.25 : 1.75}
              strokeDasharray={z.active ? undefined : '6 4'}
              vectorEffect="non-scaling-stroke"
              className={onSelect ? 'pointer-events-auto cursor-pointer' : undefined}
              onClick={onSelect ? (e: React.MouseEvent) => { e.stopPropagation(); onSelect(z.id); } : undefined}
            />
          );
        })}
      </svg>
      {labels && drawable.map((z) => {
        const [x, y] = labelAnchor(z.points);
        return (
          <span
            key={z.id}
            className={`pointer-events-none absolute max-w-[45%] truncate rounded px-1.5 py-0.5 font-bold text-white shadow ${small ? 'text-[9px]' : 'text-[10px]'}`}
            style={{
              left: `${Math.min(x, 85)}%`,
              top: y < 8 ? `calc(${y}% + 4px)` : `calc(${y}% - 20px)`,
              background: z.active ? zoneTypeMeta[z.type].color : '#64748B',
            }}
          >
            {z.name}
          </span>
        );
      })}
    </>
  );
}

/** Kadr bo'lmaganda ko'rsatiladigan neytral fon (to'q gradient + nozik to'r). */
export function FramePlaceholder({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950">
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '10% 10%',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-slate-400">
        {text}
      </div>
    </div>
  );
}
