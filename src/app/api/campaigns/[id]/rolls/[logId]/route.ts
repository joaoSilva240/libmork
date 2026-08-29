// =============================================================================
// Libmork — API Route: Resultado de Rolagem (RF-041 — rolagem assistida)
// =============================================================================
// PATCH: preenche o resultado de uma rolagem requisitada no log.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { rollResultSchema } from "@/lib/validators/session";
import { fillRollResult } from "@/lib/server/session-actions";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; logId: string }> };

/**
 * PATCH /api/campaigns/:id/rolls/:logId
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, logId } = await params;

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = rollResultSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await fillRollResult(logId, validation.data.result, validation.data.description);

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    logger.error({ err: error }, "Erro ao preencher resultado da rolagem");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
