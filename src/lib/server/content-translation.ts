import {
  getNinerouterConfig,
  fetchNinerouterWithFallback,
  extractErrorCode,
  isNetworkErrorCode,
  createTranslationError,
  mapHttpErrorStatus,
  NINE_TIMEOUT_MS,
  NINE_RETRY_DELAY_MS,
} from "./ninerouter";
import { logger } from "@/lib/logger";

/**
 * Translates content (items, spells, classes, npcs) from English to Brazilian Portuguese
 * using NINEROUTER (OpenAI-compatible API).
 *
 * Reads NINEROUTER_* variables at runtime (required for standalone output).
 * Uses AbortController with 25s timeout. Falls back to host.docker.internal
 * if Tailscale CGNAT URL (100.83.170.1) is unreachable.
 *
 * @param contentType - "spell" | "item" | "class" | "npc" | string
 * @param content - The content object to translate
 * @param systemPrompt - Optional custom system prompt (uses default if not provided)
 * @returns Translated content object
 * @throws TranslationError with granular error code for client handling
 */
export async function translateContentWithLLM(
  contentType: "spell" | "item" | "class" | "npc" | "race" | string,
  content: Record<string, unknown>,
  systemPrompt?: string,
): Promise<Record<string, unknown>> {
  // Runtime env reading (required for output: standalone builds)
  const { url: ninerouterUrl, model: ninerouterModel, key } = getNinerouterConfig();

  if (!key) {
    throw createTranslationError("translation_provider_unconfigured", 503, "translation_provider_unconfigured");
  }

  // Use custom prompt if provided, otherwise build default
  const prompt = systemPrompt ?? (() => {
    if (contentType === "item") {
      return `Translate this tabletop RPG item SF2e/PF2e from English to Brazilian Portuguese. Return JSON only, preserving the same fields. Translate name, description, and all relevant textual fields. Preserve technical SF2e/PF2e terms, numbers, formulas, units, proper names, and structured data. Do not add fields or commentary.`;
    }
    if (contentType === "class") {
      return `Translate this tabletop RPG class and its progression benefits from English to Brazilian Portuguese (pt-BR). Return JSON only, preserving the exact JSON structure and keys. Translate name, description, proficiencies, item names, and level benefit descriptions/advantages. Do not add fields or commentary.`;
    }
    if (contentType === "npc") {
      return `Translate this tabletop RPG NPC/monster from English to Brazilian Portuguese. Return JSON only, preserving the same fields. Translate name, description, actions and skills. Do not add fields or commentary.`;
    }
    if (contentType === "race") {
      return `Translate this tabletop RPG race/ancestry from English to Brazilian Portuguese (pt-BR). Return JSON only, preserving the exact JSON structure and keys. Translate name, description, traits (names and descriptions), heritages (names and descriptions), and languages. Do not add fields or commentary.`;
    }
    return `Translate this tabletop RPG magia PF2e from English to Brazilian Portuguese. Return JSON only, preserving the same fields. Translate name, description, and all relevant textual fields. Preserve technical SF2e/PF2e terms, numbers, formulas, units, proper names, and structured data. Do not add fields or commentary.`;
  })();

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };

  const body = JSON.stringify({
    model: ninerouterModel,
    messages: [
      { role: "system" as const, content: prompt },
      { role: "user" as const, content: JSON.stringify(content) },
    ],
    response_format: { type: "json_object" as const },
    stream: false,
  });

  const start = Date.now();
  let lastError: unknown = null;

  const doFetch = async () => {
    const { response, usedFallback, attemptedUrl } = await fetchNinerouterWithFallback(
      "/chat/completions",
      { method: "POST", headers, body },
      NINE_TIMEOUT_MS, // 25s timeout via AbortController
    );

    if (!response.ok) {
      let upstreamSnippet = "";
      try {
        const txt = await response.text();
        upstreamSnippet = txt.slice(0, 500);
      } catch {}

      const status = response.status;

      // Don't retry for auth/rate/bad request
      if (status === 401 || status === 400 || status === 429) {
        throw mapHttpErrorStatus(status, upstreamSnippet);
      }

      // For other HTTP errors (5xx, etc.) - don't retry by spec
      throw mapHttpErrorStatus(status, upstreamSnippet);
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch (e) {
      const code = extractErrorCode(e);
      logger.error({ 
        err: e,
        attemptedUrl: usedFallback ? `${ninerouterUrl}/v1 (fallback)` : ninerouterUrl,
        contentType,
        causeCode: code,
      }, 'content-translation JSON parse error');
      throw createTranslationError("translation_provider_invalid_json", 502, `translation_provider_invalid_json: ${code}`, {
        causeCode: code,
      });
    }

    const raw = (result as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || !raw.trim()) {
      throw createTranslationError("translation_provider_empty", 502, "translation_provider_empty");
    }

    // Extract JSON from code fence if present
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? raw;

    try {
      return JSON.parse(fenced.trim()) as Record<string, unknown>;
    } catch (e) {
      const code = extractErrorCode(e);
      logger.error({
        err: e,
        attemptedUrl: usedFallback ? `${ninerouterUrl}/v1 (fallback)` : ninerouterUrl,
        contentType,
        causeCode: code,
      }, 'content-translation JSON parse failed');
      throw createTranslationError("translation_provider_invalid_json", 502, `translation_provider_invalid_json: ${code}`, {
        causeCode: code,
      });
    }
  };

  // Try up to 2 times (initial + 1 retry for network errors)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await doFetch();
      const durationMs = Date.now() - start;
      logger.info({ 
        contentType,
        durationMs,
        url: ninerouterUrl,
        usedFallback: false,
      }, 'content-translation translated successfully');
      return parsed;
    } catch (error) {
      lastError = error;
      const code = extractErrorCode(error);
      const transCode = (error as { code?: string })?.code as string | undefined;

      // Don't retry for specific HTTP error codes
      if (transCode && (transCode === "translation_provider_http_401" || transCode === "translation_provider_http_429" || transCode === "translation_provider_http_400")) {
        throw error;
      }

      const isTimeout = transCode === "translation_provider_timeout" || code === "ABORT_TIMEOUT";
      const isUnreachable = transCode === "translation_provider_unreachable" || isNetworkErrorCode(code);
      const isNetwork = isUnreachable || isTimeout;

      // Retry once for network/timeout errors
      if (isNetwork && attempt === 0) {
        const durationMs = Date.now() - start;
        logger.warn({ 
          code, 
          transCode, 
          attempt: attempt + 1, 
          durationMs 
        }, 'content-translation retry after network error');
        await new Promise((r) => setTimeout(r, NINE_RETRY_DELAY_MS));
        continue;
      }

      // Map network errors to appropriate error codes
      if (isNetwork) {
        if (code === "ABORT_TIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT" || code === "ETIMEDOUT") {
          throw createTranslationError("translation_provider_timeout", 504, "translation_provider_timeout", {
            causeCode: code,
          });
        }
        if (["ENETUNREACH", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"].includes(code)) {
          throw createTranslationError("translation_provider_unreachable", 502, "translation_provider_unreachable", {
            causeCode: code,
          });
        }
        const isAbort = code === "ABORT_TIMEOUT";
        throw createTranslationError(
          isAbort ? "translation_provider_timeout" : "translation_provider_unreachable",
          isAbort ? 504 : 502,
          isAbort ? "translation_provider_timeout" : "translation_provider_unreachable",
          { causeCode: code }
        );
      }

      throw error;
    }
  }

  // If we get here, re-throw the last error
  throw lastError;
}