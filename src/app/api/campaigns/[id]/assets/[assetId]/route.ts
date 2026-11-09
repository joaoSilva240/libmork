// =============================================================================
// Libmork — API Route: Atualizar e Remover Asset de Campanha (Issue #61)
// =============================================================================
// PATCH: Atualiza um asset existente (apenas mestre).
// DELETE: Remove um asset existente (apenas mestre). Se for o asset ativo, reseta para null.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignAssets } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { updateCampaignAssetSchema } from "@/lib/validators/campaign-asset";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

/**
 * PATCH /api/campaigns/:id/assets/:assetId
 * Atualiza campos de um asset da campanha (apenas mestre).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId, assetId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode atualizar assets da campanha" },
        { status: 403 },
      );
    }

    const [existing] = await db
      .select()
      .from(campaignAssets)
      .where(and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, campaignId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Asset não encontrado" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const validation = updateCampaignAssetSchema.safeParse(body);

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

    const [updated] = await db
      .update(campaignAssets)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, campaignId)))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar asset da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/campaigns/:id/assets/:assetId
 * Remove o asset especificado da campanha (apenas mestre).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId, assetId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode remover assets da campanha" },
        { status: 403 },
      );
    }

    // Se o asset removido for o activeAssetId da campanha, atualiza activeAssetId para null
    const [campaignRecord] = await db
      .select({ activeAssetId: campaigns.activeAssetId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaignRecord?.activeAssetId === assetId) {
      await db
        .update(campaigns)
        .set({ activeAssetId: null, updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    }

    const deleted = await db
      .delete(campaignAssets)
      .where(and(eq(campaignAssets.id, assetId), eq(campaignAssets.campaignId, campaignId)))
      .returning({ id: campaignAssets.id });

    if (deleted.length === 0) {
      return NextResponse.json({ success: false, error: "Asset não encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Asset removido com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao remover asset da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
