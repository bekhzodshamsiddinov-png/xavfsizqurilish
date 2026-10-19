'use client';

import { useActionState, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { FormMessage, SubmitButton, Toggle } from '@/components/client';
import { Field, inputClass } from '@/components/ui';
import {
  changeRole, createDemo, createUser, removeDemo, resetPassword, resetTotp, saveTelegram, setActive, testTelegram, unlockUser,
  type FormState,
} from './actions';

type Opt = { value: string; label: string };

/** Vaqtinchalik parol — faqat shu javobda, bir marta ko'rsatiladi. */
function SecretOnce({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-[#14161A] p-4 text-white">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#FFC400]">Vaqtinchalik parol — faqat bir marta ko&apos;rsatiladi</div>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 select-all break-all font-mono text-lg">{secret}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(secret).then(() => setCopied(true)).catch(() => {})}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
          {copied ? <><Check className="h-3.5 w-3.5" /> Nusxalandi</> : <><Copy className="h-3.5 w-3.5" /> Nusxalash</>}
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-400">Foydalanuvchi birinchi kirishda o&apos;z parolini o&apos;rnatadi.</div>
    </div>
  );
}

function Result({ state }: { state: FormState }) {
  return (
    <>
      <FormMessage state={state} />
      {state?.secret && <SecretOnce secret={state.secret} />}
    </>
  );
}

export function CreateUserForm({ roles }: { roles: Opt[] }) {
  const [state, action] = useActionState(createUser, undefined);
  return (
    <form action={action} className="space-y-3">
      <Result state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="To'liq ism"><input name="fullName" required minLength={3} maxLength={100} className={inputClass} /></Field>
        <Field label="Email"><input name="email" type="email" required maxLength={254} autoComplete="off" className={inputClass} /></Field>
        <Field label="Rol">
          <select name="role" defaultValue="kuzatuvchi" className={inputClass}>
            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
      </div>
      <SubmitButton>Foydalanuvchi qo&apos;shish</SubmitButton>
    </form>
  );
}

function MiniAction({ action, userId, label, variant = 'secondary', extra, confirmText }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; userId: string; label: string;
  variant?: 'secondary' | 'danger' | 'ghost'; extra?: Record<string, string>; confirmText?: string;
}) {
  const [state, run] = useActionState(action, undefined);
  return (
    <form action={run} className="space-y-2"
      onSubmit={confirmText ? (e) => { if (!window.confirm(confirmText)) e.preventDefault(); } : undefined}>
      <input type="hidden" name="userId" value={userId} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} className="w-full !px-3 !py-1.5 text-xs">{label}</SubmitButton>
      <Result state={state} />
    </form>
  );
}

function RoleForm({ userId, role, roles }: { userId: string; role: string; roles: Opt[] }) {
  const [state, run] = useActionState(changeRole, undefined);
  return (
    <form action={run} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <select name="role" defaultValue={role} className={`${inputClass} !py-1.5 text-xs`}>
          {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <SubmitButton variant="secondary" className="shrink-0 !px-3 !py-1.5 text-xs">Saqlash</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function UserActions({ u, roles }: {
  u: { id: string; name: string; role: string; active: boolean; locked: boolean; totp: boolean }; roles: Opt[];
}) {
  return (
    <details className="group relative">
      <summary className="cursor-pointer list-none rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
        Boshqarish
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 space-y-3 rounded-xl bg-white p-3 text-left shadow-xl ring-1 ring-slate-200">
        <div className="text-xs font-semibold text-slate-500">Rol</div>
        <RoleForm userId={u.id} role={u.role} roles={roles} />
        <div className="border-t border-slate-100" />
        <MiniAction action={resetPassword} userId={u.id} label="Parolni tiklash (vaqtinchalik parol)"
          confirmText={`${u.name} uchun yangi vaqtinchalik parol yaratilsinmi? Uning barcha sessiyalari yopiladi.`} />
        {u.locked && <MiniAction action={unlockUser} userId={u.id} label="Blokdan chiqarish" />}
        {u.totp && <MiniAction action={resetTotp} userId={u.id} label="2FA ni tiklash"
          confirmText={`${u.name} uchun 2FA o'chirilsinmi?`} />}
        {u.active
          ? <MiniAction action={setActive} userId={u.id} extra={{ active: '0' }} variant="danger" label="Faolsizlantirish"
              confirmText={`${u.name} faolsizlantirilsinmi? U tizimga kira olmaydi.`} />
          : <MiniAction action={setActive} userId={u.id} extra={{ active: '1' }} label="Faollashtirish" />}
      </div>
    </details>
  );
}

export function TelegramForm({ value }: { value: { enabled: boolean; chatId: string; escalationChatId: string } }) {
  const [state, action] = useActionState(saveTelegram, undefined);
  const [tState, tAction] = useActionState(testTelegram, undefined);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Telegram xabarnomalari</div>
            <div className="text-xs text-slate-500">Kritik va yuqori darajali signallar guruhga yuboriladi</div>
          </div>
          <Toggle name="enabled" defaultChecked={value.enabled} label="Telegram xabarnomalari" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Guruh chat ID" hint="Prorab va nazoratchilar guruhi">
            <input name="chatId" defaultValue={value.chatId} maxLength={21} pattern="-?\d{5,20}" className={inputClass} placeholder="-1001234567890" />
          </Field>
          <Field label="Eskalatsiya chat ID" hint="2 daqiqada javob bo'lmasa (bo'sh — guruhning o'zi)">
            <input name="escalationChatId" defaultValue={value.escalationChatId} maxLength={21} pattern="-?\d{5,20}" className={inputClass} placeholder="-1009876543210" />
          </Field>
        </div>
        <SubmitButton>Saqlash</SubmitButton>
      </form>
      <form action={tAction} className="space-y-2 border-t border-slate-100 pt-4">
        <FormMessage state={tState} />
        <SubmitButton variant="secondary" pendingText="Yuborilmoqda...">Sinov xabari yuborish</SubmitButton>
      </form>
    </div>
  );
}

export function DemoForms({ hasDemo }: { hasDemo: boolean }) {
  const [cState, cAction] = useActionState(createDemo, undefined);
  const [dState, dAction] = useActionState(removeDemo, undefined);
  return (
    <div className="space-y-3">
      <FormMessage state={cState} />
      <FormMessage state={dState} />
      <div className="flex flex-wrap gap-2">
        <form action={cAction}><SubmitButton variant="dark" pendingText="Yaratilmoqda...">Demo obyekt yaratish</SubmitButton></form>
        {hasDemo && (
          <form action={dAction} onSubmit={(e) => { if (!window.confirm("Barcha demo obyektlar va ularning ma'lumotlari o'chirilsinmi?")) e.preventDefault(); }}>
            <SubmitButton variant="danger" pendingText="O'chirilmoqda...">Demo ma&apos;lumotlarni o&apos;chirish</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
