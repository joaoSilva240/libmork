// =============================================================================
// Libmork — API Route: Revogar Convite de Campanha (RF-015)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and, or } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; inviteId: string }> };

/**
 * DELETE /api/campaigns/:id/invites/:inviteId
 * Revoga um convite por inviteId ou userId (apenas o mestre).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, inviteId } = await params;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const [invite] = await db
      .select()
      .from(campaignInvites)
      .where(
        and(
          eq(campaignInvites.campaignId, id),
          or(
            eq(campaignInvites.id, inviteId),
            eq(campaignInvites.userId, inviteId)
          )
        )
      )
      .limit(1);

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Convite não encontrado" },
        { status: 404 }
      );
    }

    await db
      .update(campaignInvites)
      .set({ revoked: true })
      .where(eq(campaignInvites.id, invite.id));

    return NextResponse.json({
      success: true,
      message: "Convite revogado com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao revogar convite");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
