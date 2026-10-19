import Link from 'next/link';
import { Building2, EyeOff, Pencil, Search, UserPlus, Users } from 'lucide-react';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite } from '@/lib/site';
import { Card, EmptyState, PageTitle, btnClass, inputClass } from '@/components/ui';
import { deleteWorker, setWorkerActive } from './actions';
import { CreateWorkerForm, EditWorkerForm, SmallActionForm } from './forms.client';

export const dynamic = 'force-dynamic';

const WARN_DAYS = 14;
const LIMIT = 500;

type Training = 'ok' | 'soon' | 'expired' | 'none';
type Row = {
  id: string; full_name: string; trade: string; brigade: string; badge_code: string | null; phone: string;
  training_valid_until: string | null; active: boolean; training: Training;
};

const Query = z.object({
  q: z.string().trim().max(100).catch(''),
  f: z.enum(['xavf']).optional().catch(undefined),
});

/** ILIKE uchun maxsus belgilarni ekranlash — qiymat baribir parametr sifatida uzatiladi. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

function TrainingChip({ t, until }: { t: Training; until: string | null }) {
  const cls = 'inline-block rounded-full px-2.5 py-1 text-xs font-semibold';
  if (t === 'ok') return <span className={`${cls} bg-emerald-50 text-emerald-700`}>Yo&apos;riqnoma amal qiladi (gacha {fmtDate(until!)})</span>;
  if (t === 'soon') return <span className={`${cls} bg-amber-50 text-amber-800`}>Muddati yaqin · {fmtDate(until!)}</span>;
  if (t === 'expired') return <span className={`${cls} bg-red-50 text-red-700`}>Muddati o&apos;tgan · {fmtDate(until!)}</span>;
  return <span className={`${cls} bg-red-50 text-red-700`}>Yo&apos;riqnoma o&apos;tmagan</span>;
}

export default async function WorkersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage('view');
  const canEdit = can(user.role, 'worker.edit');
  const sp = await searchParams;
  const { q, f } = Query.parse({
    q: typeof sp.q === 'string' ? sp.q : '',
    f: typeof sp.f === 'string' ? sp.f : undefined,
  });
  const site = await currentSite();

  if (!site) {
    return (
      <div>
        <PageTitle title="Xodimlar" subtitle="Obyektdagi xodimlar va xavfsizlik yo'riqnomasi holati" />
        <Card>
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="Hali obyekt qo'shilmagan"
            text="Xodimlar qurilish obyektiga bog'lanadi. Avval obyekt yarating."
            action={<Link href="/cameras#obyekt" className={btnClass('primary')}>Obyekt yaratish</Link>}
          />
        </Card>
      </div>
    );
  }

  const pattern = q ? `%${likeEscape(q)}%` : null;
  const today = sql`(now() AT TIME ZONE 'Asia/Tashkent')::date`;

  const [rows, [counts]] = await Promise.all([
    sql<Row[]>`
      SELECT id, full_name, trade, brigade, badge_code, phone, active,
             to_char(training_valid_until, 'YYYY-MM-DD') AS training_valid_until,
             CASE
               WHEN training_valid_until IS NULL THEN 'none'
               WHEN training_valid_until < ${today} THEN 'expired'
               WHEN training_valid_until < ${today} + ${WARN_DAYS}::int THEN 'soon'
               ELSE 'ok'
             END AS training
      FROM workers
      WHERE site_id = ${site.id}
        ${pattern ? sql`AND (full_name ILIKE ${pattern} OR brigade ILIKE ${pattern} OR trade ILIKE ${pattern} OR coalesce(badge_code, '') ILIKE ${pattern})` : sql``}
        ${f === 'xavf' ? sql`AND (training_valid_until IS NULL OR training_valid_until < ${today} + ${WARN_DAYS}::int)` : sql``}
      ORDER BY active DESC, full_name
      LIMIT ${LIMIT}`,
    sql<{ total: number; active: number; risk: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE active)::int AS active,
             count(*) FILTER (WHERE training_valid_until IS NULL OR training_valid_until < ${today} + ${WARN_DAYS}::int)::int AS risk
      FROM workers WHERE site_id = ${site.id}`,
  ]);

  const filterHref = (nextF?: 'xavf') => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (nextF) p.set('f', nextF);
    const s = p.toString();
    return s ? `/workers?${s}` : '/workers';
  };

  return (
    <div>
      <PageTitle
        title="Xodimlar"
        subtitle={`${site.name} · ${counts.total} xodim, ${counts.active} faol · ${counts.risk} tasi yo'riqnoma bo'yicha xavf guruhida`}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <form method="get" action="/workers" className="relative flex flex-1 gap-2">
          {f && <input type="hidden" name="f" value={f} />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input name="q" defaultValue={q} maxLength={100} placeholder="Ism, kasb, brigada yoki beyj bo'yicha qidirish" className={`${inputClass} pl-9`} />
          </div>
          <button type="submit" className={btnClass('secondary')}>Qidirish</button>
        </form>
        <Link
          href={filterHref(f === 'xavf' ? undefined : 'xavf')}
          className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${f === 'xavf' ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
        >
          Faqat xavf guruhi{counts.risk ? ` (${counts.risk})` : ''}
        </Link>
      </div>

      {canEdit && (
        <details className="mb-4 rounded-2xl bg-white ring-1 ring-slate-200/80">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-slate-900">
            <UserPlus className="h-4 w-4" /> Yangi xodim qo&apos;shish
          </summary>
          <div className="border-t border-slate-100 p-5"><CreateWorkerForm /></div>
        </details>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title={q || f ? 'Hech narsa topilmadi' : "Xodimlar ro'yxati bo'sh"}
            text={q || f ? "Qidiruv so'zini yoki filtrni o'zgartirib ko'ring." : "Obyektda ishlaydigan xodimlarni qo'shing — yo'riqnoma muddati tugashidan oldin ogohlantirish ko'rasiz."}
            action={q || f ? <Link href="/workers" className={btnClass('secondary')}>Filtrni tozalash</Link> : undefined}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[2fr_1.3fr_1fr_1.2fr_1.9fr_0.8fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:grid">
              <span>Xodim</span><span>Brigada</span><span>Beyj</span><span>Telefon</span><span>Yo&apos;riqnoma</span><span>Holat</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((w) => (
                <li key={w.id} className={`px-5 py-3.5 ${w.active ? '' : 'bg-slate-50/60'}`}>
                  <div className="grid grid-cols-2 items-center gap-3 lg:grid-cols-[2fr_1.3fr_1fr_1.2fr_1.9fr_0.8fr] lg:gap-4">
                    <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                        {w.full_name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase()}
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${w.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-semibold ${w.active ? 'text-slate-900' : 'text-slate-500'}`}>{w.full_name}</div>
                        <div className="truncate text-xs text-slate-500">{w.trade || 'Kasbi ko\'rsatilmagan'}</div>
                      </div>
                    </div>
                    <div className="truncate text-sm text-slate-600">{w.brigade || '—'}</div>
                    <div className="truncate font-mono text-xs text-slate-600">{w.badge_code || '—'}</div>
                    <div className="truncate text-sm text-slate-600">{w.phone || '—'}</div>
                    <div><TrainingChip t={w.training} until={w.training_valid_until} /></div>
                    <div>
                      {w.active
                        ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Faol</span>
                        : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Nofaol</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <details className="mt-3 rounded-xl bg-slate-50 ring-1 ring-slate-200">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900">
                        <Pencil className="h-3.5 w-3.5" /> Tahrirlash
                      </summary>
                      <div className="space-y-4 border-t border-slate-200 p-4">
                        <EditWorkerForm w={w} />
                        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                          <SmallActionForm
                            action={setWorkerActive}
                            hidden={{ workerId: w.id, active: w.active ? '0' : '1' }}
                            label={w.active ? 'Nofaol qilish' : 'Faollashtirish'}
                          />
                          <SmallActionForm
                            action={deleteWorker}
                            hidden={{ workerId: w.id }}
                            label="O'chirish"
                            variant="danger"
                            confirmText={`${w.full_name} ro'yxatdan butunlay o'chirilsinmi?`}
                          />
                        </div>
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {rows.length >= LIMIT && (
              <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Birinchi {LIMIT} ta natija ko&apos;rsatildi. Aniqroq qidiring.</div>
            )}
          </>
        )}
      </Card>

      <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
        <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Kameralarda yuzlar xiralashtiriladi. Xodim shaxsi faqat beyj/turniket orqali aniqlanadi. Shaxsiy ma&apos;lumotlar faqat xavfsizlik maqsadida ishlatiladi.
      </p>
    </div>
  );
}
