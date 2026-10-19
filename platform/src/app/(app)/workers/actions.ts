'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { requireAction } from '@/lib/security/session';
import { currentSite } from '@/lib/site';

export type FormState = { error?: string; ok?: string } | undefined;

const GENERIC = "Amalni bajarib bo'lmadi. Qaytadan urinib ko'ring.";
const NO_SITE = 'Avval obyekt yarating yoki tanlang.';
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Ma'lumotlar noto'g'ri";

const optionalDate = z.union([
  z.literal(''),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri").refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v >= '2000-01-01' && v <= '2100-12-31';
  }, "Sana noto'g'ri"),
]);

const WorkerFields = z.object({
  full_name: z.string().trim().min(3, "F.I.Sh. kamida 3 belgi").max(100, "F.I.Sh. 100 belgidan oshmasin"),
  trade: z.string().trim().max(60, 'Kasb 60 belgidan oshmasin').default(''),
  brigade: z.string().trim().max(60, 'Brigada 60 belgidan oshmasin').default(''),
  badge_code: z.union([z.literal(''), z.string().trim().regex(/^[A-Za-z0-9-]{3,40}$/, "Beyj kodi: 3–40 belgi, lotin harf, raqam va -")]).default(''),
  phone: z.union([z.literal(''), z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Telefon raqami noto'g'ri")]).default(''),
  training_valid_until: optionalDate.default(''),
});

function done() {
  revalidatePath('/workers');
}

export async function createWorker(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('worker.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = WorkerFields.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const d = p.data;
  try {
    const [w] = await sql<{ id: string }[]>`
      INSERT INTO workers (site_id, full_name, trade, brigade, badge_code, phone, training_valid_until)
      VALUES (${site.id}, ${d.full_name}, ${d.trade}, ${d.brigade}, ${d.badge_code || null}, ${d.phone}, ${d.training_valid_until || null})
      RETURNING id`;
    await audit(user.id, 'worker.create', w.id, { siteId: site.id });
  } catch (e) {
    console.error('[workers] create', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: "Xodim qo'shildi." };
}

export async function updateWorker(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('worker.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = WorkerFields.extend({ workerId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const d = p.data;
  try {
    const r = await sql`
      UPDATE workers SET full_name = ${d.full_name}, trade = ${d.trade}, brigade = ${d.brigade},
        badge_code = ${d.badge_code || null}, phone = ${d.phone}, training_valid_until = ${d.training_valid_until || null}
      WHERE id = ${d.workerId} AND site_id = ${site.id} RETURNING id`;
    if (!r.length) return { error: 'Xodim topilmadi.' };
    await audit(user.id, 'worker.update', d.workerId);
  } catch (e) {
    console.error('[workers] update', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: 'Saqlandi.' };
}

export async function setWorkerActive(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('worker.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({ workerId: z.uuid(), active: z.enum(['1', '0']) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  const active = p.data.active === '1';
  try {
    const r = await sql`UPDATE workers SET active = ${active} WHERE id = ${p.data.workerId} AND site_id = ${site.id} RETURNING id`;
    if (!r.length) return { error: 'Xodim topilmadi.' };
    await audit(user.id, active ? 'worker.activate' : 'worker.deactivate', p.data.workerId);
  } catch (e) {
    console.error('[workers] setActive', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: active ? 'Xodim faollashtirildi.' : "Xodim nofaol qilindi." };
}

export async function deleteWorker(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAction('worker.edit');
  const site = await currentSite();
  if (!site) return { error: NO_SITE };
  const p = z.object({ workerId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Ma'lumotlar noto'g'ri" };
  try {
    const r = await sql`DELETE FROM workers WHERE id = ${p.data.workerId} AND site_id = ${site.id} RETURNING id`;
    if (!r.length) return { error: 'Xodim topilmadi.' };
    await audit(user.id, 'worker.delete', p.data.workerId, { siteId: site.id });
  } catch (e) {
    console.error('[workers] delete', (e as Error).message);
    return { error: GENERIC };
  }
  done();
  return { ok: "Xodim o'chirildi." };
}
