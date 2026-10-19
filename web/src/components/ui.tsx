import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

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

export function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children, variant = 'primary', className = '', ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-[#FFC400] text-slate-900 hover:bg-[#FFD02E] shadow-sm',
    secondary: 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFC400] disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

export const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.visibility = 'hidden'; };

export function timeAgo(min: number) {
  if (min < 1) return 'hozirgina';
  if (min < 60) return `${min} daqiqa oldin`;
  return `${Math.floor(min / 60)} soat oldin`;
}

/* ---------- Toast ---------- */
type ToastCtx = (msg: string) => void;
const Ctx = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[80] flex flex-col gap-2 lg:bottom-6">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-[#14161A] px-4 py-3 text-sm text-white shadow-2xl">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{t.msg}</span>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="ml-2 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={`max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${wide ? 'max-w-6xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
