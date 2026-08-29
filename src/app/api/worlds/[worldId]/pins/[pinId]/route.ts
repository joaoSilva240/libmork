// =============================================================================
// Libmork — API Route: Pin Individual de Mapa
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds, campaigns, mapPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ worldId: string; pinId: string }>;
};

async function isWorldMaster(worldId: string, userId: string): Promise<boolean> {
  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world || !world.campaignId) return false;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  return !!campaign && campaign.masterId === userId;
}

/**
 * DELETE /api/worlds/:worldId/pins/:pinId
 * Remove um pin específico do mapa (apenas o mestre).
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

    const { worldId, pinId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode remover pins do mapa" },
        { status: 403 }
      );
    }

    const [pin] = await db
      .select()
      .from(mapPins)
      .where(eq(mapPins.id, pinId))
      .limit(1);

    if (!pin || pin.worldId !== worldId) {
      return NextResponse.json(
        { success: false, error: "Pin não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(mapPins).where(eq(mapPins.id, pinId));

    return NextResponse.json({
      success: true,
      message: "Pin removido com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao remover pin do mapa');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}