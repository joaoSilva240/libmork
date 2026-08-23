// =============================================================================
// Libmork — API Route: Log da Sessão da Campanha (RF-050)
// =============================================================================
// GET: mestre da campanha. Lista em ordem decrescente (mais recentes primeiro).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaignLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { getCampaignAsMaster } from "@/lib/auth/campaign-access";
import { eq, desc } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/logs?limit=100
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

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500);

    const logs = await db
      .select()
      .from(campaignLogs)
      .where(eq(campaignLogs.campaignId, id))
      .orderBy(desc(campaignLogs.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Erro ao carregar logs:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
