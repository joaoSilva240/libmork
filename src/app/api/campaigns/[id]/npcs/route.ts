// =============================================================================
// Libmork — API Route: NPCs da Biblioteca incluídos na Campanha
// =============================================================================
// GET: mestre da campanha. POST: incluir NPC da biblioteca (mestre).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, npcCampaigns, campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const includeNpcSchema = z.object({
  npcId: z.string().uuid(),
});

/**
 * GET /api/campaigns/:id/npcs
 * Lista os NPCs de biblioteca incluídos na campanha.
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

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const result = await db
      .select({ npc: npcs, linkId: npcCampaigns.id })
      .from(npcCampaigns)
      .innerJoin(npcs, eq(npcCampaigns.npcId, npcs.id))
      .where(eq(npcCampaigns.campaignId, id))
      .orderBy(npcs.name);

    return NextResponse.json({
      success: true,
      data: result.map((row) => ({ ...row.npc, linkId: row.linkId })),
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar NPCs incluídos");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/npcs
 * Inclui um NPC da biblioteca na campanha (mestre).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = includeNpcSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos" },
        { status: 400 }
      );
    }

    const [npc] = await db
      .select()
      .from(npcs)
      .where(eq(npcs.id, validation.data.npcId))
      .limit(1);

    if (!npc) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    const [existing] = await db
      .select()
      .from(npcCampaigns)
      .where(
        and(
          eq(npcCampaigns.npcId, npc.id),
          eq(npcCampaigns.campaignId, id)
        )
      )
      .limit(1);

    if (!existing) {
      await db
        .insert(npcCampaigns)
        .values({ npcId: npc.id, campaignId: id })
        .returning();
    }

    await db.insert(campaignLogs).values({
      campaignId: id,
      createdById: session.user.id,
      actorType: "npc",
      actorId: npc.id,
      actorName: npc.name,
      action: "npc_include",
      description: `NPC "${npc.name}" incluído na campanha`,
      payload: { npcId: npc.id },
    });

    return NextResponse.json(
      { success: true, data: npc },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao incluir NPC na campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
