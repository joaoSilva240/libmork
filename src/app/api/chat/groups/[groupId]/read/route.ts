// =============================================================================
// Libmork — API Route: Marcar Grupo de Chat como Lido (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { markGroupAsRead } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ groupId: string }> };

/**
 * POST /api/chat/groups/:groupId/read
 * Atualiza o lastReadAt do membro para zerar as notificações de não lidas.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { groupId } = await params;
    await markGroupAsRead(groupId, session.user.id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao marcar grupo como lido");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
