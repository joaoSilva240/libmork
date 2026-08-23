// =============================================================================
// Libmork — Helpers de Acesso por Campanha (RF-005)
// =============================================================================
// Verificações de papel do mestre sobre campanhas/mundos/NPCs.
// =============================================================================

import { db } from "@/lib/db";
import { campaigns, worlds, npcs, npcCampaigns } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Retorna a campanha se o usuário for o mestre dela; senão, null.
 */
export async function getCampaignAsMaster(campaignId: string, userId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign || campaign.masterId !== userId) {
    return null;
  }

  return campaign;
}

/**
 * Retorna a campanha dona de um mundo; null se não encontrada.
 */
export async function getCampaignByWorld(worldId: string) {
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);

  if (!world) return null;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  return campaign ?? null;
}

/**
 * Verifica se o usuário pode gerenciar um NPC:
 * dono do NPC de biblioteca (ownerId) ou mestre da campanha do mundo do NPC.
 */
export async function canManageNpc(npcId: string, userId: string): Promise<boolean> {
  const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

  if (!npc) return false;

  if (npc.ownerId === userId) return true;

  if (npc.worldId) {
    const campaign = await getCampaignByWorld(npc.worldId);
    return !!campaign && campaign.masterId === userId;
  }

  return false;
}

/**
 * Verifica se um NPC pertence a uma campanha (via mundo ou via inclusão
 * de biblioteca). Usado para liberar mutações no Escudo do Mestre.
 */
export async function isNpcInCampaign(
  npcId: string,
  campaignId: string
): Promise<boolean> {
  const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

  if (!npc) return false;

  if (npc.worldId) {
    const [world] = await db
      .select()
      .from(worlds)
      .where(eq(worlds.id, npc.worldId))
      .limit(1);
    return !!world && world.campaignId === campaignId;
  }

  const [link] = await db
    .select()
    .from(npcCampaigns)
    .where(and(eq(npcCampaigns.npcId, npcId), eq(npcCampaigns.campaignId, campaignId)))
    .limit(1);

  return !!link;
}
