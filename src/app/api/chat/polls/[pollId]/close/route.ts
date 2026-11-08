// =============================================================================
// Libmork — API Route: Encerrar Enquete (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { closePoll } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ pollId: string }> };

/**
 * PATCH /api/chat/polls/:pollId/close
 * Encerra uma enquete ativa (apenas mestre ou criador).
 */
export async function PATCH(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { pollId } = await params;
    const closedPoll = await closePoll(pollId, session.user.id);

    return NextResponse.json({
      success: true,
      data: closedPoll,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    if (message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    logger.error({ err: error }, "Erro ao encerrar enquete");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
