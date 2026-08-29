// =============================================================================
// Libmork — CSRF Helper (client-side)
// =============================================================================
// O middleware de autenticação exige o header `x-csrf-token` em mutações
// /api/* (double-submit cookie). O cookie `libmork_csrf` é httpOnly: false,
// portanto legível aqui. Este helper centraliza leitura e injeção.
// =============================================================================

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)libmork_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const CSRF_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export function isCsrfMutation(method: string, url: string): boolean {
  if (!CSRF_METHODS.includes(method.toUpperCase())) return false;
  // Apenas rotas same-origin de API
  const path = url.startsWith("http")
    ? new URL(url, window.location.origin).pathname
    : url;
  if (!path.startsWith("/api/")) return false;
  // Rotas públicas isentas
  const exempt = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/health",
    "/api/public-sheet",
    "/api/invites",
    "/api/socket",
  ];
  return !exempt.some((route) => path.startsWith(route));
}

/**
 * Wrapper de fetch que injeta x-csrf-token automaticamente em mutações.
 * Use em código novo; o patch global (Parte 2) cobre o código existente.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (isCsrfMutation(method, url)) {
    const token = getCsrfToken();
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", token);
      return fetch(input, { ...init, headers, credentials: "include" });
    }
  }
  return fetch(input, { ...init, credentials: "include" });
}
