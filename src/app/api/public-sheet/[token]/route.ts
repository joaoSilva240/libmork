// =============================================================================
// Libmork — API Route: Ficha Pública Off-Session (RF-023, D-05, Issue #79)
// =============================================================================
// Retorna apenas a frente off-session (portrait, identidade, narrativa) via
// token de visualização. SEM autenticação e sem dados operacionais privados.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getPublicOffSession } from "@/lib/server/character-share-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/public-sheet/:token
 * Frente pública off-session do personagem (somente leitura).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;
    const data = await getPublicOffSession(token);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    if (message === "Link inválido ou revogado" || message === "Personagem não encontrado") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, 'Erro ao obter ficha pública');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
