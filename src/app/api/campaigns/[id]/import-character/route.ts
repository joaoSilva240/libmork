// =============================================================================
// Libmork — API Route: Importar Personagem para Campanha (Issue #4)
// Suporte à Importação e Exibição de Habitantes em MISSING — Edição ZERO
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  characters,
  characterCampaigns,
  campaignInvites,
  missingHabitants,
  missingActionLedger,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const importCharacterSchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * POST /api/campaigns/:id/import-character
 * Vincula um personagem (d20) ou habitante (MISSING) existente do jogador a uma campanha.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = importCharacterSchema.safeParse(body);

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

    const { characterId } = validation.data;
    const { id: campaignId } = await params;

    // 1. Obter a campanha pelo campaignId e verificar se ela existe
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    // 2. Verificar se o usuário autenticado tem convite ativo para a campanha ou permissão de acesso
    const isMaster = campaign.masterId === session.user.id;

    const [invite] = await db
      .select()
      .from(campaignInvites)
      .where(
        and(
          eq(campaignInvites.userId, session.user.id),
          eq(campaignInvites.campaignId, campaignId),
          eq(campaignInvites.revoked, false)
        )
      )
      .limit(1);

    if (!invite && !isMaster) {
      return NextResponse.json(
        { success: false, error: "Você não tem convite ativo para esta campanha" },
        { status: 403 }
      );
    }

    // 3. Rota específica para MISSING — Edição ZERO
    if (campaign.rulesEngine === "missing_zero") {
      const [habitant] = await db
        .select()
        .from(missingHabitants)
        .where(
          and(
            eq(missingHabitants.id, characterId),
            eq(missingHabitants.ownerId, session.user.id)
          )
        )
        .limit(1);

      if (!habitant) {
        return NextResponse.json(
          { success: false, error: "Habitante não encontrado" },
          { status: 404 }
        );
      }

      if (habitant.campaignId === campaignId) {
        return NextResponse.json(
          { success: false, error: "Este habitante já está nesta campanha" },
          { status: 409 }
        );
      }

      // Atualizar o habitante vinculando-o à campanha
      await db
        .update(missingHabitants)
        .set({
          campaignId,
          updatedAt: new Date(),
        })
        .where(eq(missingHabitants.id, habitant.id));

      // Registrar evento no missingActionLedger
      await db.insert(missingActionLedger).values({
        campaignId,
        habitantId: habitant.id,
        actorRole: isMaster ? "voice" : "writer",
        actorId: session.user.id,
        eventType: "system",
        payload: {
          message: `Habitante ${habitant.name} chegou à campanha.`,
          habitantId: habitant.id,
          habitantName: habitant.name,
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            habitantId: habitant.id,
            campaignId,
          },
        },
        { status: 201 }
      );
    }

    // 4. Fluxo existente para personagens d20 (characters + characterCampaigns)
    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.ownerId, session.user.id)
        )
      )
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.characterId, characterId),
          eq(characterCampaigns.campaignId, campaignId)
        )
      )
      .limit(1);

    if (existingLink) {
      return NextResponse.json(
        { success: false, error: "Este personagem já está vinculado a esta campanha" },
        { status: 409 }
      );
    }

    const [newLink] = await db
      .insert(characterCampaigns)
      .values({
        characterId,
        campaignId,
        origin: "imported",
        approvalStatus: "approved",
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newLink,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao importar personagem para campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
