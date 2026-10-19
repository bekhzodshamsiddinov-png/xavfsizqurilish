import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/setup', '/api/v1/', '/api/health'];
const SESSION_COOKIE = '__Host-qq_sid';

function csp(nonce: string, local: boolean) {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    // Brauzer detektori AI modelini Google Cloud Storage'dan yuklaydi
    "connect-src 'self' https://storage.googleapis.com https://tfhub.dev https://www.kaggle.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    dev || local ? '' : 'upgrade-insecure-requests',
  ].filter(Boolean).join('; ');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  // 1) CSRF himoyasi: holatni o'zgartiruvchi so'rovlar faqat o'z domenimizdan.
  //    Qurilma API (/api/v1/) HMAC imzo bilan himoyalangan, u brauzerdan kelmaydi.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !pathname.startsWith('/api/v1/')) {
    const origin = req.headers.get('origin');
    const site = req.headers.get('sec-fetch-site');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    let ok = true;
    if (origin) {
      try { ok = new URL(origin).host === host; } catch { ok = false; }
    }
    if (site && site !== 'same-origin') ok = false;
    if (!origin && !site) ok = false; // zamonaviy brauzerlar doim yuboradi
    if (!ok) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // 2) Kirmagan foydalanuvchini login sahifasiga yo'naltirish (to'liq tekshiruv serverda).
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  if (!isPublic && !req.cookies.get(SESSION_COOKIE)) {
    if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 3) Har bir so'rov uchun yangi nonce bilan qat'iy CSP.
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce, req.nextUrl.hostname === 'localhost');
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);
  reqHeaders.set('Content-Security-Policy', policy);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('Content-Security-Policy', policy);
  if (!pathname.startsWith('/_next/static')) res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)' }],
};
