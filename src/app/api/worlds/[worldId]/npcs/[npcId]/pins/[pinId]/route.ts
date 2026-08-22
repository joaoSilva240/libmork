// =============================================================================
// Libmork — API Route: Pin Específico de NPC (RF-065)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds, campaigns, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ worldId: string; npcId: string; pinId: string }>;
};

async function isWorldMaster(worldId: string, userId: string): Promise<boolean> {
  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world) return false;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  return !!campaign && campaign.masterId === userId;
}

/**
 * DELETE /api/worlds/:worldId/npcs/:npcId/pins/:pinId
 * Remove um pin (apenas o mestre).
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

    const { worldId, npcId, pinId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode gerenciar pins" },
        { status: 403 }
      );
    }

    const [pin] = await db.select().from(npcPins).where(eq(npcPins.id, pinId)).limit(1);

    if (!pin || pin.npcId !== npcId) {
      return NextResponse.json(
        { success: false, error: "Pin não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(npcPins).where(eq(npcPins.id, pinId));

    return NextResponse.json({
      success: true,
      message: "Pin removido com sucesso",
    });
  } catch (error) {
    console.error("Erro ao remover pin:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
