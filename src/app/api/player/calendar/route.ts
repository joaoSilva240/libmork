// =============================================================================
// Libmork — API Route: Calendário Pessoal do Jogador (Issue #63)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listPlayerCalendar } from "@/lib/server/session-service";
import { logger } from "@/lib/logger";

/**
 * GET /api/player/calendar
 * Sessões confirmadas em que o jogador foi aceito.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const entries = await listPlayerCalendar(session.user.id);
    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar calendário do jogador");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
