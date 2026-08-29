// =============================================================================
// Libmork — API Route: Remover NPC da Biblioteca da Campanha
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, npcCampaigns, campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; npcId: string }> };

/**
 * DELETE /api/campaigns/:id/npcs/:npcId
 * Remove um NPC de biblioteca da campanha (não exclui a ficha).
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

    const { id, npcId } = await params;

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

    await db
      .delete(npcCampaigns)
      .where(and(eq(npcCampaigns.npcId, npcId), eq(npcCampaigns.campaignId, id)));

    if (npc) {
      await db.insert(campaignLogs).values({
        campaignId: id,
        createdById: session.user.id,
        actorType: "npc",
        actorId: npc.id,
        actorName: npc.name,
        action: "npc_remove",
        description: `NPC "${npc.name}" removido da campanha`,
        payload: { npcId: npc.id },
      });
    }

    return NextResponse.json({
      success: true,
      message: "NPC removido da campanha",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao remover NPC da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
