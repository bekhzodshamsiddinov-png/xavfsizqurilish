'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/client';
import { Field, inputClass } from '@/components/ui';
import { changePassword, login, setupAdmin, verifyMfa } from './actions';

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form key={JSON.stringify(state ?? {})} action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email">
        <input name="email" type="email" required autoComplete="username" defaultValue={state?.values?.email} className={inputClass} placeholder="siz@kompaniya.uz" />
      </Field>
      <Field label="Parol">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <SubmitButton className="w-full !py-3" pendingText="Tekshirilmoqda...">Kirish</SubmitButton>
    </form>
  );
}

export function MfaForm() {
  const [state, action] = useActionState(verifyMfa, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="6 xonali kod" hint="Google Authenticator yoki shunga o'xshash ilovadagi kod">
        <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus autoComplete="one-time-code"
          className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`} placeholder="000000" />
      </Field>
      <SubmitButton className="w-full !py-3">Tasdiqlash</SubmitButton>
    </form>
  );
}

export function SetupForm() {
  const [state, action] = useActionState(setupAdmin, undefined);
  return (
    <form key={JSON.stringify(state ?? {})} action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="O'rnatish kodi" hint="Tizim egasiga berilgan bir martalik kod">
        <input name="token" type="password" required autoComplete="off" className={inputClass} />
      </Field>
      <Field label="To'liq ism">
        <input name="fullName" required autoComplete="name" defaultValue={state?.values?.fullName} className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required autoComplete="username" defaultValue={state?.values?.email} className={inputClass} />
      </Field>
      <Field label="Parol" hint="Kamida 10 belgi, harf va raqam bilan">
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Parolni takrorlang">
        <input name="password2" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <SubmitButton className="w-full !py-3">Administratorni yaratish</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Joriy parol">
        <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <Field label="Yangi parol" hint="Kamida 10 belgi, harf va raqam bilan">
        <input name="next" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Yangi parolni takrorlang">
        <input name="next2" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <SubmitButton className="w-full !py-3">Parolni saqlash</SubmitButton>
    </form>
  );
}
