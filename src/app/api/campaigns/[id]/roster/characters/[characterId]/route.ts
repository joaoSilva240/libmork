// =============================================================================
// Libmork — API Route: Mutações do Mestre sobre Personagem da Campanha (RF-049)
// =============================================================================
// PATCH: altera HP/Mana/XP/nível/condições do personagem e registra logs.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { updateActorSchema } from "@/lib/validators/session";
import { applyCharacterUpdate } from "@/lib/server/session-actions";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; characterId: string }> };

/**
 * PATCH /api/campaigns/:id/roster/characters/:characterId
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

    const { id, characterId } = await params;

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const [link] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.campaignId, id),
          eq(characterCampaigns.characterId, characterId)
        )
      )
      .limit(1);

    if (!link) {
      return NextResponse.json(
        { success: false, error: "Personagem não está nesta campanha" },
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

    const result = await applyCharacterUpdate(id, characterId, session.user.id, validation.data);

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      logs: result.logs,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar personagem da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
