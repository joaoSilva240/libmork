import { logger } from "@/lib/logger";

/**
 * Server-only configuration for Kavita OPDS.
 * Never expose KAVITA_OPDS_KEY or raw authorization headers to the client.
 */
export const DEFAULT_KAVITA_URL = "http://100.122.171.83:5150";
export const KAVITA_TIMEOUT_MS = 15000;

export interface KavitaConfig {
  baseUrl: string;
  apiKey: string;
  isConfigured: boolean;
}

export function normalizeKavitaUrl(urlStr: string): string {
  let trimmed = (urlStr || "").trim();
  if (!trimmed) {
    trimmed = DEFAULT_KAVITA_URL;
  }
  // Corrige URL malformada tipo "http:100.122.171.83:5150" ou "https:100..."
  if (/^https?:[^\/]/i.test(trimmed)) {
    trimmed = trimmed.replace(/^(https?):/i, "$1://");
  } else if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed.replace(/\/+$/, "");
}

export function getKavitaConfig(): KavitaConfig {
  const baseUrl = normalizeKavitaUrl(process.env.KAVITA_URL || DEFAULT_KAVITA_URL);
  const apiKey = (process.env.KAVITA_OPDS_KEY?.trim() || "");

  return {
    baseUrl,
    apiKey,
    isConfigured: apiKey.length > 0,
  };
}

/**
 * SSRF & URL safety validator
 * Rejects non-HTTP(S), invalid hostnames, AWS metadata, and local loops unless explicitly targeting configured host.
 */
export function validateKavitaTargetUrl(targetUrlStr: string): { valid: boolean; error?: string; url?: URL } {
  try {
    let sanitized = (targetUrlStr || "").trim();
    if (/^https?:[^\/]/i.test(sanitized)) {
      sanitized = sanitized.replace(/^(https?):/i, "$1://");
    }
    const parsed = new URL(sanitized);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, error: "Protocolo inválido. Apenas HTTP/HTTPS são suportados." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Prevent cloud metadata endpoints
    if (
      hostname === "169.254.169.254" ||
      hostname === "metadata.google.internal" ||
      hostname === "100.100.100.100" ||
      hostname.endsWith(".internal")
    ) {
      return { valid: false, error: "Acesso a metadados de nuvem/rede interna proibido." };
    }

    // Local loopback checks (127.0.0.1, localhost, ::1, 0.0.0.0)
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    ) {
      // If the admin purposely configured KAVITA_URL as localhost, allow matching origin only
      const configuredBase = (process.env.KAVITA_URL?.trim() || DEFAULT_KAVITA_URL).toLowerCase();
      if (!configuredBase.includes("localhost") && !configuredBase.includes("127.0.0.1")) {
        return { valid: false, error: "Acesso loopback/localhost bloqueado por segurança SSRF." };
      }
    }

    // Ensure host matches configured Kavita server (defense in depth)
    const config = getKavitaConfig();
    try {
      const configuredHost = new URL(config.baseUrl);
      if (
        hostname !== configuredHost.hostname.toLowerCase() ||
        (parsed.port || (parsed.protocol === "https:" ? "443" : "80")) !==
          (configuredHost.port || (configuredHost.protocol === "https:" ? "443" : "80"))
      ) {
        return { valid: false, error: "Destino fora do servidor Kavita configurado." };
      }
    } catch {
      return { valid: false, error: "Configuração base do Kavita inválida." };
    }

    return { valid: true, url: parsed };
  } catch {
    return { valid: false, error: "URL inválida ou malformada." };
  }
}

/**
 * Safe fetch wrapper with SSRF validation, timeout and header redaction.
 */
export async function safeFetchKavita(
  urlStr: string,
  options: RequestInit = {},
  timeoutMs: number = KAVITA_TIMEOUT_MS
): Promise<Response> {
  const check = validateKavitaTargetUrl(urlStr);
  if (!check.valid || !check.url) {
    throw new Error(check.error || "URL inválida bloqueada por segurança");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlStr, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    // Redact any potential API key from error message or logs
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ error: msg.replace(/[a-zA-Z0-9]{20,}/g, "[REDACTED]") }, "Falha ao conectar com servidor Kavita");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
