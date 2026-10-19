import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { getUser } from '@/lib/security/session';
import { Notice } from '@/components/ui';
import { ChangePasswordForm } from '../../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Parolni almashtirish' };

export default async function PasswordPage() {
  const u = await getUser();
  if (!u) redirect('/login');
  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#14161A] text-[#FFC400]"><KeyRound className="h-6 w-6" /></div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Parolni almashtirish</h1>
      {u.mustChangePw && (
        <div className="mt-4"><Notice tone="warn">Administrator sizga vaqtinchalik parol bergan. Davom etish uchun o'zingizning parolingizni o'rnating.</Notice></div>
      )}
      <p className="mt-2 text-sm text-slate-500">Parol almashgach, boshqa qurilmalardagi barcha sessiyalar yopiladi.</p>
      <div className="mt-8"><ChangePasswordForm /></div>
    </div>
  );
}
