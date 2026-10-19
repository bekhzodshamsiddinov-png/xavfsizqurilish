'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireAction } from '@/lib/security/session';
import { SITE_COOKIE, UUID_RE } from '@/lib/site';

export async function selectSite(fd: FormData) {
  await requireAction('view');
  const id = String(fd.get('siteId') ?? '');
  if (!UUID_RE.test(id)) return;
  const [s] = await sql`SELECT id FROM sites WHERE id = ${id}`;
  if (!s) return;
  (await cookies()).set(SITE_COOKIE, id, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}
