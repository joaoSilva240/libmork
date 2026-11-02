// =============================================================================
// Libmork — API Route: Faixas de Áudio da Campanha (Issue #60)
// =============================================================================
// GET: Retorna todas as faixas de áudio salvas da campanha.
// POST: Adiciona uma nova faixa de áudio à campanha (apenas mestre).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites, campaignAudioTracks } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { extractYouTubeId } from "@/lib/audio/youtube";
import { eq, and, asc, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

async function userCanAccessCampaign(campaignId: string, userId: string): Promise<boolean> {
  const [campaign] = await db
    .select({ masterId: campaigns.masterId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return false;
  if (campaign.masterId === userId) return true;

  const [invite] = await db
    .select({ id: campaignInvites.id })
    .from(campaignInvites)
    .where(
      and(
        eq(campaignInvites.campaignId, campaignId),
        eq(campaignInvites.userId, userId),
        eq(campaignInvites.revoked, false),
      ),
    )
    .limit(1);

  return !!invite;
}

/**
 * GET /api/campaigns/:id/tracks
 * Lista as faixas de áudio da campanha.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    const hasAccess = await userCanAccessCampaign(campaignId, session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada ou acesso negado" },
        { status: 404 },
      );
    }

    const tracks = await db
      .select()
      .from(campaignAudioTracks)
      .where(eq(campaignAudioTracks.campaignId, campaignId))
      .orderBy(asc(campaignAudioTracks.position), asc(campaignAudioTracks.addedAt));

    // Formatar para o contrato AudioTrack ({ id: videoId, title, addedBy, addedAt, playlistId, playlistName })
    const formatted = tracks.map((t) => ({
      id: t.videoId,
      dbId: t.id,
      title: t.title,
      addedBy: t.addedBy,
      addedAt: t.addedAt.toISOString(),
      playlistId: t.playlistId ?? null,
      playlistName: t.playlistName ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar faixas de áudio");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/campaigns/:id/tracks
 * Adiciona uma nova faixa de áudio à campanha (apenas o mestre).
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
        { success: false, error: "Apenas o mestre pode adicionar faixas à campanha" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { url, videoId: rawVideoId, title: rawTitle } = body;

    const videoId = rawVideoId || (url ? extractYouTubeId(url) : null);
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: "URL ou ID de vídeo do YouTube inválido" },
        { status: 400 },
      );
    }

    // Verificar se a faixa já existe na campanha
    const [existing] = await db
      .select({ id: campaignAudioTracks.id })
      .from(campaignAudioTracks)
      .where(
        and(
          eq(campaignAudioTracks.campaignId, campaignId),
          eq(campaignAudioTracks.videoId, videoId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Esta faixa já foi adicionada à campanha" },
        { status: 409 },
      );
    }

    const title =
      typeof rawTitle === "string" && rawTitle.trim().length > 0
        ? rawTitle.trim().slice(0, 200)
        : videoId;

    const [newTrack] = await db
      .insert(campaignAudioTracks)
      .values({
        campaignId,
        videoId,
        title,
        addedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: {
          id: newTrack.videoId,
          dbId: newTrack.id,
          title: newTrack.title,
          addedBy: newTrack.addedBy,
          addedAt: newTrack.addedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao adicionar faixa de áudio");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/campaigns/:id/tracks
 * Atualiza o playlistId e playlistName de uma lista de faixas da campanha (apenas o mestre).
 * Se playlistId for null, desagrupa as faixas.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: campaignId } = await params;

    const campaign = await getCampaignAsMaster(campaignId, session.user.id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre pode modificar playlists da campanha" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { trackIds, playlistId, playlistName } = body;

    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Lista de trackIds inválida" },
        { status: 400 },
      );
    }

    await db
      .update(campaignAudioTracks)
      .set({
        playlistId: playlistId ?? null,
        playlistName: playlistName ?? null,
      })
      .where(
        and(
          eq(campaignAudioTracks.campaignId, campaignId),
          inArray(campaignAudioTracks.videoId, trackIds),
        ),
      );

    return NextResponse.json({
      success: true,
      data: { trackIds, playlistId: playlistId ?? null, playlistName: playlistName ?? null },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar playlist das faixas");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
