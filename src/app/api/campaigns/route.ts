// =============================================================================
// Libmork — API Route: Listar e Criar Campanhas (RF-012)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, npcCampaigns, worlds, campaignAssets } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createCampaignSchema } from "@/lib/validators/campaign";
import { eq, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { ensureCampaignChatGroup } from "@/lib/server/chat-service";

/**
 * GET /api/campaigns
 * Lista as campanhas em que o usuário é mestre (RF-012).
 */
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const userCampaigns = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.masterId, session.user.id))
      .orderBy(campaigns.createdAt);

    return NextResponse.json({
      success: true,
      data: userCampaigns,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar campanhas");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/campaigns
 * Cria uma nova campanha, definindo o usuário como mestre (RF-012).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createCampaignSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      name,
      description,
      rulesEngine,
      pvpEnabled,
      difficultyModifierShadowPoints,
      coverImageUrl,
      worldMapUrl,
      theme,
      initialNpcIds,
      initialWorldIds,
      initialAssets,
    } = validation.data;

    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        masterId: session.user.id,
        name,
        description,
        rulesEngine,
        pvpEnabled,
        difficultyModifierShadowPoints,
        coverImageUrl,
        worldMapUrl,
        theme: theme || "default-dark",
        dice3dPlayersEnabled: validation.data.dice3dPlayersEnabled,
        dice3dMasterEnabled: validation.data.dice3dMasterEnabled,
      })
      .returning();

    if (initialNpcIds && initialNpcIds.length > 0) {
      await db.insert(npcCampaigns).values(
        initialNpcIds.map((npcId) => ({
          campaignId: newCampaign.id,
          npcId,
        })),
      );
    }

    if (initialWorldIds && initialWorldIds.length > 0) {
      await db
        .update(worlds)
        .set({ campaignId: newCampaign.id })
        .where(inArray(worlds.id, initialWorldIds));
    }

    if (initialAssets && initialAssets.length > 0) {
      await db.insert(campaignAssets).values(
        initialAssets.map((asset, idx) => ({
          campaignId: newCampaign.id,
          name: asset.name,
          description: asset.description ?? null,
          imageUrl: asset.imageUrl,
          category: asset.category ?? "handout",
          position: asset.position ?? idx,
        })),
      );
    }

    // Cria e vincula automaticamente o grupo de chat da campanha (Issue #62)
    try {
      await ensureCampaignChatGroup(newCampaign.id);
    } catch (chatErr) {
      logger.warn({ err: chatErr }, "Falha ao criar grupo de chat automático da campanha");
    }

    return NextResponse.json(
      {
        success: true,
        data: newCampaign,
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao criar campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
