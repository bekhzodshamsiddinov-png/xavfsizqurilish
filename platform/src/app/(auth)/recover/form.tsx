'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/client';
import { Field, inputClass } from '@/components/ui';
import { recoverAdmin } from './actions';

export function RecoverForm() {
  const [state, action] = useActionState(recoverAdmin, undefined);
  return (
    <form key={JSON.stringify(state ?? {})} action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Tiklash kodi" hint="Tizim egasiga berilgan bir martalik kod">
        <input name="token" type="text" required autoComplete="off" autoCapitalize="off" spellCheck={false} className={inputClass} />
      </Field>
      <Field label="Administrator emaili">
        <input name="email" type="email" required autoComplete="username" autoCapitalize="off" defaultValue={state?.values?.email} className={inputClass} />
      </Field>
      <Field label="Yangi parol" hint="Kamida 10 belgi, harf va raqam bilan">
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Yangi parolni takrorlang">
        <input name="password2" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <SubmitButton className="w-full !py-3">Parolni yangilash</SubmitButton>
    </form>
  );
}
