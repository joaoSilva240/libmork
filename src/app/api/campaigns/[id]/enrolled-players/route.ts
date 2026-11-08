// =============================================================================
// Libmork — API Route: Jogadores Inscritos na Campanha (Issue #63)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSessionContext } from "@/lib/server/session-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/enrolled-players
 * Jogadores com personagens aprovados na campanha (somente o mestre).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const context = await getSessionContext(id, session.user.id);
    return NextResponse.json({ success: true, data: context.enrolledPlayers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Campanha não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    logger.error({ err: error }, "Erro ao listar jogadores inscritos");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
