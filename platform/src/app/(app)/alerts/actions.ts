'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { audit } from '@/lib/security/audit';
import { AuthError, requireAction } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { currentSite } from '@/lib/site';

export type FormState = { error?: string; ok?: string } | undefined;

const Input = z.object({
  id: z.uuid(),
  op: z.enum(['take', 'resolve', 'false_positive', 'reopen']),
  notes: z.string().trim().max(500).optional().default(''),
});

export async function handleAlert(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const p = Input.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: "Ma'lumot noto'g'ri" };
    const { id, op, notes } = p.data;
    const user = await requireAction(op === 'reopen' ? 'zone.edit' : 'alert.handle');
    const site = await currentSite();
    if (!site) return { error: 'Obyekt tanlanmagan' };

    // Signal joriy obyektga tegishli bo'lishi shart
    const [a] = await sql<{ id: string; status: string; severity: string; assignee_id: string | null }[]>`
      SELECT id, status, severity, assignee_id FROM alerts WHERE id = ${id} AND site_id = ${site.id}`;
    if (!a) return { error: 'Signal topilmadi' };
    // Kritik signalni "yolg'on" deb faqat nazoratchi yoki admin belgilay oladi
    if (op === 'false_positive' && a.severity === 'kritik' && !can(user.role, 'zone.edit')) {
      return { error: "Kritik signalni yolg'on deb belgilash uchun nazoratchi huquqi kerak" };
    }

    if (op === 'take') {
      const r = await sql`UPDATE alerts SET status = 'korib', assignee_id = ${user.id}, acknowledged_at = coalesce(acknowledged_at, now())
                          WHERE id = ${id} AND status = 'yangi' RETURNING id`;
      if (!r.length) return { error: 'Signalni allaqachon boshqa xodim olgan yoki u yopilgan' };
    } else if (op === 'resolve' || op === 'false_positive') {
      const r = await sql`UPDATE alerts SET status = 'hal', resolved_by = ${user.id}, resolved_at = now(),
                  acknowledged_at = coalesce(acknowledged_at, now()), assignee_id = coalesce(assignee_id, ${user.id}),
                  false_positive = ${op === 'false_positive'}, notes = ${notes}
                  WHERE id = ${id} AND status <> 'hal' RETURNING id`;
      if (!r.length) return { error: 'Signal allaqachon yopilgan' };
    } else {
      const r = await sql`UPDATE alerts SET status = 'korib', resolved_at = NULL, resolved_by = NULL, false_positive = false,
                          notes = notes || ${`\n[qayta ochildi: ${user.fullName}]`} WHERE id = ${id} AND status = 'hal' RETURNING id`;
      if (!r.length) return { error: 'Signal ochiq holatda' };
    }
    await audit(user.id, `alert.${op}`, id);
    revalidatePath('/alerts');
    revalidatePath('/');
    return { ok: op === 'take' ? "Signal sizga biriktirildi" : op === 'reopen' ? 'Signal qayta ochildi' : 'Saqlandi' };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    console.error('[alerts]', (e as Error).message);
    return { error: 'Xatolik yuz berdi' };
  }
}
