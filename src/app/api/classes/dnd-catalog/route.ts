// =============================================================================
// Libmork — API Route: Catálogo de Classes D&D 5e (dnd5eapi.co)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * GET /api/classes/dnd-catalog
 * Retorna o catálogo oficial das classes disponíveis no D&D 5e API.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const res = await fetch("https://www.dnd5eapi.co/api/classes", {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: "Erro ao consultar API D&D 5e" },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      count: data.count,
      results: data.results, // Array de { index, name, url }
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar catálogo de classes D&D 5e");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
