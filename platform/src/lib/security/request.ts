import 'server-only';
import { headers } from 'next/headers';

/**
 * Mijoz IP manzili. Vercel'da `x-vercel-forwarded-for` / `x-real-ip` ni platformaning o'zi o'rnatadi
 * (mijoz soxtalashtira olmaydi). Boshqa muhitda — X-Forwarded-For dagi oxirgi (ishonchli proksi qo'shgan) qiymat.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const vercel = h.get('x-vercel-forwarded-for') || h.get('x-real-ip');
  let ip = vercel ? vercel.split(',')[0] : '';
  if (!ip) {
    const xff = (h.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
    ip = xff[xff.length - 1] || '0.0.0.0';
  }
  return ip.trim().slice(0, 64);
}

export async function userAgent(): Promise<string> {
  const h = await headers();
  return (h.get('user-agent') || '').slice(0, 256);
}
