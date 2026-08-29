// =============================================================================
// Libmork — API Route: Entrar na Campanha via Convite (RF-015)
// =============================================================================
// POST /api/invites/:token/join — jogador autenticado vincula um personagem.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { characters, characterCampaigns, campaignInvites } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ token: string }> };

const joinSchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * POST /api/invites/:token/join
 * Jogador autenticado vincula um de seus personagens à campanha.
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

    const body = await request.json();
    const validation = joinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { characterId } = validation.data;

    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(eq(characters.id, characterId), eq(characters.ownerId, session.user.id))
      )
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    // Verifica se o personagem já está vinculado
    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.characterId, characterId),
          eq(characterCampaigns.campaignId, invite.campaignId)
        )
      )
      .limit(1);

    if (existingLink) {
      return NextResponse.json(
        { success: false, error: "Este personagem já participa da campanha" },
        { status: 409 }
      );
    }

    const [newLink] = await db
      .insert(characterCampaigns)
      .values({
        characterId,
        campaignId: invite.campaignId,
        origin: "invited",
        approvalStatus: "approved",
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newLink,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao entrar na campanha');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}