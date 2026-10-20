// =============================================================================
// Libmork — API Route: Operações em Personagem Específico (RF-008, RF-009, RF-010)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, characterCampaigns, rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateCharacterSchema } from "@/lib/validators/character";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getDerivedStats, AttributeMap } from "@/lib/engine/attributes";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/characters/:id
 * Obtém um personagem específico (RF-008).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, id),
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

    const [campaignLink] = await db
      .select({ campaignId: characterCampaigns.campaignId })
      .from(characterCampaigns)
      .where(eq(characterCampaigns.characterId, id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { ...character, campaignId: campaignLink?.campaignId ?? null },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao obter personagem');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/characters/:id
 * Atualiza um personagem específico (RF-009).
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

    const { id } = await params;

    // Verificar se o personagem existe e pertence ao usuário
    const [existingCharacter] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, id),
          eq(characters.ownerId, session.user.id)
        )
      )
      .limit(1);

    if (!existingCharacter) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateCharacterSchema.safeParse(body);

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

    // Montar campos para atualização
    const updateData: Record<string, unknown> = {
      ...validation.data,
      updatedAt: new Date(),
    };

    // Recalcular hitPointsMax e ajustar hitPointsCurrent quando activeHeritages for fornecido
    if (validation.data.activeHeritages !== undefined) {
      const activeHeritages = validation.data.activeHeritages;
      const effectiveRaceId = validation.data.raceId !== undefined ? validation.data.raceId : existingCharacter.raceId;

      let raceHpBonus = 0;
      if (effectiveRaceId) {
        const [race] = await db
          .select({ hitPointsBonus: rpgRaces.hitPointsBonus })
          .from(rpgRaces)
          .where(eq(rpgRaces.id, effectiveRaceId))
          .limit(1);

        if (race) {
          raceHpBonus = race.hitPointsBonus;
        }
      }

      const effectiveAttributes = (validation.data.attributes ?? existingCharacter.attributes) as AttributeMap;
      const effectiveLevel = existingCharacter.level ?? 1;
      const baseHpMax = getDerivedStats(effectiveAttributes, effectiveLevel).hitPointsMax;
      const newHitPointsMax = baseHpMax + (activeHeritages.length > 0 ? raceHpBonus : 0);

      updateData.hitPointsMax = newHitPointsMax;

      const currentHp = validation.data.hitPointsCurrent !== undefined
        ? validation.data.hitPointsCurrent
        : existingCharacter.hitPointsCurrent;

      updateData.hitPointsCurrent = Math.min(currentHp, newHitPointsMax);
    }

    // Atualizar apenas os campos fornecidos
    const [updatedCharacter] = await db
      .update(characters)
      .set(updateData)
      .where(eq(characters.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedCharacter,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar personagem');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/characters/:id
 * Remove um personagem específico (RF-010).
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

    const { id } = await params;

    // Verificar se o personagem existe e pertence ao usuário
    const [existingCharacter] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, id),
          eq(characters.ownerId, session.user.id)
        )
      )
      .limit(1);

    if (!existingCharacter) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    // Excluir personagem
    await db
      .delete(characters)
      .where(eq(characters.id, id));

    return NextResponse.json({
      success: true,
      message: "Personagem excluído com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao excluir personagem');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}