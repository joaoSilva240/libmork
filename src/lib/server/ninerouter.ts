// =============================================================================
// Libmork — NINEROUTER shared helper
// =============================================================================
// Centralizes runtime env reading, fallback host.docker.internal, timeout,
// retry, error mapping and probe logic for health + translation.
//
// TRADE-OFFS DOCUMENTADOS:
//
// 1) Tailscale CGNAT (100.64/10) — Container bridge NÃO roteia Tailnet por padrão.
//    O IP 100.83.170.1 só é alcançável se (a) host físico estiver no Tailnet
//    E (b) roteamento for exposto ao container. Por padrão o container NÃO tem.
//    Por isso a rede bridge falha com ENETUNREACH / ECONNREFUSED / UND_ERR_CONNECT_TIMEOUT.
//
// 2) Opção A (primária, menos lock-in): expor 9Router via URL pública (https)
//    usando Tailscale Funnel / Cloudflare Tunnel / Nginx+TLS e configurar
//    NINEROUTER_URL=https://<dominio>/v1. Ver docs/deploy-zimaos.md.
//    Vantagem: funciona em qualquer host, sem sidecar, sem CGNAT.
//    Desvantagem: requer domínio + TLS + chave Bearer.
//
// 3) Opção B (privada): Tailscale sidecar — ver docker-compose.override.tailscale.yml
//    Roda `tailscale/tailscale` ao lado do app e compartilha network.
//    Vantagem: mantém privado. Desvantagem: authkey, up manual, overhead.
//
// 4) Opção C (fallback automático): quando NINEROUTER_URL contém 100.83.170.1
//    e falha por rede, tenta host.docker.internal:20128/v1 — útil quando
//    9Router roda no MESMO host físico mas fora do Tailnet do container.
//    Requer extra_hosts: ["host.docker.internal:host-gateway"] (Compose v2+).
//    Implementado aqui como fallback sequencial com log warn.
//
// Notas standalone: env é lido em RUNTIME dentro da função, não no topo do
// módulo, para evitar congelar valor de build-time em `output: standalone`.
// =============================================================================

export const FALLBACK_TAILSCALE_URL = "http://100.83.170.1:20128/v1";
export const FALLBACK_HOST_DOCKER_URL = "http://host.docker.internal:20128/v1";

export const NINE_TIMEOUT_MS = 25_000;
export const NINE_RETRY_DELAY_MS = 2000;

export type NinerouterConfig = {
  url: string;
  model: string;
  key: string; // trimmed, may be empty
  hasKey: boolean;
};

export function getNinerouterConfig(): NinerouterConfig {
  const url = (process.env.NINEROUTER_URL?.trim() || FALLBACK_TAILSCALE_URL).replace(/\/$/, "");
  // Ensure /v1 suffix? keep as-is but normalize.
  const model = (process.env.NINEROUTER_MODEL?.trim() || "ollama/gpt-oss:120b").trim();
  const key = (process.env.NINEROUTER_KEY?.trim() || "");
  return {
    url,
    model,
    key,
    hasKey: key.length > 0,
  };
}

export function isTailscaleCgnatUrl(url: string): boolean {
  // Spec wants detection de "100.83.170.1". Also cover CGNAT broadly.
  return url.includes("100.83.170.1") || /100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(url);
}

export function getAlternativeUrl(url: string): string | null {
  if (url.includes("100.83.170.1")) {
    return FALLBACK_HOST_DOCKER_URL;
  }
  return null;
}

