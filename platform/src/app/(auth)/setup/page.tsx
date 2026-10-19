import { redirect } from 'next/navigation';
import { sql, isDbConfigured } from '@/lib/db';
import { Notice } from '@/components/ui';
import { SetupForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: "O'rnatish" };

export default async function SetupPage() {
  if (!isDbConfigured()) return <Notice tone="warn">Ma'lumotlar bazasi ulanmagan.</Notice>;
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  if (n > 0) redirect('/login');
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tizimni o'rnatish</h1>
      <p className="mt-1 text-sm text-slate-500">
        Birinchi administrator hisobini yarating. Bu sahifa faqat bir marta ishlaydi va maxfiy o'rnatish kodini talab qiladi.
      </p>
      <div className="mt-8"><SetupForm /></div>
    </div>
  );
}
