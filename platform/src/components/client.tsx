'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { btnClass, type BtnVariant } from './ui';

export function SubmitButton({ children, variant = 'primary', className = '', pendingText }: {
  children: React.ReactNode; variant?: BtnVariant; className?: string; pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btnClass(variant, className)}>
      {pending ? <><Loader2 className="h-4 w-4 animate-spin" />{pendingText ?? 'Kuting...'}</> : children}
    </button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: string } }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <div role="alert" className={`rounded-xl px-4 py-3 text-sm ring-1 ${state.error ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200'}`}>
      {state.error ?? state.ok}
    </div>
  );
}

export function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: string }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center" aria-label={label}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-[#FFC400]" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all peer-checked:left-[22px]" />
    </label>
  );
}
