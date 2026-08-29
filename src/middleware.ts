import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPublicOrigin, getSafeRedirect } from '@/lib/auth/redirect';
import { generateToken } from '@/lib/utils/tokens';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === 1. CORRELATION ID ===
  const correlationId = request.headers.get('x-correlation-id') || globalThis.crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);

  // === 2. CSRF (apenas mutações em /api, exceto rotas públicas) ===
  const CSRF_COOKIE = 'libmork_csrf';
  const CSRF_HEADER = 'x-csrf-token';
  const isApiRoute = pathname.startsWith('/api');
  const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);

  const csrfPublicRoutes = [
    '/api/public-sheet',
    '/api/invites',
    '/api/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/socket',
  ];
  const isCsrfExempt = csrfPublicRoutes.some(r => pathname.startsWith(r));

  if (isApiRoute && isMutation && !isCsrfExempt) {
    const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value;
    const csrfHeader = request.headers.get(CSRF_HEADER);
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: 'CSRF token validation failed' }, { status: 403 });
    }
  }

  // === 3. AUTH REDIRECT (apenas rotas não-API, lógica original preservada) ===
  const protectedRoutes = ['/', '/player', '/master'];
  const authRoutes = ['/login', '/register'];

  const sessionCookie = request.cookies.get('libmork_session');
  const isAuthenticated = !!(
    sessionCookie?.value &&
    /^[a-f0-9]{64}$/i.test(sessionCookie.value)
  );

  const isProtectedRoute = protectedRoutes.some((route) =>
    route === '/' ? pathname === '/' : pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (!isApiRoute) {
    if (isProtectedRoute && !isAuthenticated) {
      const originalPath = getSafeRedirect(`${pathname}${request.nextUrl.search}`);
      const loginPath = originalPath
        ? `/login?redirect=${encodeURIComponent(originalPath)}`
        : '/login';
      return NextResponse.redirect(new URL(loginPath, getPublicOrigin(request)), 307);
    }
    if (isAuthRoute && isAuthenticated) {
      return NextResponse.redirect(new URL('/', getPublicOrigin(request)), 307);
    }
  }

  // === 4. BUILD RESPONSE ===
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('x-correlation-id', correlationId);

  // Set CSRF cookie se não existir (legível pelo client)
  if (!request.cookies.has(CSRF_COOKIE)) {
    response.cookies.set(CSRF_COOKIE, generateToken(16), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
