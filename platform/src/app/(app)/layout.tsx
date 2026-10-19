import Link from 'next/link';
import { Building2, ChevronDown, Plus } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can, roleLabel } from '@/lib/security/rbac';
import { currentSite, listSites } from '@/lib/site';
import { runEscalations } from '@/lib/alerts';
import { Sidebar, MobileNav } from './nav';
import { selectSite } from './shell-actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage('view');
  const [sites, site] = await Promise.all([listSites(), currentSite()]);
  await runEscalations().catch(() => {});
  const [{ n: openAlerts }] = site
    ? await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM alerts WHERE site_id = ${site.id} AND status = 'yangi'`
    : [{ n: 0 }];

  return (
    <div className="min-h-screen">
      <Sidebar openAlerts={openAlerts} user={{ name: user.fullName, roleLabel: roleLabel[user.role] }} canSettings={can(user.role, 'settings.manage')} />
      <div className="lg:pl-[264px]">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 pl-16 pr-4 backdrop-blur sm:pr-6 lg:pl-6">
          {sites.length > 0 ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200">
                <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                <span className="max-w-[45vw] truncate">{site?.name}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
              </summary>
              <div className="absolute left-0 top-12 z-50 w-72 rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-slate-200">
                {sites.map((s) => (
                  <form key={s.id} action={selectSite}>
                    <input type="hidden" name="siteId" value={s.id} />
                    <button className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 ${s.id === site?.id ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {s.name}{s.is_demo && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}
                    </button>
                  </form>
                ))}
                {can(user.role, 'camera.edit') && (
                  <Link href="/cameras#obyekt" className="mt-1 flex items-center gap-2 rounded-lg border-t border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Plus className="h-4 w-4" /> Yangi obyekt
                  </Link>
                )}
              </div>
            </details>
          ) : (
            <span className="text-sm font-semibold text-slate-500">Obyekt qo'shilmagan</span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {site?.is_demo && <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 sm:inline">Demo ma'lumotlar</span>}
            <Link href="/alerts?status=yangi" className="relative rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Yangi signallar: <span className={openAlerts ? 'text-red-600' : 'text-emerald-600'}>{openAlerts}</span>
            </Link>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#14161A] text-sm font-bold text-[#FFC400] sm:flex">
              {user.fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <MobileNav openAlerts={openAlerts} />
    </div>
  );
}
