import Link from 'next/link';
import QRCode from 'qrcode';
import { KeyRound, Laptop, Lock, Mail, Send, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import { sql } from '@/lib/db';
import { decrypt, sha256 } from '@/lib/security/crypto';
import { roleLabel } from '@/lib/security/rbac';
import { requirePage } from '@/lib/security/session';
import { totpUri } from '@/lib/security/totp';
import { fmtDateTime, timeAgo } from '@/lib/labels';
import { Card, CardHeader, Notice, PageTitle, btnClass } from '@/components/ui';
import {
  ConfirmTotpForm, DisableTotpForm, RevokeOthersForm, RevokeSessionButton, StartTotpForm, TelegramChatForm,
} from './account.client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hisobim' };

/** User-Agent'dan qisqa, o'qiladigan nom: "Chrome · Windows". */
function shortUa(ua: string | null) {
  if (!ua) return "Noma'lum qurilma";
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /YaBrowser/.test(ua) ? 'Yandex' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' : 'Brauzer';
  const os =
    /Android/.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

const isMobile = (ua: string | null) => !!ua && /Android|iPhone|iPad|Mobile/.test(ua);

function Row({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Icon className="h-5 w-5 text-slate-600" /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="truncate text-xs text-slate-500">{desc}</div>
      </div>
      {children}
    </div>
  );
}

export default async function AccountPage() {
  const user = await requirePage('view');

  const [[u], sessions] = await Promise.all([
    sql<{ totp_secret_enc: string | null; totp_enabled: boolean; telegram_chat_id: string | null; last_login_at: Date | null; password_changed_at: Date; created_at: Date }[]>`
      SELECT totp_secret_enc, totp_enabled, telegram_chat_id, last_login_at, password_changed_at, created_at
      FROM users WHERE id = ${user.id}`,
    sql<{ token_hash: string; created_at: Date; last_seen_at: Date; ip: string | null; user_agent: string | null }[]>`
      SELECT token_hash, created_at, last_seen_at, ip, user_agent FROM sessions
      WHERE user_id = ${user.id} AND NOT mfa_pending AND expires_at > now()
      ORDER BY last_seen_at DESC LIMIT 50`,
  ]);

  // 2FA sozlash jarayoni: sir yaratilgan, lekin hali tasdiqlanmagan.
  let setup: { qr: string; groups: string } | null = null;
  let setupError = false;
  if (u && !u.totp_enabled && u.totp_secret_enc) {
    try {
      const secret = decrypt(u.totp_secret_enc);
      const qr = await QRCode.toDataURL(totpUri(secret, user.email), { margin: 1, width: 220, errorCorrectionLevel: 'M' });
      setup = { qr, groups: secret.match(/.{1,4}/g)?.join(' ') ?? secret };
    } catch {
      setupError = true;
    }
  }

  const initials = user.fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <PageTitle title="Hisobim" subtitle="Profil, ikki bosqichli kirish va faol sessiyalar" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profil */}
        <Card>
          <div className="flex items-center gap-4 px-5 pt-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#14161A] text-lg font-bold text-[#FFC400]">{initials}</div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-slate-900">{user.fullName}</div>
              <span className="mt-1 inline-block rounded-full bg-[#FFC400]/15 px-2.5 py-0.5 text-xs font-semibold text-slate-800">{roleLabel[user.role]}</span>
            </div>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            <Row icon={Mail} title="Email" desc={user.email} />
            <Row icon={UserRound} title="Oxirgi kirish" desc={fmtDateTime(u?.last_login_at ?? null)} />
            <Row icon={KeyRound} title="Parol" desc={`Oxirgi marta almashtirilgan: ${fmtDateTime(u?.password_changed_at ?? null)}`}>
              <Link href="/account/password" className={btnClass('secondary', '!px-3 !py-1.5 text-xs')}>Parolni almashtirish</Link>
            </Row>
          </div>
        </Card>

        {/* 2FA */}
        <Card>
          <CardHeader
            title="Ikki bosqichli kirish (2FA)"
            subtitle="Google Authenticator, Microsoft Authenticator yoki shunga o'xshash ilova orqali"
            action={u?.totp_enabled
              ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Yoqilgan</span>
              : <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">O'chirilgan</span>}
          />
          <div className="space-y-4 p-5">
            {u?.totp_enabled ? (
              <>
                <Notice tone="ok">Hisobingiz himoyalangan: kirishda parol bilan birga ilovadagi kod so'raladi.</Notice>
                <details className="rounded-xl ring-1 ring-slate-200">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700">2FA ni o'chirish</summary>
                  <div className="border-t border-slate-100 p-4">
                    <p className="mb-3 text-xs text-slate-500">Xavfsizlik uchun joriy parol va ilovadagi amaldagi kod talab qilinadi.</p>
                    <DisableTotpForm />
                  </div>
                </details>
              </>
            ) : setup ? (
              <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
                <div className="mx-auto">
                  <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={setup.qr} alt="2FA uchun QR kod" width={180} height={180} className="h-[180px] w-[180px]" />
                  </div>
                </div>
                <div className="space-y-3">
                  <ol className="list-decimal space-y-1 pl-4 text-sm text-slate-600">
                    <li>Ilovada &quot;Hisob qo&apos;shish&quot; → QR kodni skanerlang.</li>
                    <li>Skanerlab bo&apos;lmasa, quyidagi kalitni qo&apos;lda kiriting.</li>
                    <li>Ilova ko&apos;rsatgan 6 xonali kodni kiriting.</li>
                  </ol>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qo&apos;lda kiritish kaliti</div>
                    <code className="mt-1 block select-all break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-900">{setup.groups}</code>
                  </div>
                  <ConfirmTotpForm />
                </div>
              </div>
            ) : (
              <>
                {setupError && <Notice tone="error">2FA sozlamasini o&apos;qib bo&apos;lmadi. Qaytadan boshlang.</Notice>}
                <Notice tone="warn">2FA yoqilmagan. Parol o&apos;g&apos;irlansa ham hisobingizni himoya qilish uchun uni yoqing.</Notice>
                <StartTotpForm />
              </>
            )}
          </div>
        </Card>

        {/* Sessiyalar */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Faol sessiyalar"
            subtitle="Hisobingizga kirilgan qurilmalar. Tanimagan sessiyani darhol yoping va parolni almashtiring."
          />
          <div className="mt-2 divide-y divide-slate-100">
            {sessions.map((s) => {
              const current = s.token_hash === user.tokenHash;
              const sid = sha256(s.token_hash).slice(0, 12);
              const Icon = isMobile(s.user_agent) ? Smartphone : Laptop;
              return (
                <div key={sid} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${current ? 'bg-[#FFC400]/20 text-slate-900' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                      {shortUa(s.user_agent)}
                      {current && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Joriy sessiya</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      IP: {s.ip ?? '—'} · Kirilgan: {fmtDateTime(s.created_at)} · Faollik: {timeAgo(s.last_seen_at)}
                    </div>
                  </div>
                  {!current && <RevokeSessionButton sid={sid} />}
                </div>
              );
            })}
            {!sessions.length && <div className="px-5 py-6 text-sm text-slate-500">Faol sessiyalar yo&apos;q.</div>}
          </div>
          {sessions.length > 1 && (
            <div className="border-t border-slate-100 p-5"><RevokeOthersForm /></div>
          )}
        </Card>

        {/* Telegram */}
        <Card>
          <CardHeader title="Shaxsiy Telegram xabarnomalari" subtitle="Sizga biriktirilgan signallar haqida shaxsiy xabar olish uchun" />
          <div className="p-5"><TelegramChatForm value={u?.telegram_chat_id ?? ''} /></div>
        </Card>

        <Card>
          <CardHeader title="Xavfsizlik maslahatlari" />
          <div className="mt-2 divide-y divide-slate-100">
            <Row icon={ShieldCheck} title="2FA ni yoqing" desc="Parolning o'zi yetarli emas — ikkinchi bosqich hisobni himoya qiladi" />
            <Row icon={Lock} title="Parolni hech kimga bermang" desc="Administrator ham sizdan parol so'ramaydi" />
            <Row icon={Send} title="Shubhali xabarlar" desc="Kod yoki parol so'ragan Telegram xabarlariga javob bermang" />
          </div>
        </Card>
      </div>
    </div>
  );
}
