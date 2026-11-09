// =============================================================================
// Libmork — API Route: Desativar Asset Ativo da Campanha (Issue #61)
// =============================================================================
// POST: Desativa o handout atualmente em exibição (apenas mestre).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/campaigns/:id/assets/deactivate
 * Desativa o handout/cena atualmente em exibição (apenas mestre).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode desativar assets na campanha" },
        { status: 403 },
      );
    }

    await db
      .update(campaigns)
      .set({
        activeAssetId: null,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    try {
      await db.insert(campaignLogs).values({
        campaignId,
        actorType: "master",
        actorName: session.user.masterName || session.user.displayName || "Mestre",
        action: "asset_deactivate",
        description: "Handout desativado",
        payload: {},
        createdById: session.user.id,
      });
    } catch (logErr) {
      logger.warn({ err: logErr }, "Falha ao registrar log de desativação de asset");
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao desativar asset da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
