// =============================================================================
// Libmork — API Route: Membros do Grupo de Chat (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listGroupMembers } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ groupId: string }> };

/**
 * GET /api/chat/groups/:groupId/members
 * Lista os membros do grupo e suas permissões (requer membership).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { groupId } = await params;
    const members = await listGroupMembers(groupId, session.user.id);
    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Você não é membro deste grupo") {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    logger.error({ err: error }, "Erro ao listar membros do grupo");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
