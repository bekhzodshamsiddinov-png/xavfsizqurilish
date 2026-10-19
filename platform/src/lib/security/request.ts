import 'server-only';
import { headers } from 'next/headers';

/** Mijoz IP manzili (Vercel x-forwarded-for ni o'zi to'g'ri o'rnatadi). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  const ip = (xff ? xff.split(',')[0] : h.get('x-real-ip')) || '0.0.0.0';
  return ip.trim().slice(0, 64);
}

export async function userAgent(): Promise<string> {
  const h = await headers();
  return (h.get('user-agent') || '').slice(0, 256);
}
