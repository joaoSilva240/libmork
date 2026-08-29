// =============================================================================
// Libmork — API Route: Operações em Vínculo Personagem-Campanha (RF-011)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns, characters, characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { APPROVAL_STATUSES } from "@/lib/utils/constants";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; linkId: string }> };

const updateLinkSchema = z.object({
  approvalStatus: z.enum(APPROVAL_STATUSES),
});

/**
 * PATCH /api/campaigns/:id/characters/:linkId
 * Atualiza o status de aprovação do vínculo (apenas mestre) — RF-009.
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

    const { id, linkId } = await params;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.id, linkId),
          eq(characterCampaigns.campaignId, id)
        )
      )
      .limit(1);

    if (!existingLink) {
      return NextResponse.json(
        { success: false, error: "Vínculo não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateLinkSchema.safeParse(body);

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

    const [updatedLink] = await db
      .update(characterCampaigns)
      .set({ approvalStatus: validation.data.approvalStatus })
      .where(eq(characterCampaigns.id, linkId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedLink,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar vínculo");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/:id/characters/:linkId
 * Remove o vínculo (mestre da campanha ou dono do personagem).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, linkId } = await params;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.id, linkId),
          eq(characterCampaigns.campaignId, id)
        )
      )
      .limit(1);

    if (!existingLink) {
      return NextResponse.json(
        { success: false, error: "Vínculo não encontrado" },
        { status: 404 }
      );
    }

    const isMaster = campaign.masterId === session.user.id;

    if (!isMaster) {
      // Verifica se o usuário é dono do personagem vinculado
      const [character] = await db
        .select()
        .from(characters)
        .where(eq(characters.id, existingLink.characterId))
        .limit(1);

      if (!character || character.ownerId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: "Sem permissão para remover este vínculo" },
          { status: 403 }
        );
      }
    }

    await db.delete(characterCampaigns).where(eq(characterCampaigns.id, linkId));

    return NextResponse.json({
      success: true,
      message: "Vínculo removido com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao remover vínculo");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
