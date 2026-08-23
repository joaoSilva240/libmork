// =============================================================================
// Libmork — API Route: Gasto de Pontos de Sombra (RF-045, RF-055, D-26)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, campaigns, characterCampaigns, characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and, sql } from "drizzle-orm";
import type { ShadowPointBonus } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/campaigns/:id/spend-shadow-points
 * Permite ao jogador gastar Pontos de Sombra para obter bônus (+2) e aumentar
 * a escala de dificuldade global da campanha (RF-045, RF-055, D-26).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const body = await request.json();
    const { characterId, pointsToSpend = 1, bonusType, target } = body;

    if (!characterId || !bonusType || !target || pointsToSpend < 1) {
      return NextResponse.json(
        { success: false, error: "Parâmetros inválidos. Informe characterId, bonusType, target e pointsToSpend >= 1." },
        { status: 400 }
      );
    }

    if (!["attribute", "skill", "spell"].includes(bonusType)) {
      return NextResponse.json({ success: false, error: "bonusType deve ser 'attribute', 'skill' ou 'spell'." }, { status: 400 });
    }

    // 1. Buscar usuário para verificar pontos de sombra disponíveis
    const [userRecord] = await db
      .select({ shadowPoints: users.shadowPoints })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!userRecord || userRecord.shadowPoints < pointsToSpend) {
      return NextResponse.json(
        { success: false, error: `Pontos de Sombra insuficientes. Disponíveis: ${userRecord?.shadowPoints ?? 0}` },
        { status: 400 }
      );
    }

    // 2. Verificar se o personagem pertence ao usuário e está na campanha
    const [link] = await db
      .select({
        id: characterCampaigns.id,
        shadowPointsBonuses: characterCampaigns.shadowPointsBonuses,
      })
      .from(characterCampaigns)
      .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
      .where(
        and(
          eq(characterCampaigns.campaignId, campaignId),
          eq(characterCampaigns.characterId, characterId),
          eq(characters.ownerId, session.user.id)
        )
      )
      .limit(1);

    if (!link) {
      return NextResponse.json(
        { success: false, error: "Vínculo entre personagem e campanha não encontrado ou não pertence a você." },
        { status: 404 }
      );
    }

    // 3. Decrementar Pontos de Sombra do usuário
    await db
      .update(users)
      .set({
        shadowPoints: userRecord.shadowPoints - pointsToSpend,
      })
      .where(eq(users.id, session.user.id));

    // 4. Incrementar a escala de dificuldade da campanha (RF-055)
    await db
      .update(campaigns)
      .set({
        difficultyModifierShadowPoints: sql`COALESCE(${campaigns.difficultyModifierShadowPoints}, 0) + ${pointsToSpend}`,
      })
      .where(eq(campaigns.id, campaignId));

    // 5. Adicionar o novo bônus ao JSONB shadowPointsBonuses
    const currentBonuses: ShadowPointBonus[] = Array.isArray(link.shadowPointsBonuses)
      ? (link.shadowPointsBonuses as unknown as ShadowPointBonus[])
      : [];

    const newBonus: ShadowPointBonus = {
      bonus_type: bonusType as "attribute" | "skill" | "spell",
      target,
      bonus_value: 2 * pointsToSpend,
      source_campaign_id: campaignId,
      campaigns_remaining: 3,
    };

    const updatedBonuses = [...currentBonuses, newBonus];

    await db
      .update(characterCampaigns)
      .set({
        shadowPointsBonuses: updatedBonuses,
      })
      .where(eq(characterCampaigns.id, link.id));

    return NextResponse.json({
      success: true,
      message: `${pointsToSpend} Ponto(s) de Sombra gasto(s) com sucesso!`,
      data: {
        remainingUserShadowPoints: userRecord.shadowPoints - pointsToSpend,
        addedBonus: newBonus,
        allBonuses: updatedBonuses,
      },
    });
  } catch (error) {
    console.error("Erro ao gastar Pontos de Sombra:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno ao processar gasto de Pontos de Sombra" },
      { status: 500 }
    );
  }
}
