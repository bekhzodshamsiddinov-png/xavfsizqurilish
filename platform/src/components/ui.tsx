import type React from 'react';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 3 6 9.5v12.8C6 33.6 13.6 42.4 24 45c10.4-2.6 18-11.4 18-22.7V9.5L24 3Z" fill="#FFC400" />
      <path d="M24 7.4 10 12.5v9.9c0 9 5.8 16 14 18.4 8.2-2.4 14-9.4 14-18.4v-9.9L24 7.4Z" fill="#14161A" />
      <path d="M14.5 29.5h19v2.6h-19z" fill="#FFC400" />
      <path d="M16.5 29.5c0-5 3.3-8.6 7.5-8.6s7.5 3.6 7.5 8.6" fill="#FFC400" />
      <path d="M22.6 20.4h2.8v5.2h-2.8z" fill="#14161A" />
    </svg>
  );
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export const btn = {
  base: 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400] disabled:cursor-not-allowed disabled:opacity-50',
  primary: 'bg-[#FFC400] text-slate-900 hover:bg-[#FFD02E] shadow-sm',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  dark: 'bg-slate-900 text-white hover:bg-slate-800',
};
export type BtnVariant = Exclude<keyof typeof btn, 'base'>;
export const btnClass = (v: BtnVariant = 'primary', extra = '') => `${btn.base} ${btn[v]} ${extra}`;

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#FFC400] focus:ring-2 focus:ring-[#FFC400]/30 disabled:bg-slate-50';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">{icon}</div>
      <div className="mt-4 text-base font-semibold text-slate-900">{title}</div>
      <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'error'; children: React.ReactNode }) {
  const t = {
    info: 'bg-sky-50 text-sky-900 ring-sky-200',
    warn: 'bg-amber-50 text-amber-900 ring-amber-200',
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    error: 'bg-red-50 text-red-800 ring-red-200',
  }[tone];
  return <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${t}`}>{children}</div>;
}
