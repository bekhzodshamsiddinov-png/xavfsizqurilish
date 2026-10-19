import Link from 'next/link';
import {
  Activity, Clock, Database, FileLock2, Fingerprint, KeyRound, Lock, ScrollText, Send, ShieldAlert, ShieldCheck, Timer, UserX, Users,
} from 'lucide-react';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getTelegramSettings } from '@/lib/alerts';
import { fmtDateTime } from '@/lib/labels';
import { can, roleLabel, ROLES, type Role } from '@/lib/security/rbac';
import { requirePage } from '@/lib/security/session';
import { Card, CardHeader, Notice, PageTitle, btnClass, inputClass } from '@/components/ui';
import { CreateUserForm, DemoForms, TelegramForm, UserActions } from './settings.client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sozlamalar' };

const roleOptions = ROLES.map((r) => ({ value: r, label: roleLabel[r] }));

function Row({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-5 w-5 text-slate-600" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      {children}
    </div>
  );
}

function StatusPill({ ok, on = 'Sozlangan', off = 'Sozlanmagan' }: { ok: boolean; on?: string; off?: string }) {
  return ok
    ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{on}</span>
    : <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{off}</span>;
}

/** LIKE uchun maxsus belgilarni ekranlash (foydalanuvchi `%`/`_` bilan filtrni buzolmaydi). */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

