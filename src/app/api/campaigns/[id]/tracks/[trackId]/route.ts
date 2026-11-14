// =============================================================================
// Libmork — API Route: Remover Faixa de Áudio da Campanha (Issue #60)
// =============================================================================
// DELETE: Remove uma faixa da campanha (apenas mestre).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignAudioTracks } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { isSceneValue } from "@/lib/scenes/sceneConfig";
import { eq, and, or } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; trackId: string }> };

/**
 * DELETE /api/campaigns/:id/tracks/:trackId
 * Remove a faixa especificada da campanha.
 * trackId pode ser o videoId (11 chars) ou o UUID da tabela.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId, trackId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode remover faixas da campanha" },
        { status: 403 },
      );
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId);

    const condition = isUuid
      ? and(
          eq(campaignAudioTracks.campaignId, campaignId),
          or(eq(campaignAudioTracks.id, trackId), eq(campaignAudioTracks.videoId, trackId)),
        )
      : and(
          eq(campaignAudioTracks.campaignId, campaignId),
          eq(campaignAudioTracks.videoId, trackId),
        );

    const deleted = await db
      .delete(campaignAudioTracks)
      .where(condition)
      .returning({ id: campaignAudioTracks.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: "Faixa não encontrada na campanha" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Faixa removida com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao remover faixa de áudio");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/campaigns/:id/tracks/:trackId
 * Atualiza a cena associada à faixa especificada (apenas o mestre).
 * trackId pode ser o videoId ou o UUID da tabela.
 * Body: { scene?: SceneType | null }
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId, trackId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode alterar a cena da faixa" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { scene: rawScene } = body;

    if (rawScene !== undefined && rawScene !== null && rawScene !== "" && !isSceneValue(rawScene)) {
      return NextResponse.json({ success: false, error: "Cena inválida" }, { status: 400 });
    }
    const scene = isSceneValue(rawScene) ? rawScene : null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackId);

    const condition = isUuid
      ? and(
          eq(campaignAudioTracks.campaignId, campaignId),
          or(eq(campaignAudioTracks.id, trackId), eq(campaignAudioTracks.videoId, trackId)),
        )
      : and(
          eq(campaignAudioTracks.campaignId, campaignId),
          eq(campaignAudioTracks.videoId, trackId),
        );

    const updated = await db.update(campaignAudioTracks).set({ scene }).where(condition).returning({
      id: campaignAudioTracks.id,
      videoId: campaignAudioTracks.videoId,
      scene: campaignAudioTracks.scene,
    });

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: "Faixa não encontrada na campanha" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        trackId,
        scene: updated[0].scene ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar cena da faixa");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
