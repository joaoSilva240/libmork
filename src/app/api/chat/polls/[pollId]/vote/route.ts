// =============================================================================
// Libmork — API Route: Votar em Enquete (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { votePoll } from "@/lib/server/chat-service";
import { votePollSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ pollId: string }> };

/**
 * POST /api/chat/polls/:pollId/vote
 * Computa o voto do usuário autenticado nas opções da enquete.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { pollId } = await params;
    const body = await request.json();

    const validation = votePollSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const updatedPoll = await votePoll(pollId, session.user.id, validation.data.optionIds);

    return NextResponse.json({
      success: true,
      data: updatedPoll,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    if (message.includes("não é membro") || message.includes("já foi encerrada")) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    logger.error({ err: error }, "Erro ao votar na enquete");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
