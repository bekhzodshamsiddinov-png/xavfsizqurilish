import React, { useState } from 'react';
import {
  LayoutDashboard, Video, BellRing, TriangleAlert, Users, BarChart3, Camera, Settings,
  Search, Bell, ChevronDown, Menu, OctagonX, Building2, LifeBuoy, X,
} from 'lucide-react';
import { Logo, Modal, Button, useToast } from './ui';

export type PageKey = 'dashboard' | 'live' | 'alerts' | 'zones' | 'workers' | 'reports' | 'cameras' | 'settings';

export const navItems: { key: PageKey; label: string; short: string; icon: React.ElementType; badge?: number }[] = [
  { key: 'dashboard', label: 'Boshqaruv paneli', short: 'Panel', icon: LayoutDashboard },
  { key: 'live', label: 'Jonli kuzatuv', short: 'Jonli', icon: Video },
  { key: 'alerts', label: 'Ogohlantirishlar', short: 'Signal', icon: BellRing, badge: 4 },
  { key: 'zones', label: 'Xavfli zonalar', short: 'Zonalar', icon: TriangleAlert },
  { key: 'workers', label: 'Xodimlar', short: 'Xodimlar', icon: Users },
  { key: 'reports', label: 'Hisobotlar', short: 'Hisobot', icon: BarChart3 },
  { key: 'cameras', label: 'Kameralar', short: 'Kamera', icon: Camera },
  { key: 'settings', label: 'Sozlamalar', short: 'Sozlama', icon: Settings },
];

export function Sidebar({ page, setPage, open, onClose }: { page: PageKey; setPage: (p: PageKey) => void; open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[#14161A] text-slate-300 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <Logo />
          <div className="leading-tight">
            <div className="text-[17px] font-bold tracking-tight text-white">Qurilish Qalqoni</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#FFC400]">AI xavfsizlik</div>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map((n) => {
            const active = page === n.key;
            const Icon = n.icon;
            return (
              <button
                key={n.key}
                onClick={() => { setPage(n.key); onClose(); }}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition ${
                  active ? 'bg-[#FFC400] text-slate-900' : 'hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-slate-900' : 'text-slate-400 group-hover:text-white'}`} />
                {n.label}
                {n.badge && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-slate-900 text-white' : 'bg-red-500 text-white'}`}>{n.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Tizim faol
          </div>
          <p className="mt-1 text-xs text-slate-400">23/24 kamera ishlamoqda · AI kechikishi 180 ms</p>
          <button className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#FFC400] hover:underline">
            <LifeBuoy className="h-3.5 w-3.5" /> Yordam markazi
          </button>
        </div>
      </aside>
    </>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const [stopOpen, setStopOpen] = useState(false);
  const toast = useToast();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Menyu">
        <Menu className="h-5 w-5" />
      </button>
      <button className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200">
        <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="truncate">Yunusobod Residence — 3-blok</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      <div className="relative ml-2 hidden max-w-sm flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Xodim, kamera yoki hodisa qidirish..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#FFC400] focus:ring-2 focus:ring-[#FFC400]/30"
        />
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button variant="danger" className="!px-3 sm:!px-4" onClick={() => setStopOpen(true)}>
          <OctagonX className="h-4 w-4" />
          <span className="hidden sm:inline">Favqulodda to'xtatish</span>
        </Button>
        <button className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100" aria-label="Bildirishnomalar">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>
        <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14161A] text-sm font-bold text-[#FFC400]">BS</div>
          <div className="hidden leading-tight xl:block">
            <div className="text-sm font-semibold text-slate-900">B. Shamsiddinov</div>
            <div className="text-xs text-slate-500">Xavfsizlik nazoratchisi</div>
          </div>
        </div>
      </div>

      <Modal open={stopOpen} onClose={() => setStopOpen(false)}>
        <div className="p-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <OctagonX className="h-7 w-7 text-red-600" />
          </div>
          <h3 className="mt-4 text-center text-lg font-bold text-slate-900">Favqulodda to'xtatish</h3>
          <p className="mt-2 text-center text-sm text-slate-600">
            Butun obyektda sirena yoqiladi, barcha karnaylarda evakuatsiya xabari beriladi va prorablarga Telegram/SMS yuboriladi.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setStopOpen(false)}>Bekor qilish</Button>
            <Button variant="danger" onClick={() => { setStopOpen(false); toast("Favqulodda signal yuborildi — barcha zonalarga"); }}>Tasdiqlash</Button>
          </div>
        </div>
      </Modal>
    </header>
  );
}

export function MobileNav({ page, setPage }: { page: PageKey; setPage: (p: PageKey) => void }) {
  const items = navItems.filter((n) => ['dashboard', 'live', 'alerts', 'zones', 'reports'].includes(n.key));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map((n) => {
        const Icon = n.icon;
        const active = page === n.key;
        return (
          <button key={n.key} onClick={() => setPage(n.key)} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>
            {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#FFC400]" />}
            <Icon className="h-5 w-5" />
            {n.short}
            {n.badge && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-red-500" />}
          </button>
        );
      })}
    </nav>
  );
}
