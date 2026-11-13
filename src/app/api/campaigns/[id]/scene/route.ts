// =============================================================================
// Libmork — API Route: Cena ativa da campanha (Issue #86, Fase 1)
// =============================================================================
// PATCH: Persiste a cena ativa do escudo do mestre e registra a transição no
// log da sessão (apenas o mestre dono). Body: { scene, encounterAction? }.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { isSceneValue, SCENES, type ActiveScene } from "@/lib/scenes/sceneConfig";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/campaigns/:id/scene
 * Define a cena ativa (null = modo Livre) e registra a transição no log.
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
        { success: false, error: "Apenas o mestre pode gerenciar cenas na campanha" },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      scene?: unknown;
      encounterAction?: unknown;
    } | null;

    const rawScene = body?.scene;
    if (rawScene !== null && !isSceneValue(rawScene)) {
      return NextResponse.json({ success: false, error: "Cena inválida" }, { status: 400 });
    }
    const scene = (rawScene ?? null) as ActiveScene;

    const encounterAction: "ended" | "kept" | null =
      body?.encounterAction === "ended" || body?.encounterAction === "kept"
        ? body.encounterAction
        : null;

    await db
      .update(campaigns)
      .set({ activeScene: scene, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    let description = scene
      ? `Cena: ${SCENES[scene].label} iniciada`
      : "Cena desativada — modo Livre";
    if (encounterAction === "ended") description += " — encontro encerrado";
    else if (encounterAction === "kept") description += " — encontro mantido em 2º plano";

    try {
      await db.insert(campaignLogs).values({
        campaignId,
        actorType: "master",
        actorName: session.user.masterName || session.user.displayName || "Mestre",
        action: "scene_change",
        description,
        payload: { scene, encounterAction },
        createdById: session.user.id,
      });
    } catch (logErr) {
      logger.warn({ err: logErr }, "Falha ao registrar log de mudança de cena");
    }

    return NextResponse.json({ success: true, data: { campaignId, scene } });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar cena da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
