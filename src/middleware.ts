import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPublicOrigin, getSafeRedirect } from '@/lib/auth/redirect';

// Rotas que requerem autenticação
const protectedRoutes = ['/player', '/master'];

// Rotas que não devem ser acessadas por usuários autenticados
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Verificar se o usuário tem um cookie de sessão
  const sessionCookie = request.cookies.get('libmork_session');
  // Validate token format: 64 hex characters (32 bytes)
  const isAuthenticated = !!(
    sessionCookie?.value && 
    /^[a-f0-9]{64}$/i.test(sessionCookie.value)
  );

  // Verificar se a rota atual é protegida
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Verificar se a rota atual é de autenticação
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Se tentar acessar rota protegida sem estar autenticado
  if (isProtectedRoute && !isAuthenticated) {
    const originalPath = getSafeRedirect(
      `${pathname}${request.nextUrl.search}`,
    );
    const loginPath = originalPath
      ? `/login?redirect=${encodeURIComponent(originalPath)}`
      : '/login';
    return NextResponse.redirect(new URL(loginPath, getPublicOrigin(request)), 307);
  }

  // Se tentar acessar rota de autenticação estando autenticado
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/player', getPublicOrigin(request)), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
