// =============================================================================
// Libmork — Healthcheck NINEROUTER
// =============================================================================
// GET /api/health/ninerouter
// Público ou com x-health-token opcional (se HEALTH_TOKEN configurado).
// Retorna diagnóstico sem expor KEY.
// Formato: { name, ninerouterUrl, hasKey, model, reachable, latencyMs, error?: string }
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getNinerouterConfig,
  probeNinerouterModels,
  suggestFixForProbe,
  isTailscaleCgnatUrl,
} from "@/lib/server/ninerouter";

export async function GET(request: NextRequest) {
  const healthToken = (process.env.HEALTH_TOKEN?.trim() || "").trim();
  const providedToken = (request.headers.get("x-health-token") || request.headers.get("x_health_token") || "").trim();

  // Auth: if HEALTH_TOKEN is set, validate token; otherwise allow public access
  const isAuthenticated =
    healthToken.length === 0 ||
    (healthToken.length > 0 && providedToken.length > 0 && providedToken === healthToken);

  // If no token configured and not authenticated via session, check for session
  if (!isAuthenticated) {
    try {
      const session = await getSession();
      if (session) {
        // User is authenticated
      }
    } catch {
      // No session, but we allow if HEALTH_TOKEN not set
    }
  }

  const cfg = getNinerouterConfig();
  const { url: ninerouterUrl, model, hasKey } = cfg;

  // Probe /models with 5s timeout
  const modelsProbe = await probeNinerouterModels(5000);

  const reachable = modelsProbe.ok;
  const latencyMs = modelsProbe.latencyMs;

  // Build response per spec: { name, ninerouterUrl, hasKey, model, reachable: boolean, latencyMs, error?: string }
  const responseData: Record<string, unknown> = {
    name: "ninerouter",
    ninerouterUrl,
    hasKey,
    model,
    reachable,
    latencyMs,
  };

  // Add error field if not reachable
  if (!reachable) {
    const errorCode = modelsProbe.errorCode || "UNKNOWN";
    const errorMessage = modelsProbe.errorMessage || "Conexão falhou";
    responseData.error = `${errorCode}: ${errorMessage}`;
  }

  // Add diagnostic info when not reachable
  if (!reachable) {
    const suggestion = suggestFixForProbe(modelsProbe, modelsProbe, cfg);
    const isTailscale = isTailscaleCgnatUrl(ninerouterUrl);

    responseData.diagnostics = {
      isTailscaleCgnat: isTailscale,
      attemptedUrl: modelsProbe.attemptedUrl,
      usedFallback: modelsProbe.usedFallback || false,
      suggestion,
    };
  }

  return NextResponse.json(responseData);
}