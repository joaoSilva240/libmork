import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que requerem autenticação
const protectedRoutes = ['/player', '/master'];

// Rotas que não devem ser acessadas por usuários autenticados
const authRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Verificar se o usuário tem um cookie de sessão
  const sessionCookie = request.cookies.get('libmork_session');
  const isAuthenticated = !!sessionCookie;

  // Verificar se a rota atual é protegida
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Verificar se a rota atual é de autenticação
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Se tentar acessar rota protegida sem estar autenticado
  if (isProtectedRoute && !isAuthenticated) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Se tentar acessar rota de autenticação estando autenticado
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/player', request.url));
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
