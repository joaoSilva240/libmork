// =============================================================================
// Libmork — API Route: Campanhas do Jogador
// =============================================================================
// Retorna todas as campanhas em que o jogador autenticado possui convite ativo,
// juntamente com os dados do mestre e os personagens do jogador vinculados.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites, users, characterCampaigns, characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const invites = await db
      .select({
        campaignId: campaignInvites.campaignId,
      })
      .from(campaignInvites)
      .where(
        and(
          eq(campaignInvites.userId, session.user.id),
          eq(campaignInvites.revoked, false)
        )
      );

    if (invites.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const campaignIds = Array.from(new Set(invites.map((i) => i.campaignId)));

    const campaignRows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        rulesEngine: campaigns.rulesEngine,
        pvpEnabled: campaigns.pvpEnabled,
        coverImageUrl: campaigns.coverImageUrl,
        worldMapUrl: campaigns.worldMapUrl,
        masterId: users.id,
        masterDisplayName: users.displayName,
        masterEmail: users.email,
      })
      .from(campaigns)
      .innerJoin(users, eq(campaigns.masterId, users.id))
      .where(inArray(campaigns.id, campaignIds));

    // Busca todos os personagens aprovados da campanha (roster completo)
    const allCampaignCharacters = await db
      .select({
        campaignId: characterCampaigns.campaignId,
        id: characters.id,
        name: characters.name,
        imageUrl: characters.imageUrl,
        ownerId: characters.ownerId,
        level: characters.level,
        hitPointsCurrent: characters.hitPointsCurrent,
        hitPointsMax: characters.hitPointsMax,
        manaPointsCurrent: characters.manaPointsCurrent,
        manaPointsMax: characters.manaPointsMax,
      })
      .from(characterCampaigns)
      .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
      .where(
        and(
          inArray(characterCampaigns.campaignId, campaignIds),
          eq(characterCampaigns.approvalStatus, "approved")
        )
      );

    const charactersByCampaign = new Map<string, typeof allCampaignCharacters>();
    const rosterByCampaign = new Map<
      string,
      Array<{ id: string; name: string; imageUrl: string | null; isMine: boolean }>
    >();

    for (const link of allCampaignCharacters) {
      const isMine = link.ownerId === session.user.id;
      if (isMine) {
        const list = charactersByCampaign.get(link.campaignId) ?? [];
        list.push(link);
        charactersByCampaign.set(link.campaignId, list);
      }

      const rosterList = rosterByCampaign.get(link.campaignId) ?? [];
      rosterList.push({
        id: link.id,
        name: link.name,
        imageUrl: link.imageUrl,
        isMine,
      });
      rosterByCampaign.set(link.campaignId, rosterList);
    }

    const data = campaignRows.map((camp) => ({
      id: camp.id,
      name: camp.name,
      description: camp.description,
      rulesEngine: camp.rulesEngine,
      pvpEnabled: camp.pvpEnabled,
      coverImageUrl: camp.coverImageUrl,
      worldMapUrl: camp.worldMapUrl,
      master: {
        id: camp.masterId,
        displayName: camp.masterDisplayName,
        email: camp.masterEmail,
      },
      characters: (charactersByCampaign.get(camp.id) ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.imageUrl,
        level: c.level,
        hitPointsCurrent: c.hitPointsCurrent,
        hitPointsMax: c.hitPointsMax,
        manaPointsCurrent: c.manaPointsCurrent,
        manaPointsMax: c.manaPointsMax,
      })),
      roster: rosterByCampaign.get(camp.id) ?? [],
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar campanhas do jogador");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
