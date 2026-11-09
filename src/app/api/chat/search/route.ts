// =============================================================================
// Libmork — API Route: Busca de Menções do Chat (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { searchChatMentions } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

/**
 * GET /api/chat/search?q=<termo>&groupId=<opcional>
 * Busca usuários e itens da biblioteca global para o autocomplete de @
 * (mín. 3 caracteres).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const groupId = request.nextUrl.searchParams.get("groupId") ?? undefined;
    if (q.length < 3) {
      return NextResponse.json(
        { success: false, error: "A busca exige ao menos 3 caracteres" },
        { status: 400 },
      );
    }
    const found = await searchChatMentions(q, session.user.id, groupId);
    return NextResponse.json({ success: true, data: found });
  } catch (error) {
    logger.error({ err: error }, "Erro ao buscar menções do chat");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
