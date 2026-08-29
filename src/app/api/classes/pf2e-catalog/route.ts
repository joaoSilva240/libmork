// =============================================================================
// Libmork — API Route: Catálogo de Classes Pathfinder 2e
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { PF2E_CLASSES } from "@/lib/content/pf2e-classes";
import { logger } from "@/lib/logger";

/**
 * GET /api/classes/pf2e-catalog
 * Retorna o catálogo oficial das 23 classes do Pathfinder 2e com atributos chave e características.
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

    const results = PF2E_CLASSES.map((cls) => ({
      key: cls.key,
      name: cls.name,
      keyAttribute: cls.keyAttribute,
      hpPerLevel: cls.hpPerLevel,
      description: cls.description,
      proficiencies: cls.proficiencies,
      initialItemsCount: cls.initialItems.length,
      levelsCount: cls.levels.length,
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
