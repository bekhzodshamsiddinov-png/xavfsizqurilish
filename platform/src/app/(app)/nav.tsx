'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Video, BellRing, TriangleAlert, Users, BarChart3, Camera, Settings, ScanEye, Menu, X, LogOut,
} from 'lucide-react';
import { Logo } from '@/components/ui';
import { logout } from '../(auth)/actions';

const items = [
  { href: '/', label: 'Boshqaruv paneli', short: 'Panel', icon: LayoutDashboard },
  { href: '/live', label: 'Jonli kuzatuv', short: 'Jonli', icon: Video },
  { href: '/alerts', label: 'Ogohlantirishlar', short: 'Signal', icon: BellRing, badge: true },
  { href: '/zones', label: 'Xavfli zonalar', short: 'Zonalar', icon: TriangleAlert },
  { href: '/detector', label: 'Brauzer detektori', short: 'Detektor', icon: ScanEye },
  { href: '/workers', label: 'Xodimlar', short: 'Xodimlar', icon: Users },
  { href: '/reports', label: 'Hisobotlar', short: 'Hisobot', icon: BarChart3 },
  { href: '/cameras', label: 'Kameralar va qurilmalar', short: 'Kamera', icon: Camera },
  { href: '/settings', label: 'Sozlamalar', short: 'Sozlama', icon: Settings },
];

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function Sidebar({ openAlerts, user, canSettings }: { openAlerts: number; user: { name: string; roleLabel: string }; canSettings: boolean }) {
  const path = usePathname();
  const visible = items.filter((n) => n.href !== '/settings' || canSettings);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed left-3 top-3 z-40 rounded-lg bg-white p-2 text-slate-700 shadow ring-1 ring-slate-200 lg:hidden" aria-label="Menyu">
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#14161A] text-slate-300 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <Logo />
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-tight text-white">Qurilish Qalqoni</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#FFC400]">AI xavfsizlik</div>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto text-slate-400 lg:hidden" aria-label="Yopish"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {visible.map((n) => {
            const active = isActive(path, n.href);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${active ? 'bg-[#FFC400] text-slate-900' : 'hover:bg-white/5 hover:text-white'}`}>
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-slate-900' : 'text-slate-400 group-hover:text-white'}`} />
                {n.label}
                {n.badge && openAlerts > 0 && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-slate-900 text-white' : 'bg-red-500 text-white'}`}>{openAlerts}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">{user.name}</div>
          <div className="text-xs text-slate-400">{user.roleLabel}</div>
          <div className="mt-3 flex gap-2">
            <Link href="/account" className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-white/15">Hisobim</Link>
            <form action={logout}>
              <button className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600" title="Chiqish">
                <LogOut className="h-3.5 w-3.5" /> Chiqish
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileNav({ openAlerts }: { openAlerts: number }) {
  const path = usePathname();
  const pick = items.filter((n) => ['/', '/live', '/alerts', '/zones', '/detector'].includes(n.href));
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {pick.map((n) => {
        const Icon = n.icon;
        const active = isActive(path, n.href);
        return (
          <Link key={n.href} href={n.href} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#FFC400]" />}
            <Icon className="h-5 w-5" />
            {n.short}
            {n.badge && openAlerts > 0 && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-red-500" />}
          </Link>
        );
      })}
    </nav>
  );
}
