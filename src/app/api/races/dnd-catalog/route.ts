// =============================================================================
// Libmork — API Route: Catálogo de Raças D&D 5e (dnd5eapi.co)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * GET /api/races/dnd-catalog
 * Retorna a lista de raças oficiais do D&D 5e da API dnd5eapi.co.
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

    const res = await fetch("https://www.dnd5eapi.co/api/races", {
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
    logger.error({ err: error }, "Erro ao carregar catálogo de raças D&D 5e");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
