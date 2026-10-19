'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/client';
import { Field, inputClass } from '@/components/ui';
import {
  cancelTotp, confirmTotp, disableTotp, revokeOtherSessions, revokeSession, saveTelegramChat, startTotp,
} from './actions';

const codeInput = `${inputClass} text-center font-mono text-xl tracking-[0.4em]`;

export function StartTotpForm() {
  const [state, action] = useActionState(startTotp, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton pendingText="Tayyorlanmoqda...">2FA ni yoqish</SubmitButton>
    </form>
  );
}

export function ConfirmTotpForm() {
  const [state, action] = useActionState(confirmTotp, undefined);
  const [cState, cAction] = useActionState(cancelTotp, undefined);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <FormMessage state={state} />
        <Field label="Ilovadagi 6 xonali kod">
          <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code"
            className={codeInput} placeholder="000000" />
        </Field>
        <SubmitButton className="w-full">Tasdiqlash va yoqish</SubmitButton>
      </form>
      <form action={cAction}>
        <FormMessage state={cState} />
        <SubmitButton variant="ghost" className="w-full">Bekor qilish</SubmitButton>
      </form>
    </div>
  );
}

export function DisableTotpForm() {
  const [state, action] = useActionState(disableTotp, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Joriy parol">
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </Field>
        <Field label="Ilovadagi kod">
          <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code"
            className={codeInput} placeholder="000000" />
        </Field>
      </div>
      <SubmitButton variant="danger">2FA ni o'chirish</SubmitButton>
    </form>
  );
}

export function RevokeSessionButton({ sid }: { sid: string }) {
  const [state, action] = useActionState(revokeSession, undefined);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="sid" value={sid} />
      <SubmitButton variant="secondary" className="!px-3 !py-1.5 text-xs">Yopish</SubmitButton>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function RevokeOthersForm() {
  const [state, action] = useActionState(revokeOtherSessions, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Boshqa barcha sessiyalardan chiqish</SubmitButton>
    </form>
  );
}

export function TelegramChatForm({ value }: { value: string }) {
  const [state, action] = useActionState(saveTelegramChat, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Shaxsiy Telegram chat ID" hint="Botga /start yozing va chat ID ni shu yerga kiriting. Bo'sh qoldirsangiz — o'chiriladi.">
        <input name="chatId" defaultValue={value} inputMode="numeric" maxLength={21} pattern="-?\d{5,20}" className={inputClass} placeholder="123456789" />
      </Field>
      <SubmitButton>Saqlash</SubmitButton>
    </form>
  );
}
