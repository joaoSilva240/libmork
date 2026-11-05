// =============================================================================
// Libmork — API Route: Ativar Asset da Campanha (Issue #61)
// =============================================================================
// POST: Define o asset como o handout/cena ativa da campanha (apenas mestre).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAssets, campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

/**
 * POST /api/campaigns/:id/assets/:assetId/activate
 * Ativa o asset como handout/cena em exibição (apenas mestre).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId, assetId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode ativar assets na campanha" },
        { status: 403 },
      );
    }

    const [asset] = await db
      .select()
      .from(campaignAssets)
      .where(and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, campaignId)))
      .limit(1);

    if (!asset) {
      return NextResponse.json({ success: false, error: "Asset não encontrado" }, { status: 404 });
    }

    await db
      .update(campaigns)
      .set({
        activeAssetId: asset.id,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    try {
      await db.insert(campaignLogs).values({
        campaignId,
        actorType: "master",
        actorName: session.user.masterName || session.user.displayName || "Mestre",
        action: "asset_activate",
        description: `Asset "${asset.name}" ativado`,
        payload: {
          assetId: asset.id,
          name: asset.name,
          imageUrl: asset.imageUrl,
          category: asset.category,
        },
        createdById: session.user.id,
      });
    } catch (logErr) {
      logger.warn({ err: logErr }, "Falha ao registrar log de ativação de asset");
    }

    return NextResponse.json({
      success: true,
      data: asset,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao ativar asset da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
