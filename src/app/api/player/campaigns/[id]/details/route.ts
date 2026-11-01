import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, campaignInvites, establishments, npcCampaigns, npcs, worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    const { id } = await params;
    const [membership] = await db.select({ id: campaigns.id }).from(campaignInvites)
      .innerJoin(campaigns, eq(campaignInvites.campaignId, campaigns.id))
      .where(and(eq(campaignInvites.campaignId, id), eq(campaignInvites.userId, session.user.id), eq(campaignInvites.revoked, false))).limit(1);
    if (!membership) return NextResponse.json({ success: false, error: "Campanha não encontrada" }, { status: 404 });

    const [campaignWorlds, campaignEstablishments, campaignNpcs] = await Promise.all([
      db.select({ id: worlds.id, name: worlds.name, description: worlds.description, coverUrl: worlds.coverUrl }).from(worlds).where(eq(worlds.campaignId, id)).orderBy(worlds.createdAt),
      db.select({ id: establishments.id, name: establishments.name, type: establishments.type, worldId: establishments.worldId, trustLevel: establishments.trustLevel }).from(establishments).innerJoin(worlds, eq(establishments.worldId, worlds.id)).where(eq(worlds.campaignId, id)).orderBy(establishments.name),
      db.select({ id: npcs.id, name: npcs.name, npcType: npcs.npcType, level: npcs.level, imageUrl: npcs.imageUrl, worldId: npcs.worldId }).from(npcCampaigns).innerJoin(npcs, eq(npcCampaigns.npcId, npcs.id)).where(eq(npcCampaigns.campaignId, id)).orderBy(npcs.name),
    ]);
    return NextResponse.json({ success: true, data: { worlds: campaignWorlds, establishments: campaignEstablishments.map((item) => ({ ...item, reputationLevel: item.trustLevel })), npcs: campaignNpcs } });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar conteúdo da campanha para jogador");
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
