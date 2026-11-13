// =============================================================================
// Libmork — API Route: Log da Sessão da Campanha (RF-050)
// =============================================================================
// GET: mestre da campanha. Lista em ordem decrescente (mais recentes primeiro).
// Logs antigos (gravados antes de actorImageUrl no payload) recebem o avatar
// resolvido pelo próprio ator, para o card nunca ficar sem imagem retroativamente.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignLogs, characters, npcs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq, desc, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

type LogPayload = Record<string, unknown>;

/**
 * Resolve os avatares dos atores que ainda não os têm gravado no payload.
 */
async function resolveMissingAvatars(logs: Array<typeof campaignLogs.$inferSelect>) {
  const pending = logs.filter((log) => {
    const payload = (log.payload ?? {}) as LogPayload;
    return (
      !("actorImageUrl" in payload) &&
      Boolean(log.actorId) &&
      (log.actorType === "character" || log.actorType === "npc")
    );
  });

  if (pending.length === 0) return new Map<string, string | null>();

  const characterIds = [
    ...new Set(
      pending.filter((log) => log.actorType === "character").map((log) => log.actorId as string),
    ),
  ];
  const npcIds = [
    ...new Set(
      pending.filter((log) => log.actorType === "npc").map((log) => log.actorId as string),
    ),
  ];

  const [characterRows, npcRows] = await Promise.all([
    characterIds.length
      ? db
          .select({ id: characters.id, imageUrl: characters.imageUrl })
          .from(characters)
          .where(inArray(characters.id, characterIds))
      : [],
    npcIds.length
      ? db
          .select({ id: npcs.id, imageUrl: npcs.imageUrl })
          .from(npcs)
          .where(inArray(npcs.id, npcIds))
      : [],
  ]);

  return new Map<string, string | null>(
    [...characterRows, ...npcRows].map((row) => [row.id, row.imageUrl]),
  );
}

/**
 * GET /api/campaigns/:id/logs?limit=100
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const campaign = await getCampaignAsMaster(id, session.user.id);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 },
      );
    }

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500);

    const logs = await db
      .select()
      .from(campaignLogs)
      .where(eq(campaignLogs.campaignId, id))
      .orderBy(desc(campaignLogs.createdAt))
      .limit(limit);

    const avatars = await resolveMissingAvatars(logs);

    const data = logs.map((log) => {
      const payload = (log.payload ?? {}) as LogPayload;
      if ("actorImageUrl" in payload) return log;

      return {
        ...log,
        payload: {
          ...payload,
          actorImageUrl: log.actorId ? (avatars.get(log.actorId) ?? null) : null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao carregar logs");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
