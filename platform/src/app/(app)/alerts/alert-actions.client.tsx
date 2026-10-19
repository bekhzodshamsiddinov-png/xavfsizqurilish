'use client';

import { useActionState } from 'react';
import { CheckCircle2, UserCheck, ThumbsDown, RotateCcw } from 'lucide-react';
import { FormMessage, SubmitButton } from '@/components/client';
import { inputClass } from '@/components/ui';
import { handleAlert } from './actions';

export function AlertActions({ id, status, canHandle, canReopen }: { id: string; status: string; canHandle: boolean; canReopen: boolean }) {
  const [state, action] = useActionState(handleAlert, undefined);
  if (!canHandle) return <p className="text-sm text-slate-500">Signalni boshqarish uchun prorab yoki undan yuqori huquq kerak.</p>;
  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      {status !== 'hal' ? (
        <>
          {status === 'yangi' && (
            <form action={action}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="op" value="take" />
              <SubmitButton variant="secondary" className="w-full"><UserCheck className="h-4 w-4" /> Men olaman</SubmitButton>
            </form>
          )}
          <form action={action} className="space-y-2">
            <input type="hidden" name="id" value={id} />
            <textarea name="notes" maxLength={500} rows={2} placeholder="Qanday choralar ko'rildi? (ixtiyoriy)" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <SubmitOp op="resolve"><CheckCircle2 className="h-4 w-4" /> Hal qilindi</SubmitOp>
              <SubmitOp op="false_positive" variant="secondary"><ThumbsDown className="h-4 w-4" /> Yolg'on signal</SubmitOp>
            </div>
          </form>
          <p className="text-center text-[11px] text-slate-400">"Yolg'on signal" belgilari AI modelini qayta o'qitishda ishlatiladi.</p>
        </>
      ) : canReopen ? (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value="reopen" />
          <SubmitButton variant="secondary" className="w-full"><RotateCcw className="h-4 w-4" /> Qayta ochish</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

function SubmitOp({ op, variant = 'primary', children }: { op: string; variant?: 'primary' | 'secondary'; children: React.ReactNode }) {
  const cls = variant === 'primary'
    ? 'bg-[#FFC400] text-slate-900 hover:bg-[#FFD02E]'
    : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50';
  return (
    <button type="submit" name="op" value={op} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${cls}`}>
      {children}
    </button>
  );
}
