// =============================================================================
// Libmork — API Route: Criação/Obtenção de DM 1:1 (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getOrCreateDmGroup } from "@/lib/server/chat-service";
import { createDmSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

/**
 * POST /api/chat/dm
 * Busca ou cria o grupo de DM 1:1 com outro usuário.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createDmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const group = await getOrCreateDmGroup(session.user.id, parsed.data.userId);
    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Usuário não encontrado") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message === "Não é possível iniciar um chat consigo mesmo") {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    logger.error({ err: error }, "Erro ao criar/obter DM");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
