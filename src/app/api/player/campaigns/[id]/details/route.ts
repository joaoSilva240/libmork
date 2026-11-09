import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, campaignInvites, establishments, npcCampaigns, npcs, worlds, campaignAssets } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    const { id } = await params;
    const [membership] = await db
      .select({
        id: campaigns.id,
        activeAssetId: campaigns.activeAssetId,
        dice3dPlayersEnabled: campaigns.dice3dPlayersEnabled,
        dice3dMasterEnabled: campaigns.dice3dMasterEnabled,
      })
      .from(campaignInvites)
      .innerJoin(campaigns, eq(campaignInvites.campaignId, campaigns.id))
      .where(
        and(
          eq(campaignInvites.campaignId, id),
          eq(campaignInvites.userId, session.user.id),
          eq(campaignInvites.revoked, false)
        )
      )
      .limit(1);

    let activeAssetId: string | null = null;
    let dice3dPlayersEnabled = true;
    let dice3dMasterEnabled = true;
    if (membership) {
      activeAssetId = membership.activeAssetId ?? null;
      dice3dPlayersEnabled = membership.dice3dPlayersEnabled;
      dice3dMasterEnabled = membership.dice3dMasterEnabled;
    } else {
      const [campaignAsMaster] = await db
        .select({
          id: campaigns.id,
          activeAssetId: campaigns.activeAssetId,
          dice3dPlayersEnabled: campaigns.dice3dPlayersEnabled,
          dice3dMasterEnabled: campaigns.dice3dMasterEnabled,
        })
        .from(campaigns)
        .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
        .limit(1);

      if (!campaignAsMaster) {
        return NextResponse.json({ success: false, error: "Campanha não encontrada" }, { status: 404 });
      }
      activeAssetId = campaignAsMaster.activeAssetId ?? null;
      dice3dPlayersEnabled = campaignAsMaster.dice3dPlayersEnabled;
      dice3dMasterEnabled = campaignAsMaster.dice3dMasterEnabled;
    }

    let activeAsset: typeof campaignAssets.$inferSelect | null = null;
    if (activeAssetId) {
      const [asset] = await db
        .select()
        .from(campaignAssets)
        .where(eq(campaignAssets.id, activeAssetId))
        .limit(1);
      activeAsset = asset ?? null;
    }

    const [campaignWorlds, campaignEstablishments, campaignNpcs] = await Promise.all([
      db.select({ id: worlds.id, name: worlds.name, description: worlds.description, coverUrl: worlds.coverUrl }).from(worlds).where(eq(worlds.campaignId, id)).orderBy(worlds.createdAt),
      db.select({ id: establishments.id, name: establishments.name, type: establishments.type, worldId: establishments.worldId, trustLevel: establishments.trustLevel }).from(establishments).innerJoin(worlds, eq(establishments.worldId, worlds.id)).where(eq(worlds.campaignId, id)).orderBy(establishments.name),
      db.select({ id: npcs.id, name: npcs.name, npcType: npcs.npcType, level: npcs.level, imageUrl: npcs.imageUrl, worldId: npcs.worldId }).from(npcCampaigns).innerJoin(npcs, eq(npcCampaigns.npcId, npcs.id)).where(eq(npcCampaigns.campaignId, id)).orderBy(npcs.name),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        activeAssetId,
        activeAsset,
        dice3dPlayersEnabled,
        dice3dMasterEnabled,
        worlds: campaignWorlds,
        establishments: campaignEstablishments.map((item) => ({ ...item, reputationLevel: item.trustLevel })),
        npcs: campaignNpcs,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar conteúdo da campanha para jogador");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
