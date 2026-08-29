// =============================================================================
// Libmork — Fetch CSRF Patch (global, client-side)
// =============================================================================
// Monkey-patch de window.fetch que injeta x-csrf-token automaticamente em
// mutações same-origin de /api. Instalado uma única vez no layout.
// Garante cobertura completa do middleware CSRF sem editar 91 call sites.
// =============================================================================

import { getCsrfToken, isCsrfMutation } from "./csrf";

let installed = false;

export function installFetchCsrfPatch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const method = (init?.method || "GET").toUpperCase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (isCsrfMutation(method, url)) {
      const token = getCsrfToken();
      if (token) {
        const headers = new Headers(init?.headers);
        if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", token);
        return originalFetch(input, { ...init, headers, credentials: "include" });
      }
    }
    return originalFetch(input, init);
  };
}
