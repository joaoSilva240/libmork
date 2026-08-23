// =============================================================================
// Libmork — API Route: Mutações do Mestre sobre NPC da Campanha (RF-049)
// =============================================================================
// PATCH: altera HP/Mana/XP/nível do NPC da campanha e registra logs.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  getCampaignAsMaster,
  isNpcInCampaign,
} from "@/lib/auth/campaign-access";
import { updateActorSchema } from "@/lib/validators/session";
import { applyNpcUpdate } from "@/lib/server/session-actions";

type RouteContext = { params: Promise<{ id: string; npcId: string }> };

/**
 * PATCH /api/campaigns/:id/npcs/:npcId/session
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

    const { id, npcId } = await params;

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const belongs = await isNpcInCampaign(npcId, id);

    if (!belongs) {
      return NextResponse.json(
        { success: false, error: "NPC não pertence a esta campanha" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateActorSchema.safeParse(body);

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

    const result = await applyNpcUpdate(id, npcId, session.user.id, validation.data);

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      logs: result.logs,
    });
  } catch (error) {
    console.error("Erro ao atualizar NPC da campanha:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
