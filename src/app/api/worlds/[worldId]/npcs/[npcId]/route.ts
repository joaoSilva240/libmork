// =============================================================================
// Libmork — API Route: NPC Específico (RF-014, D-38)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, worlds, campaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateNpcSchema } from "@/lib/validators/npc";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ worldId: string; npcId: string }> };

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
 * GET /api/worlds/:worldId/npcs/:npcId
 * Obtém um NPC.
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

    const { worldId, npcId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para acessar este NPC" },
        { status: 403 }
      );
    }

    const [npc] = await db
      .select()
      .from(npcs)
      .where(eq(npcs.id, npcId))
      .limit(1);

    if (!npc || npc.worldId !== worldId) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: npc,
    });
  } catch (error) {
    console.error("Erro ao obter NPC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/worlds/:worldId/npcs/:npcId
 * Atualiza um NPC (apenas o mestre).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { worldId, npcId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode editar NPCs" },
        { status: 403 }
      );
    }

    const [existing] = await db
      .select()
      .from(npcs)
      .where(eq(npcs.id, npcId))
      .limit(1);

    if (!existing || existing.worldId !== worldId) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateNpcSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(npcs)
      .set(validation.data)
      .where(eq(npcs.id, npcId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar NPC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/worlds/:worldId/npcs/:npcId
 * Remove um NPC (apenas o mestre).
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

    const { worldId, npcId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode excluir NPCs" },
        { status: 403 }
      );
    }

    const [existing] = await db
      .select()
      .from(npcs)
      .where(eq(npcs.id, npcId))
      .limit(1);

    if (!existing || existing.worldId !== worldId) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(npcs).where(eq(npcs.id, npcId));

    return NextResponse.json({
      success: true,
      message: "NPC excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir NPC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
