import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getPendingMfaUserId } from '@/lib/security/session';
import { MfaForm } from '../../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ikki bosqichli tasdiqlash' };

export default async function MfaPage() {
  if (!(await getPendingMfaUserId())) redirect('/login');
  return (
    <div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#14161A] text-[#FFC400]"><ShieldCheck className="h-6 w-6" /></div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Ikki bosqichli tasdiqlash</h1>
      <p className="mt-1 text-sm text-slate-500">Autentifikator ilovangizdagi 6 xonali kodni kiriting. Kod 5 daqiqa ichida kiritilishi kerak.</p>
      <div className="mt-8"><MfaForm /></div>
    </div>
  );
}
