'use client';

import { useActionState, useState } from 'react';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { FormMessage, SubmitButton } from '@/components/client';
import { Field, inputClass, type BtnVariant } from '@/components/ui';
import {
  createCamera, createDevice, createSite, deleteSite, rotateDeviceSecret,
  type DeviceKeyState, type FormState,
} from './actions';

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

/**
 * Umumiy forma: server amali + natija xabari. `confirmText` berilsa, yuborishdan oldin tasdiq so'raladi.
 * Yashirin maydonlar `hidden` orqali beriladi.
 */
export function ActionForm({
  action, hidden = {}, children, confirmText, submitLabel, variant = 'primary', className = '', buttonClass = '', inline = false,
}: {
  action: Action;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  confirmText?: string;
  submitLabel: React.ReactNode;
  variant?: BtnVariant;
  className?: string;
  buttonClass?: string;
  inline?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}
      className={inline ? `inline-flex flex-col gap-2 ${className}` : `space-y-3 ${className}`}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <SubmitButton variant={variant} className={buttonClass}>{submitLabel}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/* ---------------- Obyektlar ---------------- */

export function SiteFields({ name = '', address = '', floors = 1 }: { name?: string; address?: string; floors?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
      <Field label="Obyekt nomi">
        <input name="name" required minLength={3} maxLength={100} defaultValue={name} className={inputClass} placeholder="Masalan: Yunusobod Residence, 3-blok" />
      </Field>
      <Field label="Manzil">
        <input name="address" maxLength={200} defaultValue={address} className={inputClass} placeholder="Shahar, ko'cha, uy" />
      </Field>
      <Field label="Qavatlar">
        <input name="floors" type="number" required min={1} max={200} defaultValue={floors} className={inputClass} />
      </Field>
    </div>
  );
}

export function CreateSiteForm() {
  return (
    <ActionForm action={createSite} submitLabel="Obyekt yaratish">
      <SiteFields />
    </ActionForm>
  );
}

export function DeleteSiteForm({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [state, formAction] = useActionState(deleteSite, undefined);
  const [typed, setTyped] = useState('');
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
      <input type="hidden" name="siteId" value={siteId} />
      <div className="flex gap-2 text-sm text-red-800">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Obyekt o&apos;chirilsa, unga tegishli <b>barcha kameralar, xavfli zonalar, qurilmalar, ogohlantirishlar, kadrlar,
          statistika va xodimlar</b> ham butunlay o&apos;chib ketadi. Bu amalni qaytarib bo&apos;lmaydi.
        </p>
      </div>
      <Field label={`Tasdiqlash uchun obyekt nomini yozing: ${siteName}`}>
        <input name="confirmName" value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={100} autoComplete="off" className={inputClass} />
      </Field>
      <button type="submit" disabled={typed.trim() !== siteName}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
        Obyektni butunlay o&apos;chirish
      </button>
      <FormMessage state={state} />
    </form>
  );
}

/* ---------------- Kameralar ---------------- */

export function CameraFields({ code = '', name = '', floor = '' }: { code?: string; name?: string; floor?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr]">
      <Field label="Kod" hint="Qurilma config'idagi kod bilan bir xil">
        <input name="code" required pattern="[A-Za-z0-9_\-]{1,40}" maxLength={40} defaultValue={code} className={`${inputClass} font-mono`} placeholder="CAM-01" />
      </Field>
      <Field label="Nomi">
        <input name="name" required maxLength={100} defaultValue={name} className={inputClass} placeholder="Lift shaxtasi, 5-qavat" />
      </Field>
      <Field label="Qavat">
        <input name="floor" maxLength={40} defaultValue={floor} className={inputClass} placeholder="5-qavat" />
      </Field>
    </div>
  );
}

export function CreateCameraForm() {
  return (
    <ActionForm action={createCamera} submitLabel="Kamera qo'shish">
      <CameraFields />
    </ActionForm>
  );
}

/* ---------------- Qurilmalar: maxfiy kalit faqat bir marta ---------------- */

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard ruxsat berilmagan */ }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
    >
      {copied ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Nusxalandi</> : <><Copy className="h-3.5 w-3.5" /> Nusxalash</>}
    </button>
  );
}

function SecretPanel({ state, onClose }: { state: NonNullable<DeviceKeyState>; onClose: () => void }) {
  if (!state.keyId || !state.secret) return null;
  const config = `QQ_KEY_ID=${state.keyId}\nQQ_SECRET=${state.secret}`;
  return (
    <div className="space-y-3 rounded-xl bg-[#FFF8DB] p-4 ring-2 ring-[#FFC400]">
      <div className="flex items-start gap-2 text-sm font-semibold text-slate-900">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{state.deviceName ? `${state.deviceName} — ` : ''}Bu kalit faqat hozir ko&apos;rsatiladi. Uni qurilmaning config faylida saqlang.</span>
      </div>
      {[['Kalit ID (X-QQ-Key)', state.keyId], ['Maxfiy kalit (secret)', state.secret]].map(([label, v]) => (
        <div key={label}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-900 ring-1 ring-slate-200">{v}</code>
            <CopyButton value={v} />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton value={config} />
        <span className="text-xs text-slate-600">ikkalasini .env formatida nusxalash</span>
        <button type="button" onClick={onClose} className="ml-auto text-xs font-semibold text-slate-700 underline underline-offset-4">Saqladim, yopish</button>
      </div>
    </div>
  );
}

export function CreateDeviceForm() {
  const [state, formAction] = useActionState(createDevice, undefined);
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const show = state?.secret && hiddenFor !== state.secret;
  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Yangi qurilma nomi">
            <input name="name" required minLength={2} maxLength={80} className={inputClass} placeholder="Jetson Orin — 1-blok" />
          </Field>
        </div>
        <SubmitButton>Qurilma qo&apos;shish</SubmitButton>
      </form>
      {state?.error && <FormMessage state={{ error: state.error }} />}
      {show && state && <SecretPanel state={state} onClose={() => setHiddenFor(state.secret ?? null)} />}
    </div>
  );
}

export function RotateSecretForm({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  const [state, formAction] = useActionState(rotateDeviceSecret, undefined);
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const show = state?.secret && hiddenFor !== state.secret;
  return (
    <div className="space-y-2">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!window.confirm(`"${deviceName}" uchun yangi maxfiy kalit yaratilsinmi? Eski kalit darhol ishlamay qoladi va qurilma config'ini yangilash kerak bo'ladi.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="deviceId" value={deviceId} />
        <SubmitButton variant="secondary" className="!px-3 !py-1.5 !text-xs">Kalitni yangilash</SubmitButton>
      </form>
      {state?.error && <FormMessage state={{ error: state.error }} />}
      {show && state && <SecretPanel state={state} onClose={() => setHiddenFor(state.secret ?? null)} />}
    </div>
  );
}
