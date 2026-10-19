import React, { useEffect, useState } from 'react';
import { Sidebar, Topbar, MobileNav, type PageKey } from './components/layout';
import { ToastProvider } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { LiveView } from './pages/LiveView';
import { Alerts } from './pages/Alerts';
import { Zones } from './pages/Zones';
import { Workers, Reports, Cameras, SettingsPage } from './pages/Others';

export function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F6F7F9] font-sans text-slate-900 antialiased">
        <Sidebar page={page} setPage={setPage} open={menu} onClose={() => setMenu(false)} />
        <div className="lg:pl-[264px]">
          <Topbar onMenu={() => setMenu(true)} />
          <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
            {page === 'dashboard' && <Dashboard go={setPage} />}
            {page === 'live' && <LiveView />}
            {page === 'alerts' && <Alerts />}
            {page === 'zones' && <Zones />}
            {page === 'workers' && <Workers />}
            {page === 'reports' && <Reports />}
            {page === 'cameras' && <Cameras />}
            {page === 'settings' && <SettingsPage />}
          </main>
        </div>
        <MobileNav page={page} setPage={setPage} />
      </div>
    </ToastProvider>
  );
}
