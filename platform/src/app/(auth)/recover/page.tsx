import { KeyRound } from 'lucide-react';
import { Notice } from '@/components/ui';
import { RecoverForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parolni tiklash' };

export default function RecoverPage() {
  const enabled = (process.env.ADMIN_RESET_TOKEN ?? '').length >= 24;
  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#14161A] text-[#FFC400]"><KeyRound className="h-6 w-6" /></div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Administrator parolini tiklash</h1>
      <p className="mt-1 text-sm text-slate-500">Favqulodda holat uchun. Kod faqat bir marta ishlaydi.</p>
      <div className="mt-8">{enabled ? <RecoverForm /> : <Notice tone="warn">Parolni tiklash hozir o'chirilgan.</Notice>}</div>
    </div>
  );
}
