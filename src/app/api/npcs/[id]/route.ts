// =============================================================================
// Libmork — API Route: NPC Específico da Biblioteca / Mundos
// =============================================================================
// GET: qualquer autenticado. PATCH/DELETE: dono do NPC ou mestre da campanha
// do mundo. GET inclui as campanhas em que o NPC está incluído.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, npcCampaigns, campaigns, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { canManageNpc } from "@/lib/auth/campaign-access";
import { updateNpcSchema } from "@/lib/validators/npc";
import { eq, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/npcs/:id
 * Obtém um NPC com as campanhas em que está incluído e seus pins de ação.
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

    const { id } = await params;

    const [npc] = await db.select().from(npcs).where(eq(npcs.id, id)).limit(1);

    if (!npc) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    const pins = await db
      .select()
      .from(npcPins)
      .where(eq(npcPins.npcId, id))
      .orderBy(npcPins.createdAt);

    const links = await db
      .select()
      .from(npcCampaigns)
      .where(eq(npcCampaigns.npcId, id));

    const includedCampaigns = links.length
      ? await db
          .select({ id: campaigns.id, name: campaigns.name })
          .from(campaigns)
          .where(inArray(campaigns.id, links.map((link) => link.campaignId)))
      : [];

    return NextResponse.json({
      success: true,
      data: { ...npc, pins, includedCampaigns },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao obter NPC');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/npcs/:id
 * Atualiza um NPC (dono ou mestre da campanha do mundo).
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

    const { id } = await params;

    const allowed = await canManageNpc(id, session.user.id);

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para editar este NPC" },
        { status: 403 }
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
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(npcs.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar NPC');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/npcs/:id
 * Remove um NPC (dono ou mestre da campanha do mundo).
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

    const { id } = await params;

    const allowed = await canManageNpc(id, session.user.id);

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para excluir este NPC" },
        { status: 403 }
      );
    }

    await db.delete(npcs).where(eq(npcs.id, id));

    return NextResponse.json({
      success: true,
      message: "NPC excluído com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao excluir NPC');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}