// Extrai código de erro de fetch nativo (undici em Node 22)
// Erros típicos: TypeError: fetch failed + cause {code: 'ECONNREFUSED'} etc.
// Timeout via AbortSignal -> DOMException AbortError
export function extractErrorCode(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "ABORT_TIMEOUT";
  }
  if (error instanceof Error) {
    // Node undici usa error.cause
    const cause = (error as unknown as { cause?: unknown }).cause as Record<string, unknown> | undefined;
    if (cause) {
      const code = (cause as { code?: string }).code;
      if (typeof code === "string" && code) return code;
      const nested = (cause as unknown as { cause?: unknown })?.cause;
      if (nested && typeof (nested as { code?: unknown }).code === "string") {
        const causeCode = (nested as { code: string }).code;
        if (causeCode) return causeCode;
      }
      // sometimes cause is Error with message containing code
      if (cause instanceof Error && cause.message) {
        const m = cause.message.match(/([A-Z_]+_TIMEOUT|[A-Z_]+_REFUSED|[A-Z_]+UNREACH|[A-Z_]+NOTFOUND)/);
        if (m) return m[1];
      }
    }
    // Direct code on error
    const direct = (error as unknown as { code?: string }).code;
    if (typeof direct === "string" && direct) return direct;
    // Fallback: parse message
    const msg = error.message || "";
    if (msg.includes("UND_ERR_CONNECT_TIMEOUT")) return "UND_ERR_CONNECT_TIMEOUT";
    if (msg.includes("ECONNREFUSED")) return "ECONNREFUSED";
    if (msg.includes("ENETUNREACH")) return "ENETUNREACH";
    if (msg.includes("ETIMEDOUT")) return "ETIMEDOUT";
    if (msg.includes("ENOTFOUND")) return "ENOTFOUND";
    if (msg.includes("EAI_AGAIN")) return "EAI_AGAIN";
    if (msg.includes("AbortError") || msg.includes("aborted")) return "ABORT_TIMEOUT";
    if (msg.includes("timeout")) return "ABORT_TIMEOUT";
    return error.name || "UNKNOWN";
  }
  return "UNKNOWN";
}

export function isNetworkErrorCode(code: string): boolean {
  return [
    "UND_ERR_CONNECT_TIMEOUT",
    "ETIMEDOUT",
    "ENETUNREACH",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ABORT_TIMEOUT",
    "ECONNRESET",
    "UND_ERR_SOCKET",
  ].includes(code);
}

// Decide se deve retry (apenas rede/timeout, não 401/429/400)
export function shouldRetryForHttpStatus(status: number): boolean {
  // Não retry para auth / rate / bad request
  if (status === 401 || status === 400 || status === 429) return false;
  // Retry para 5xx e 408/502/503/504 são candidatos, mas spec pede retry apenas para rede/timeout,
  // então retornamos false aqui. O retry usado é apenas para erros de rede/timeout de fetch,
  // não para HTTP status. Mantemos explícito.
  return false;
}

export type TranslationErrorCode =
  | "translation_provider_unconfigured"
  | "translation_provider_timeout"
  | "translation_provider_unreachable"
  | `translation_provider_http_${number}`
  | "translation_provider_empty"
  | "translation_provider_invalid_json";

export type TranslationError = Error & {
  code: TranslationErrorCode;
  status: number; // http status to return
  details?: string;
  causeCode?: string;
};

export function createTranslationError(
  code: TranslationErrorCode,
  status: number,
  message: string,
  extras?: { details?: string; causeCode?: string }
): TranslationError {
  const err = new Error(message) as TranslationError;
  err.code = code;
  err.status = status;
  if (extras?.details) err.details = extras.details;
  if (extras?.causeCode) err.causeCode = extras.causeCode;
  return err;
}

export function mapHttpErrorStatus(status: number, bodySnippet: string): TranslationError {
  const code = `translation_provider_http_${status}` as TranslationErrorCode;
  // Mensagem com body truncado (500 chars) conforme spec
  const truncated = bodySnippet ? bodySnippet.slice(0, 500) : "sem body";
  return createTranslationError(code, 502, `${code}: ${truncated}`, { details: truncated });
}

export function getStatusForCode(code: TranslationErrorCode): number {
  if (code === "translation_provider_timeout") return 504;
  if (code === "translation_provider_unreachable") return 502;
  if (code === "translation_provider_unconfigured") return 503;
  if (code.startsWith("translation_provider_http_")) return 502;
  if (code === "translation_provider_empty") return 502;
  if (code === "translation_provider_invalid_json") return 502;
  return 500;
}

