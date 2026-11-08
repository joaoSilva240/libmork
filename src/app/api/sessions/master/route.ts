// =============================================================================
// Libmork — API Route: Sessões do Mestre (Issue #63)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listMasterSessions } from "@/lib/server/session-service";
import { logger } from "@/lib/logger";

/**
 * GET /api/sessions/master
 * Todas as sessões das campanhas do mestre autenticado.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const sessions = await listMasterSessions(session.user.id);
    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar sessões do mestre");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