type UserRow = {
  id: string; full_name: string; email: string; role: Role; totp_enabled: boolean; last_login_at: Date | null;
  is_active: boolean; locked_until: Date | null; must_change_pw: boolean;
};
type AuditRow = { id: string; at: Date; action: string; target: string; ip: string | null; full_name: string | null };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage('settings.manage');
  const sp = await searchParams;
  const af = z.string().trim().regex(/^[A-Za-z0-9_.]{1,40}$/).safeParse(sp.audit);
  const auditFilter = af.success ? af.data : '';

  const canUsers = can(user.role, 'user.manage');
  const canAudit = can(user.role, 'audit.view');

  const [users, telegram, auditRows, [{ n: demoCount }]] = await Promise.all([
    canUsers
      ? sql<UserRow[]>`
          SELECT id, full_name, email, role, totp_enabled, last_login_at, is_active, locked_until, must_change_pw
          FROM users ORDER BY is_active DESC, created_at`
      : Promise.resolve([] as UserRow[]),
    getTelegramSettings(),
    canAudit
      ? (auditFilter
          ? sql<AuditRow[]>`
              SELECT a.id, a.at, a.action, a.target, a.ip, u.full_name
              FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
              WHERE a.action LIKE ${escapeLike(auditFilter) + '%'} ESCAPE '\\'
              ORDER BY a.at DESC LIMIT 100`
          : sql<AuditRow[]>`
              SELECT a.id, a.at, a.action, a.target, a.ip, u.full_name
              FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
              ORDER BY a.at DESC LIMIT 100`)
      : Promise.resolve([] as AuditRow[]),
    sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sites WHERE is_demo`,
  ]);

  const env = {
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    encryption: Boolean(process.env.ENCRYPTION_KEY),
    setupToken: Boolean(process.env.SETUP_TOKEN),
  };
  const now = Date.now();

  return (
    <div>
      <PageTitle title="Sozlamalar" subtitle="Foydalanuvchilar, bildirishnomalar, audit va xavfsizlik" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- Foydalanuvchilar ---------- */}
        {canUsers && (
          <Card className="lg:col-span-2">
            <CardHeader title="Foydalanuvchilar" subtitle="Rollar: administrator, nazoratchi, prorab, kuzatuvchi" action={<Users className="h-5 w-5 text-slate-400" />} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5">Foydalanuvchi</th>
                    <th className="px-3 py-2.5">Rol</th>
                    <th className="px-3 py-2.5">2FA</th>
                    <th className="px-3 py-2.5">Oxirgi kirish</th>
                    <th className="px-3 py-2.5">Holat</th>
                    <th className="px-5 py-2.5 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const locked = !!u.locked_until && new Date(u.locked_until).getTime() > now;
                    const self = u.id === user.id;
                    return (
                      <tr key={u.id} className={u.is_active ? '' : 'bg-slate-50/60 text-slate-500'}>
                        <td className="px-5 py-3">
                          <div className="font-semibold text-slate-900">{u.full_name}{self && <span className="ml-2 text-xs font-medium text-slate-400">(siz)</span>}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{roleLabel[u.role]}</td>
                        <td className="px-3 py-3">
                          {u.totp_enabled
                            ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Yoqilgan</span>
                            : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">O&apos;chiq</span>}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{fmtDateTime(u.last_login_at)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.is_active
                              ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Faol</span>
                              : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">Faolsiz</span>}
                            {locked && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700" title={`Blok: ${fmtDateTime(u.locked_until)} gacha`}>Bloklangan · {fmtDateTime(u.locked_until)}</span>}
                            {u.must_change_pw && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Vaqtinchalik parol</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {self
                            ? <Link href="/account" className="text-xs font-semibold text-slate-700 underline decoration-[#FFC400] decoration-2 underline-offset-4">Hisobim</Link>
                            : <UserActions roles={roleOptions} u={{ id: u.id, name: u.full_name, role: u.role, active: u.is_active, locked, totp: u.totp_enabled }} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 p-5">
              <div className="mb-3 text-sm font-semibold text-slate-900">Yangi foydalanuvchi</div>
              <CreateUserForm roles={roleOptions} />
            </div>
          </Card>
        )}

        {/* ---------- Telegram ---------- */}
        <Card>
          <CardHeader title="Telegram bot" subtitle="Signallarni prorablar guruhiga yuborish" action={<StatusPill ok={env.telegram} on="Bot tokeni bor" off="Bot tokeni yo'q" />} />
          <div className="p-5">
            {!env.telegram && (
              <div className="mb-4"><Notice tone="warn">Serverda <code className="font-mono">TELEGRAM_BOT_TOKEN</code> muhit o&apos;zgaruvchisi sozlanmagan — xabarlar yuborilmaydi.</Notice></div>
            )}
            <TelegramForm value={telegram} />
          </div>
        </Card>

        {/* ---------- Xavfsizlik holati ---------- */}
        <Card>
          <CardHeader title="Xavfsizlik holati" subtitle="Platformada faol himoya choralari" action={<ShieldCheck className="h-5 w-5 text-emerald-500" />} />
          <div className="mt-2 divide-y divide-slate-100">
            <Row icon={KeyRound} title="scrypt parol xeshi" desc="Parollar ochiq holda saqlanmaydi (N=32768, tuz bilan)" />
            <Row icon={Fingerprint} title="Ikki bosqichli kirish (TOTP)" desc="Har bir foydalanuvchi 'Hisobim' sahifasida yoqadi" />
            <Row icon={Timer} title="Sessiya muddati" desc="Maksimal 12 soat, 2 soat harakatsizlikdan so'ng avtomatik chiqish" />
            <Row icon={UserX} title="Parol tanlashdan himoya" desc="5 ta xato urinishda hisob 15 daqiqaga bloklanadi" />
            <Row icon={ShieldAlert} title="CSP + HSTS" desc="Begona skriptlar va shifrlanmagan ulanish taqiqlangan, CSRF tekshiruvi" />
            <Row icon={Activity} title="HMAC imzoli qurilma API" desc="Kamera qurilmalari har so'rovni maxfiy kalit bilan imzolaydi" />
            <Row icon={FileLock2} title="AES-256-GCM shifrlash" desc="Qurilma kalitlari va 2FA sirlari bazada shifrlangan">
              <StatusPill ok={env.encryption} on="Kalit bor" off="Kalit yo'q" />
            </Row>
            <Row icon={ScrollText} title="Audit jurnali" desc="Barcha muhim amallar kim, qachon, qayerdan bilan yoziladi" />
            <Row icon={Lock} title="SETUP_TOKEN" desc="Faqat birinchi administratorni yaratish uchun kerak">
              <StatusPill ok={!env.setupToken} on="O'chirilgan" off="Hali bor" />
            </Row>
          </div>
          {env.setupToken && (
            <div className="px-5 pb-5">
              <Notice tone="info">
                Birinchi o&apos;rnatish tugagan — <code className="font-mono">SETUP_TOKEN</code> muhit o&apos;zgaruvchisini serverdan o&apos;chirib tashlash tavsiya etiladi.
                (Tizimda foydalanuvchi bo&apos;lgani uchun qayta o&apos;rnatish baribir imkonsiz.)
              </Notice>
            </div>
          )}
        </Card>

        {/* ---------- Demo ---------- */}
        <Card className="lg:col-span-2">
          <CardHeader title="Demo ma'lumotlar" subtitle="Taqdimot uchun to'liq namunaviy obyekt: kameralar, zonalar, signallar, statistika va xodimlar" action={<Database className="h-5 w-5 text-slate-400" />} />
          <div className="space-y-3 p-5">
            <p className="text-sm text-slate-600">
              &quot;Yunusobod Residence — 3-blok (DEMO)&quot; obyekti yaratiladi: 6 kamera, 5 xavfli zona, so&apos;nggi 7 kunlik ~25 signal va statistika, 10 xodim.
              Demo signallar Telegram&apos;ga yuborilmaydi. Haqiqiy obyektlarga ta&apos;sir qilmaydi.
            </p>
            {demoCount > 0 && <Notice tone="warn">Hozir tizimda {demoCount} ta demo obyekt bor.</Notice>}
            <DemoForms hasDemo={demoCount > 0} />
          </div>
        </Card>

        {/* ---------- Audit jurnali ---------- */}
        {canAudit && (
          <Card className="lg:col-span-2">
            <CardHeader title="Audit jurnali" subtitle="Oxirgi 100 ta yozuv" action={<Clock className="h-5 w-5 text-slate-400" />} />
            <form method="get" className="flex flex-wrap items-center gap-2 px-5 pt-4">
              <input name="audit" defaultValue={auditFilter} maxLength={40} pattern="[A-Za-z0-9_.]{1,40}" placeholder="Amal prefiksi, masalan: login yoki user."
                className={`${inputClass} max-w-xs !py-2`} />
              <button className={btnClass('secondary', '!py-2')}>Filtrlash</button>
              {auditFilter && <Link href="/settings" className={btnClass('ghost', '!py-2')}>Tozalash</Link>}
              <div className="flex flex-wrap gap-1.5">
                {['login', 'mfa', 'user', 'settings', 'demo', 'session', 'password'].map((p) => (
                  <Link key={p} href={`/settings?audit=${p}#audit`}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${auditFilter === p ? 'bg-[#FFC400] text-slate-900 ring-[#FFC400]' : 'text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
                    {p}
                  </Link>
                ))}
              </div>
            </form>
            <div id="audit" className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5">Vaqt</th>
                    <th className="px-3 py-2.5">Foydalanuvchi</th>
                    <th className="px-3 py-2.5">Amal</th>
                    <th className="px-3 py-2.5">Obyekt</th>
                    <th className="px-5 py-2.5">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditRows.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs text-slate-600">{fmtDateTime(a.at)}</td>
                      <td className="px-3 py-2.5 text-slate-800">{a.full_name ?? <span className="text-slate-400">Tizim</span>}</td>
                      <td className="px-3 py-2.5"><code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">{a.action}</code></td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 font-mono text-xs text-slate-500" title={a.target}>{a.target || '—'}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500">{a.ip ?? '—'}</td>
                    </tr>
                  ))}
                  {!auditRows.length && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">Yozuvlar topilmadi.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400"><Send className="h-3.5 w-3.5" /> Shaxsiy Telegram chat ID va 2FA — <Link href="/account" className="underline">Hisobim</Link> sahifasida.</p>
    </div>
  );
}
