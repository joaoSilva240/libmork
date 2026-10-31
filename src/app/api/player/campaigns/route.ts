// =============================================================================
// Libmork — API Route: Campanhas do Jogador
// =============================================================================
// Retorna todas as campanhas em que o jogador autenticado possui convite ativo,
// juntamente com os dados do mestre, os personagens vinculados e suporte a
// Habitantes em campanhas de MISSING — Edição ZERO.
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  campaigns,
  campaignInvites,
  users,
  characterCampaigns,
  characters,
  missingHabitants,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type {
  HabitantLine,
  MissingEquipment,
  MissingHabitant,
} from "@/lib/systems/missing/types";

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

    // Busca todos os personagens aprovados da campanha (roster d20 completo)
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

    // Suporte a campanhas de MISSING — Edição ZERO
    const missingCampaignIds = campaignRows
      .filter((camp) => camp.rulesEngine === "missing_zero")
      .map((camp) => camp.id);

    const allCampaignHabitants = missingCampaignIds.length > 0
      ? await db
          .select()
          .from(missingHabitants)
          .where(inArray(missingHabitants.campaignId, missingCampaignIds))
      : [];

    const habitantsByCampaign = new Map<string, MissingHabitant[]>();

    for (const h of allCampaignHabitants) {
      if (!h.campaignId) continue;
      const isMine = h.ownerId === session.user.id;

      // Adicionar os habitantes da campanha no roster
      const rosterList = rosterByCampaign.get(h.campaignId) ?? [];
      rosterList.push({
        id: h.id,
        name: h.name,
        imageUrl: null,
        isMine,
      });
      rosterByCampaign.set(h.campaignId, rosterList);

      // Para os habitantes pertencentes ao jogador autenticado
      if (isMine) {
        // Mapear em characters para compatibilidade
        const charList = charactersByCampaign.get(h.campaignId) ?? [];
        charList.push({
          campaignId: h.campaignId,
          id: h.id,
          name: h.name,
          imageUrl: null,
          ownerId: h.ownerId,
          level: 1,
          hitPointsCurrent: h.status === "active" ? 1 : 0,
          hitPointsMax: 1,
          manaPointsCurrent: 0,
          manaPointsMax: 0,
        });
        charactersByCampaign.set(h.campaignId, charList);

        // Expor dados completos em habitants
        const habitantList = habitantsByCampaign.get(h.campaignId) ?? [];
        habitantList.push({
          id: h.id,
          campaignId: h.campaignId,
          ownerId: h.ownerId,
          name: h.name,
          status: h.status as "active" | "missing",
          lines: (h.lines || []) as HabitantLine[],
          equipments: (h.equipments || []) as [MissingEquipment, MissingEquipment, MissingEquipment],
          createdAt: h.createdAt.toISOString(),
          updatedAt: h.updatedAt.toISOString(),
        });
        habitantsByCampaign.set(h.campaignId, habitantList);
      }
    }

    const data = campaignRows.map((camp) => {
      const isMissing = camp.rulesEngine === "missing_zero";
      return {
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
        ...(isMissing ? { habitants: habitantsByCampaign.get(camp.id) ?? [] } : {}),
      };
    });

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
