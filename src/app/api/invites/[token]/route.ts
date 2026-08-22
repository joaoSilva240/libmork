// =============================================================================
// Libmork — API Route: Convite Público (RF-015)
// =============================================================================
// GET sem autenticação (mostra a campanha no link).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/invites/:token
 * Retorna as informações da campanha do convite (público).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const [invite] = await db
      .select()
      .from(campaignInvites)
      .where(
        and(eq(campaignInvites.token, token), eq(campaignInvites.revoked, false))
      )
      .limit(1);

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Convite inválido ou revogado" },
        { status: 404 }
      );
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, invite.campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        campaignId: campaign.id,
        campaignName: campaign.name,
        rulesEngine: campaign.rulesEngine,
        pvpEnabled: campaign.pvpEnabled,
      },
    });
  } catch (error) {
    console.error("Erro ao obter convite:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
