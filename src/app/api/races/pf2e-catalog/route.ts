// =============================================================================
// Libmork — API Route: Catálogo de Ancestralidades Pathfinder 2e
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { PF2E_RACES } from "@/lib/content/pf2e-races";
import { logger } from "@/lib/logger";

/**
 * GET /api/races/pf2e-catalog
 * Retorna o catálogo oficial das 14 ancestralidades do Pathfinder 2e.
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

    const results = PF2E_RACES.map((race) => ({
      key: race.key,
      name: race.name,
      description: race.description,
      hitPointsBonus: race.hitPointsBonus,
      speed: race.speed,
      size: race.size,
      attributeBonuses: race.attributeBonuses,
      languages: race.languages,
      traitsCount: race.traits.length,
      heritagesCount: race.heritages.length,
    }));

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar catálogo Pathfinder 2e");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
