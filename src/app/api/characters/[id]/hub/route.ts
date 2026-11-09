// =============================================================================
// Libmork — API Route: Hub Off-Session do Personagem (Issue #79)
// =============================================================================
// Identidade, narrativa, progresso de XP e sessão ativa para a tela hub.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getCharacterHub } from "@/lib/server/character-share-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/characters/:id/hub
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const hub = await getCharacterHub(id, session.user.id);
    return NextResponse.json({ success: true, data: hub });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    if (message === "Personagem não encontrado") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao carregar hub do personagem");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