// Core fetch with timeout using AbortSignal.timeout; includes retry with backoff for network/timeout.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Prefer AbortSignal.timeout if available (Node 22+)
    // Mas usa controller para compatibilidade com manual abort.
    // Se init.signal já tem timeout, combina? Simplifica: usa AbortSignal.timeout when possible
    // Fallback to controller.
    const signal = (init.signal as AbortSignal | undefined) ?? controller.signal;
    // Se usamos AbortSignal.timeout, precisamos mesclar? Simplifica: usar timeout via controller.
    return await fetch(url, { ...init, signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Tenta fetch sequencial com fallback host.docker.internal quando aplicável.
// Retorna { response, usedFallback, attemptedUrls }
export async function fetchNinerouterWithFallback(
  path: string, // e.g. "/chat/completions" or "/models"
  init: RequestInit,
  timeoutMs: number
): Promise<{ response: Response; usedFallback: boolean; attemptedUrl: string; fallbackAttempted: boolean; fallbackErrorCode?: string }> {
  const { url: primaryUrl } = getNinerouterConfig();
  const primaryFull = `${primaryUrl.replace(/\/$/, "")}${path}`;
  const altBase = getAlternativeUrl(primaryUrl);
  const altFull = altBase ? `${altBase.replace(/\/$/, "")}${path}` : null;

  const tryFetch = async (fullUrl: string) => {
    // Use AbortSignal.timeout when available (cleaner)
    let signal: AbortSignal | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeTimeout = (AbortSignal as any).timeout?.bind(AbortSignal);
      if (maybeTimeout) signal = maybeTimeout(timeoutMs) as AbortSignal;
    } catch {
      // ignore
    }
    if (!signal) {
      // fallback manual
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      signal = ctrl.signal;
      // ensure cleanup happens via finally in caller
      // We'll just fetch and clear via inner logic
      // For simplicity, not tracking t; the outer catch will handle
      // Use direct fetch with signal; timeout will abort via ctrl.
      // Need to clear after fetch — handle below.
      // For now, just use ctrl signal and rely on fetch timeout handling
      // (t will fire). We'll clear via setTimeout not ideal but okay.
      // Instead we handle via fetchWithTimeout helper:
      return fetchWithTimeout(fullUrl, { ...init, signal }, timeoutMs);
    }
    return fetch(fullUrl, { ...init, signal });
  };

  let lastError: unknown = null;
  let fallbackAttempted = false;

  try {
    const res = await tryFetch(primaryFull);
    return { response: res, usedFallback: false, attemptedUrl: primaryFull, fallbackAttempted: false };
  } catch (e) {
    lastError = e;
    const code = extractErrorCode(e);
    const isNetwork = isNetworkErrorCode(code);
    // Se é erro de rede e temos fallback, tenta fallback automaticamente
    if (isNetwork && altFull) {
      fallbackAttempted = true;
      console.warn(`warn: ninerouter fallback host.docker.internal — primary ${primaryFull} failed with ${code}, trying ${altFull}`);
      try {
        const res2 = await tryFetch(altFull);
        return { response: res2, usedFallback: true, attemptedUrl: altFull, fallbackAttempted: true };
      } catch (e2) {
        const code2 = extractErrorCode(e2);
        // Propaga erro com fallback info
        const wrapped = e2 as Error & { fallbackErrorCode?: string };
        (wrapped as unknown as Record<string, unknown>).fallbackErrorCode = code2;
        // Lança erro que indica falha em ambos
        throw Object.assign(e2 as object, { causeCode: code, attemptedUrl: primaryFull, fallbackUrl: altFull, fallbackErrorCode: code2 });
      }
    }
    // Sem fallback ou não-network, propaga
    throw Object.assign(e as object, { causeCode: code, attemptedUrl: primaryFull });
  }
}

// Helper para tradução com retry (1 retry com backoff 2s apenas rede/timeout)
export async function fetchNinerouterWithRetry(
  path: string,
  init: RequestInit,
  timeoutMs: number = NINE_TIMEOUT_MS
): Promise<Response> {
  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < 2) {
    try {
      const { response } = await fetchNinerouterWithFallback(path, init, timeoutMs);
      return response;
    } catch (e) {
      lastErr = e;
      const code = extractErrorCode(e) || (e as { causeCode?: string })?.causeCode || "";
      const isNet = isNetworkErrorCode(code) || code === "ABORT_TIMEOUT";
      if (!isNet) throw e; // não retry para 401/429/400 e outros não-rede (mas e é exception, não status)
      if (attempt === 0) {
        // backoff 2s
        await new Promise((r) => setTimeout(r, NINE_RETRY_DELAY_MS));
        attempt++;
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

// Probe para endpoint /health
export type ProbeResult = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  usedFallback?: boolean;
  attemptedUrl?: string;
};

export async function probeNinerouterModels(timeoutMs = 5000): Promise<ProbeResult> {
  const { url, hasKey } = getNinerouterConfig();
  const start = Date.now();
  const headers: Record<string, string> = {};
  // /models é público em muitos, mas se tem key usa Bearer
  const cfg = getNinerouterConfig();
  if (cfg.hasKey) headers["Authorization"] = `Bearer ${cfg.key}`;
  try {
    const { response, usedFallback, attemptedUrl } = await fetchNinerouterWithFallback("/models", { method: "GET", headers }, timeoutMs);
    const latencyMs = Date.now() - start;
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      errorCode: response.ok ? null : `HTTP_${response.status}`,
      errorMessage: response.ok ? null : `status ${response.status}`,
      usedFallback,
      attemptedUrl,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const code = extractErrorCode(e) || (e as { causeCode?: string })?.causeCode || "UNKNOWN";
    const msg = e instanceof Error ? e.message : String(e);
    // Try to get attemptedUrl from error augmentation
    const attemptedUrl = (e as { attemptedUrl?: string })?.attemptedUrl || `${url}/models`;
    const fallbackAttempted = (e as { fallbackErrorCode?: string })?.fallbackErrorCode ? true : false;
    return {
      ok: false,
      status: null,
      latencyMs,
      errorCode: code,
      errorMessage: msg.slice(0, 500),
      usedFallback: fallbackAttempted,
      attemptedUrl,
    };
  }
}

export async function probeNinerouterChat(timeoutMs = 8000): Promise<ProbeResult & { responseSnippet?: string }> {
  const cfg = getNinerouterConfig();
  const start = Date.now();
  const body = JSON.stringify({
    model: cfg.model,
    messages: [{ role: "user", content: "ping" }],
    stream: false,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.hasKey) headers["Authorization"] = `Bearer ${cfg.key}`;
  try {
    const { response, usedFallback, attemptedUrl } = await fetchNinerouterWithFallback(
      "/chat/completions",
      { method: "POST", headers, body },
      timeoutMs
    );
    const latencyMs = Date.now() - start;
    let snippet: string | undefined;
    if (!response.ok) {
      try {
        const txt = await response.text();
        snippet = txt.slice(0, 500);
      } catch {}
    } else {
      try {
        const txt = await response.text();
        snippet = txt.slice(0, 200);
      } catch {}
    }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      errorCode: response.ok ? null : `HTTP_${response.status}`,
      errorMessage: response.ok ? null : `status ${response.status}`,
      usedFallback,
      attemptedUrl,
      responseSnippet: snippet,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const code = extractErrorCode(e) || (e as { causeCode?: string })?.causeCode || "UNKNOWN";
    const msg = e instanceof Error ? e.message : String(e);
    const attemptedUrl = (e as { attemptedUrl?: string })?.attemptedUrl || `${cfg.url}/chat/completions`;
    return {
      ok: false,
      status: null,
      latencyMs,
      errorCode: code,
      errorMessage: msg.slice(0, 500),
      usedFallback: false,
      attemptedUrl,
    };
  }
}

export function suggestFixForProbe(modelsProbe: ProbeResult, chatProbe: ProbeResult, cfg: NinerouterConfig): string | null {
  const code = modelsProbe.errorCode || chatProbe.errorCode || "";
  const isUnreachable = ["ENETUNREACH", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "ENOTFOUND", "EAI_AGAIN", "ABORT_TIMEOUT"].includes(code);
  const isTailscale = isTailscaleCgnatUrl(cfg.url);
  if (isUnreachable && isTailscale) {
    return "NINEROUTER_URL usa IP Tailscale CGNAT (100.64/10) inalcançável do container bridge padrão. Soluções: (A) Expor 9Router via URL pública (Tailscale Funnel: `tailscale funnel 20128` ou Cloudflare Tunnel) e configurar NINEROUTER_URL=https://.../v1; (B) Usar sidecar Tailscale (docker-compose.override.tailscale.yml); (C) Se 9Router está no mesmo host, fallback automático para host.docker.internal já tenta, mas requer extra_hosts: [\"host.docker.internal:host-gateway\"]. Ver docs/deploy-zimaos.md";
  }
  if (isUnreachable) {
    return "9Router inalcançável. Verifique NINEROUTER_URL, firewall, se o serviço está ouvindo em 0.0.0.0:20128 e se o container tem rota (extra_hosts host.docker.internal).";
  }
  if (code?.startsWith("HTTP_401") || code === "HTTP_401") return "Autenticação falhou (401). Verifique NINEROUTER_KEY.";
  if (code?.startsWith("HTTP_429")) return "Rate limit (429). Aguarde ou troque modelo/chave.";
  return null;
}
