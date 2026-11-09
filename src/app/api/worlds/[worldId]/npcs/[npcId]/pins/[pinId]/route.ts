// =============================================================================
// Libmork — API Route: Pin Específico de NPC (RF-065)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds, campaigns, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateNpcPinSchema } from "@/lib/validators/npcPin";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ worldId: string; npcId: string; pinId: string }>;
};

async function isWorldMaster(worldId: string, userId: string): Promise<boolean> {
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);

  if (!world || !world.campaignId) return false;

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
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId, npcId, pinId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode gerenciar pins" },
        { status: 403 },
      );
    }

    const [pin] = await db.select().from(npcPins).where(eq(npcPins.id, pinId)).limit(1);

    if (!pin || pin.npcId !== npcId) {
      return NextResponse.json({ success: false, error: "Pin não encontrado" }, { status: 404 });
    }

    await db.delete(npcPins).where(eq(npcPins.id, pinId));

    return NextResponse.json({
      success: true,
      message: "Pin removido com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao remover pin");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/worlds/:worldId/npcs/:npcId/pins/:pinId
 * Atualiza um pin (apenas o mestre). Usado pelo editor de dano configurado
 * (issue #90).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId, npcId, pinId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode gerenciar pins" },
        { status: 403 },
      );
    }

    const [pin] = await db.select().from(npcPins).where(eq(npcPins.id, pinId)).limit(1);

    if (!pin || pin.npcId !== npcId) {
      return NextResponse.json({ success: false, error: "Pin não encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const validation = updateNpcPinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.issues[0]?.message || "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const data = validation.data;
    const [updatedPin] = await db
      .update(npcPins)
      .set({
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.rollExpression !== undefined ? { rollExpression: data.rollExpression } : {}),
        ...(data.attackExpression !== undefined ? { attackExpression: data.attackExpression } : {}),
        ...(data.damageExpression !== undefined ? { damageExpression: data.damageExpression } : {}),
        ...(data.damageType !== undefined ? { damageType: data.damageType } : {}),
        ...(data.criticalRange !== undefined ? { criticalRange: data.criticalRange } : {}),
        ...(data.manaCost !== undefined ? { manaCost: data.manaCost } : {}),
        ...(data.circle !== undefined ? { circle: data.circle } : {}),
      })
      .where(eq(npcPins.id, pinId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedPin,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar pin");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
