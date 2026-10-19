'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/client';
import { Field, inputClass, type BtnVariant } from '@/components/ui';
import { createWorker, updateWorker, type FormState } from './actions';

type Action = (s: FormState, fd: FormData) => Promise<FormState>;

export interface WorkerFormValues {
  id: string; full_name: string; trade: string; brigade: string; badge_code: string | null; phone: string; training_valid_until: string | null;
}

function WorkerFields({ w }: { w?: WorkerFormValues }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="F.I.Sh.">
        <input name="full_name" required minLength={3} maxLength={100} defaultValue={w?.full_name} className={inputClass} placeholder="Aliyev Vali" />
      </Field>
      <Field label="Kasbi">
        <input name="trade" maxLength={60} defaultValue={w?.trade} className={inputClass} placeholder="Payvandchi" />
      </Field>
      <Field label="Brigada">
        <input name="brigade" maxLength={60} defaultValue={w?.brigade} className={inputClass} placeholder="2-brigada (Metall)" />
      </Field>
      <Field label="Beyj kodi" hint="Ixtiyoriy · QR-beyj yoki turniket kartasi">
        <input name="badge_code" pattern="[A-Za-z0-9\-]{3,40}" maxLength={40} defaultValue={w?.badge_code ?? ''} className={`${inputClass} font-mono`} placeholder="QQ-0001" />
      </Field>
      <Field label="Telefon" hint="Ixtiyoriy">
        <input name="phone" type="tel" pattern="\+?[0-9 \(\)\-]{7,20}" maxLength={20} defaultValue={w?.phone} className={inputClass} placeholder="+998 90 123 45 67" />
      </Field>
      <Field label="Yo'riqnoma amal qilish muddati" hint="Ixtiyoriy · xavfsizlik yo'riqnomasi qachongacha amal qiladi">
        <input name="training_valid_until" type="date" min="2000-01-01" max="2100-12-31" defaultValue={w?.training_valid_until ?? ''} className={inputClass} />
      </Field>
    </div>
  );
}

export function CreateWorkerForm() {
  const [state, action] = useActionState(createWorker, undefined);
  return (
    <form action={action} className="space-y-3">
      <WorkerFields />
      <SubmitButton>Xodimni qo&apos;shish</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function EditWorkerForm({ w }: { w: WorkerFormValues }) {
  const [state, action] = useActionState(updateWorker, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="workerId" value={w.id} />
      <WorkerFields w={w} />
      <SubmitButton>Saqlash</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function SmallActionForm({ action, hidden, label, variant = 'secondary', confirmText }: {
  action: Action; hidden: Record<string, string>; label: string; variant?: BtnVariant; confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}
      className="inline-flex flex-col gap-2"
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} className="!px-3 !py-1.5 !text-xs">{label}</SubmitButton>
      {state?.error && <FormMessage state={{ error: state.error }} />}
    </form>
  );
}
