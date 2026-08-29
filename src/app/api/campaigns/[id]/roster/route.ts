// =============================================================================
// Libmork — API Route: Roster do Escudo do Mestre (RF-048)
// =============================================================================
// Retorna os personagens dos jogadores (aprovados) e os NPCs da campanha
// (dos mundos + incluídos da biblioteca) com cards prontos para a galeria.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  npcs,
  npcCampaigns,
  characterCampaigns,
  characters,
  characterConditions,
  conditions,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq, inArray, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/roster
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

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const links = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.campaignId, id),
          eq(characterCampaigns.approvalStatus, "approved")
        )
      );

    const players = links.length
      ? await db
          .select()
          .from(characters)
          .where(
            inArray(
              characters.id,
              links.map((link) => link.characterId)
            )
          )
      : [];

    const conditionRows = players.length
      ? await db
          .select({
            junctionId: characterConditions.id,
            characterId: characterConditions.characterId,
            conditionId: conditions.id,
            conditionName: conditions.name,
            permanent: characterConditions.permanent,
          })
          .from(characterConditions)
          .innerJoin(conditions, eq(characterConditions.conditionId, conditions.id))
          .where(
            inArray(
              characterConditions.characterId,
              players.map((player) => player.id)
            )
          )
      : [];

    const conditionsByCharacter = new Map<string, typeof conditionRows>();
    for (const row of conditionRows) {
      const list = conditionsByCharacter.get(row.characterId) ?? [];
      list.push(row);
      conditionsByCharacter.set(row.characterId, list);
    }

    const playersWithConditions = players.map((player) => ({
      ...player,
      conditions: conditionsByCharacter.get(player.id) ?? [],
    }));

    // NPCs selecionados explicitamente no overlay de mundos para esta campanha
    const included = await db
      .select({ npc: npcs })
      .from(npcCampaigns)
      .innerJoin(npcs, eq(npcCampaigns.npcId, npcs.id))
      .where(eq(npcCampaigns.campaignId, id));

    const campaignNpcs = included.map((row) => row.npc);

    return NextResponse.json({
      success: true,
      data: { players: playersWithConditions, npcs: campaignNpcs },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar roster");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
