import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql, isDbConfigured } from '@/lib/db';
import { getUser } from '@/lib/security/session';
import { Notice } from '@/components/ui';
import { LoginForm } from '../forms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kirish' };

export default async function LoginPage() {
  if (!isDbConfigured()) {
    return <Notice tone="warn">Ma'lumotlar bazasi hali ulanmagan. Administrator Vercel'da Neon bazasini ulashi kerak.</Notice>;
  }
  if (await getUser()) redirect('/');
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM users`;
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tizimga kirish</h1>
      <p className="mt-1 text-sm text-slate-500">Xavfsizlik paneliga kirish uchun hisob ma'lumotlaringizni kiriting.</p>
      <div className="mt-8">
        {n === 0 ? (
          <Notice tone="info">
            Tizim hali o'rnatilmagan. <Link href="/setup" className="font-semibold underline">Birinchi administratorni yarating →</Link>
          </Notice>
        ) : (
          <LoginForm />
        )}
      </div>
      <p className="mt-8 text-center text-xs text-slate-400">5 marta noto'g'ri urinishdan so'ng hisob 15 daqiqaga bloklanadi.</p>
    </div>
  );
}
