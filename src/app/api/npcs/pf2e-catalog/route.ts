// =============================================================================
// Libmork — API Route: Catálogo Completo de Monstros Pathfinder 2e
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { fetchPf2eMonsterCatalog } from "@/lib/content/pf2e-monsters";

/**
 * GET /api/npcs/pf2e-catalog
 * Retorna a lista dos monstros disponíveis nos packs Bestiary do Pathfinder 2e no Foundry repository.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const results = await fetchPf2eMonsterCatalog();

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Erro ao carregar catálogo Pathfinder 2e:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
