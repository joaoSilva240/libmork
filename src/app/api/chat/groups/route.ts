// =============================================================================
// Libmork — API Route: Grupos de Chat do Usuário (Issue #62)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listUserChatGroups } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

/**
 * GET /api/chat/groups
 * Retorna todos os grupos de conversa de campanhas que o usuário participa.
 */
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const groups = await listUserChatGroups(session.user.id);

    return NextResponse.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar grupos de chat");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
