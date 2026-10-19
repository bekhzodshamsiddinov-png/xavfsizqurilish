import { Building2, Camera, Cpu, Pencil, Plug, Wifi, WifiOff } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite, listSites } from '@/lib/site';
import { fmtDateTime, timeAgo } from '@/lib/labels';
import { Card, CardHeader, EmptyState, Field, PageTitle, inputClass } from '@/components/ui';
import { bindCamera, deleteCamera, revokeDevice, updateCamera, updateSite } from './actions';
import {
  ActionForm, CameraFields, CreateCameraForm, CreateDeviceForm, CreateSiteForm, DeleteSiteForm, RotateSecretForm, SiteFields,
} from './forms.client';

export const dynamic = 'force-dynamic';

const ONLINE_MS = 2 * 60 * 1000;

type CamRow = {
  id: string; code: string; name: string; floor: string; device_id: string | null; device_name: string | null;
  last_seen_at: Date | null; has_snapshot: boolean; last_snapshot_at: Date | null;
};
type DevRow = {
  id: string; name: string; key_id: string; created_at: Date; last_seen_at: Date | null; revoked_at: Date | null; cams: number;
};

const isOnline = (d: Date | null) => !!d && Date.now() - new Date(d).getTime() < ONLINE_MS;

export default async function CamerasPage() {
  const user = await requirePage('view');
  const canEdit = can(user.role, 'camera.edit');
  const canDevices = can(user.role, 'device.manage');
  const canDeleteSite = can(user.role, 'settings.manage');

  const [sites, site] = await Promise.all([listSites(), currentSite()]);

  const [cameras, devices] = site
    ? await Promise.all([
        sql<CamRow[]>`
          SELECT c.id, c.code, c.name, c.floor, c.device_id, d.name AS device_name, c.last_seen_at,
                 (c.last_snapshot IS NOT NULL) AS has_snapshot, c.last_snapshot_at
          FROM cameras c LEFT JOIN devices d ON d.id = c.device_id AND d.site_id = c.site_id
          WHERE c.site_id = ${site.id}
          ORDER BY c.code`,
        sql<DevRow[]>`
          SELECT d.id, d.name, d.key_id, d.created_at, d.last_seen_at, d.revoked_at,
                 (SELECT count(*)::int FROM cameras c WHERE c.device_id = d.id) AS cams
          FROM devices d WHERE d.site_id = ${site.id}
          ORDER BY d.revoked_at IS NOT NULL, d.created_at`,
      ])
    : [[] as CamRow[], [] as DevRow[]];

  const activeDevices = devices.filter((d) => !d.revoked_at);
  const onlineCams = cameras.filter((c) => isOnline(c.last_seen_at)).length;

  return (
    <div>
      <PageTitle
        title="Kameralar va qurilmalar"
        subtitle="Video obyektning o'zida (edge) qayta ishlanadi — internet uzilsa ham signal ishlaydi"
      />

      {!site && (
        <Card className="mb-4">
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="Hali obyekt qo'shilmagan"
            text="Kameralar, xavfli zonalar va xodimlar obyektga bog'lanadi. Boshlash uchun birinchi qurilish obyektini yarating."
          />
        </Card>
      )}

      {/* ---------------- OBYEKTLAR ---------------- */}
      <section id="obyekt" className="scroll-mt-24">
        <Card className="pb-5">
          <CardHeader title="Obyektlar" subtitle={`${sites.length} ta qurilish obyekti`} />
          {sites.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
              {sites.map((s) => (
                <li key={s.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"><Building2 className="h-5 w-5 text-slate-500" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="truncate">{s.name}</span>
                        {s.id === site?.id && <span className="rounded-full bg-[#FFC400]/20 px-2 py-0.5 text-[11px] font-bold text-slate-800">Joriy</span>}
                        {s.is_demo && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}
                      </div>
                      <div className="text-xs text-slate-500">{s.address || 'Manzil kiritilmagan'} · {s.floors} qavat</div>
                    </div>
                    {(canEdit || canDeleteSite) && (
                      <details className="w-full sm:w-auto [&[open]]:w-full">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                          <Pencil className="h-3.5 w-3.5" /> Tahrirlash
                        </summary>
                        <div className="mt-3 space-y-4">
                          {canEdit && (
                            <ActionForm action={updateSite} hidden={{ siteId: s.id }} submitLabel="Saqlash">
                              <SiteFields name={s.name} address={s.address} floors={s.floors} />
                            </ActionForm>
                          )}
                          {canDeleteSite && <DeleteSiteForm siteId={s.id} siteName={s.name} />}
                        </div>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 pt-4">
            {canEdit ? (
              <>
                <div className="mb-2 text-sm font-semibold text-slate-900">Yangi obyekt</div>
                <CreateSiteForm />
              </>
            ) : (
              !sites.length && <p className="text-sm text-slate-500">Obyekt yaratish uchun xavfsizlik nazoratchisi yoki administratorga murojaat qiling.</p>
            )}
          </div>
        </Card>
      </section>

      {site && (
        <>
          {/* ---------------- EDGE QURILMALAR ---------------- */}
          <section className="mt-6">
            <h2 className="mb-3 text-lg font-bold tracking-tight text-slate-900">Edge qurilmalar</h2>
            {devices.length === 0 ? (
              <Card><EmptyState icon={<Cpu className="h-7 w-7" />} title="Qurilma yo'q" text="Obyektdagi kompyuter (masalan, Jetson Orin) kameralar oqimini tahlil qilib, signallarni shu panelga yuboradi." /></Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {devices.map((d) => {
                  const online = !d.revoked_at && isOnline(d.last_seen_at);
                  return (
                    <Card key={d.id} className={`p-5 ${d.revoked_at ? 'opacity-70' : ''}`}>
                      <div className="flex items-start gap-2">
                        <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-900">{d.name}</div>
                          <div className="truncate font-mono text-[11px] text-slate-500">{d.key_id}</div>
                        </div>
                        {d.revoked_at
                          ? <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Bekor qilingan</span>
                          : <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Faol</span>}
                      </div>
                      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div><dt className="text-slate-500">Yaratilgan</dt><dd className="font-medium text-slate-800">{fmtDateTime(d.created_at)}</dd></div>
                        <div>
                          <dt className="text-slate-500">Oxirgi aloqa</dt>
                          <dd className={`flex items-center gap-1 font-medium ${online ? 'text-emerald-700' : 'text-slate-800'}`}>
                            {d.last_seen_at ? (online ? <><Wifi className="h-3.5 w-3.5" /> Onlayn</> : timeAgo(d.last_seen_at)) : 'Hali ulanmagan'}
                          </dd>
                        </div>
                        <div><dt className="text-slate-500">Kameralar</dt><dd className="font-medium text-slate-800">{d.cams} ta</dd></div>
                        {d.revoked_at && <div><dt className="text-slate-500">Bekor qilingan</dt><dd className="font-medium text-slate-800">{fmtDateTime(d.revoked_at)}</dd></div>}
                      </dl>
                      {canDevices && !d.revoked_at && (
                        <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
                          <RotateSecretForm deviceId={d.id} deviceName={d.name} />
                          <ActionForm
                            action={revokeDevice} hidden={{ deviceId: d.id }} inline variant="ghost" buttonClass="!px-3 !py-1.5 !text-xs !text-red-600"
                            confirmText={`"${d.name}" qurilmasi bekor qilinsinmi? U endi signal yubora olmaydi va kameralari undan uziladi.`}
                            submitLabel="Bekor qilish"
                          />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
            {canDevices && (
              <Card className="mt-3 p-5">
                <CreateDeviceForm />
              </Card>
            )}
          </section>

          {/* ---------------- KAMERALAR ---------------- */}
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Kameralar — {site.name}</h2>
              <span className="text-sm text-slate-500">{onlineCams} / {cameras.length} onlayn</span>
            </div>
            <Card className="overflow-hidden">
              {cameras.length === 0 ? (
                <EmptyState icon={<Camera className="h-7 w-7" />} title="Kamera qo'shilmagan" text="Kamerani qo'shing va uni edge qurilmaga bog'lang. Kod qurilma config'idagi kamera kodi bilan bir xil bo'lishi kerak." />
              ) : (
                <>
                  <div className="hidden grid-cols-[96px_1.6fr_0.8fr_1.4fr_1fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid">
                    <span>Kadr</span><span>Kamera</span><span>Qavat</span><span>Qurilma</span><span>Holat</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {cameras.map((c) => {
                      const online = isOnline(c.last_seen_at);
                      return (
                        <li key={c.id} className="px-5 py-3.5">
                          <div className="grid grid-cols-[80px_1fr] items-center gap-x-4 gap-y-2 lg:grid-cols-[96px_1.6fr_0.8fr_1.4fr_1fr]">
                            <div className="row-span-2 h-12 w-20 overflow-hidden rounded-lg bg-slate-800 lg:row-span-1 lg:w-24">
                              {c.has_snapshot && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={`/api/snapshots/camera/${c.id}`} alt={`${c.name} kadri`} loading="lazy" className="h-full w-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                              <div className="font-mono text-xs text-slate-500">{c.code}</div>
                            </div>
                            <div className="hidden text-sm text-slate-600 lg:block">{c.floor || '—'}</div>
                            <div className="text-sm text-slate-600">
                              <span className="lg:hidden">{c.floor ? `${c.floor} · ` : ''}</span>
                              {c.device_name ?? <span className="text-slate-400">Bog&apos;lanmagan</span>}
                            </div>
                            <div className="col-start-2 lg:col-start-auto">
                              {online
                                ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><Wifi className="h-3.5 w-3.5" /> Onlayn</span>
                                : <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"><WifiOff className="h-3.5 w-3.5" /> Oflayn{c.last_seen_at ? ` · ${timeAgo(c.last_seen_at)}` : ''}</span>}
                            </div>
                          </div>
                          {canEdit && <CameraEditor cam={c} devices={activeDevices} />}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </Card>
            {canEdit && (
              <Card className="mt-3 p-5">
                <div className="mb-2 text-sm font-semibold text-slate-900">Yangi kamera</div>
                <CreateCameraForm />
              </Card>
            )}
          </section>
        </>
      )}

      {/* ---------------- ULASH YO'RIQNOMASI ---------------- */}
      <Card className="mt-6 p-5">
        <div className="flex items-center gap-2"><Plug className="h-5 w-5 text-slate-400" /><h3 className="text-[15px] font-semibold text-slate-900">Qurilmani ulash</h3></div>
        <div className="mt-3 grid gap-4 text-sm text-slate-600 lg:grid-cols-2">
          <div className="space-y-2">
            <p>Edge qurilma panelga HTTPS orqali ikki manzilga so&apos;rov yuboradi:</p>
            <ul className="space-y-1 font-mono text-xs text-slate-800">
              <li><span className="font-bold">POST</span> /api/v1/heartbeat — tiriklik, kadrlar, statistika (javobda zonalar)</li>
              <li><span className="font-bold">POST</span> /api/v1/events — aniqlangan xavf hodisalari</li>
            </ul>
            <p>Tayyor Python agenti repozitoriyning <code className="rounded bg-slate-100 px-1 font-mono text-xs">edge/</code> papkasida. Kalit ID va maxfiy kalitni uning config fayliga yozing.</p>
          </div>
          <div className="space-y-2">
            <p>Har bir so&apos;rovda sarlavhalar:</p>
            <ul className="space-y-1 font-mono text-xs text-slate-800">
              <li>X-QQ-Key: qqd_...</li>
              <li>X-QQ-Timestamp: unix soniyalar (±5 daqiqa)</li>
              <li className="break-all">X-QQ-Signature: hex(HMAC-SHA256(secret, `${'{'}timestamp{'}'}.${'{'}body{'}'}`))</li>
            </ul>
            <p className="text-xs text-slate-500">Kamera faqat o&apos;zi bog&apos;langan qurilmadan kelgan ma&apos;lumotni qabul qiladi. Kalit yo&apos;qolsa — &quot;Kalitni yangilash&quot;, qurilma o&apos;g&apos;irlansa — &quot;Bekor qilish&quot;.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CameraEditor({ cam, devices }: { cam: CamRow; devices: DevRow[] }) {
  return (
    <details className="mt-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
        <Pencil className="h-3.5 w-3.5" /> {cam.code} — tahrirlash, qurilmaga bog&apos;lash, o&apos;chirish
      </summary>
      <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-[2fr_1fr]">
        <ActionForm action={updateCamera} hidden={{ cameraId: cam.id }} submitLabel="Saqlash">
          <CameraFields code={cam.code} name={cam.name} floor={cam.floor} />
        </ActionForm>
        <div className="space-y-4">
          <ActionForm action={bindCamera} hidden={{ cameraId: cam.id }} submitLabel="Bog'lash" variant="secondary">
            <Field label="Edge qurilma">
              <select name="deviceId" defaultValue={cam.device_id ?? ''} className={inputClass}>
                <option value="">— Bog&apos;lanmagan —</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </ActionForm>
          <ActionForm
            action={deleteCamera} hidden={{ cameraId: cam.id }} variant="danger" submitLabel="Kamerani o'chirish"
            confirmText={`"${cam.name}" kamerasi o'chirilsinmi? Unga chizilgan barcha xavfli zonalar ham o'chadi.`}
          />
        </div>
      </div>
    </details>
  );
}
