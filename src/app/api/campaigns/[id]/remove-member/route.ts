// =============================================================================
// Libmork — API Route: Remover Usuário da Campanha (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { removeUserFromCampaign } from "@/lib/server/chat-service";
import { removeCampaignMemberSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/campaigns/:id/remove-member
 * Remove um usuário da campanha (revoga convite, desvincula personagens
 * e remove do grupo de chat). Somente o mestre da campanha.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = removeCampaignMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    await removeUserFromCampaign(id, session.user.id, parsed.data.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Apenas o Mestre pode remover usuários da campanha") {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Campanha não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao remover usuário da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
