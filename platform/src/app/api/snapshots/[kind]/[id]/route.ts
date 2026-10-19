import { sql } from '@/lib/db';
import { getUser } from '@/lib/security/session';
import { UUID_RE } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** Kadrlar faqat tizimga kirgan foydalanuvchilarga, keshlanmasdan beriladi (ochiq URL yo'q). */
export async function GET(_: Request, ctx: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { kind, id } = await ctx.params;
  if (!UUID_RE.test(id)) return new Response('Not found', { status: 404 });

  let rows: { img: Buffer | null }[] = [];
  if (kind === 'alert') rows = await sql`SELECT snapshot AS img FROM alerts WHERE id = ${id}`;
  else if (kind === 'camera') rows = await sql`SELECT last_snapshot AS img FROM cameras WHERE id = ${id}`;
  else return new Response('Not found', { status: 404 });

  const img = rows[0]?.img;
  if (!img) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(img), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
