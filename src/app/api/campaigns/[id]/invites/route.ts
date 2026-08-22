// =============================================================================
// Libmork — API Route: Convites de Campanha (RF-015)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/campaigns/:id/invites
 * Lista convites da campanha (apenas o mestre).
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

    const invites = await db
      .select()
      .from(campaignInvites)
      .where(eq(campaignInvites.campaignId, id))
      .orderBy(campaignInvites.createdAt);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json({
      success: true,
      data: invites.map((invite) => ({
        ...invite,
        url: `${baseUrl}/invite/${invite.token}`,
      })),
    });
  } catch (error) {
    console.error("Erro ao listar convites:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/invites
 * Gera um novo convite com token de alta entropia (apenas o mestre).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

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

    const token = generateUrlSafeToken(32);

    const [newInvite] = await db
      .insert(campaignInvites)
      .values({
        campaignId: id,
        token,
        revoked: false,
      })
      .returning();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newInvite,
          url: `${baseUrl}/invite/${newInvite.token}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao gerar convite:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
