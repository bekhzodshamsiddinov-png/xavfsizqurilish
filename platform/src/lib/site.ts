import 'server-only';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';

export const SITE_COOKIE = 'qq_site';
export interface Site { id: string; name: string; address: string; floors: number; is_demo: boolean }

export async function listSites(): Promise<Site[]> {
  return sql<Site[]>`SELECT id, name, address, floors, is_demo FROM sites ORDER BY created_at`;
}

/** Tanlangan obyekt (cookie qiymati bazadagi ro'yxat bilan tekshiriladi — soxta ID ishlamaydi). */
export async function currentSite(): Promise<Site | null> {
  const sites = await listSites();
  if (!sites.length) return null;
  const want = (await cookies()).get(SITE_COOKIE)?.value;
  return sites.find((s) => s.id === want) ?? sites[0];
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
