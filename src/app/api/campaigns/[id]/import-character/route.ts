// =============================================================================
// Libmork — API Route: Importar Personagem para Campanha (Issue #4)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, characterCampaigns, campaignInvites } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const importCharacterSchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * POST /api/campaigns/:id/import-character
 * Vincula um personagem existente do jogador a uma campanha.
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

    const body = await request.json();
    const validation = importCharacterSchema.safeParse(body);

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
    const { id: campaignId } = await params;

    // Verificar se o personagem existe e pertence ao usuário autenticado
    const [character] = await db
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.id, characterId),
          eq(characters.ownerId, session.user.id)
        )
      )
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se o usuário tem convite ativo para a campanha
    const [invite] = await db
      .select()
      .from(campaignInvites)
      .where(
        and(
          eq(campaignInvites.userId, session.user.id),
          eq(campaignInvites.campaignId, campaignId),
          eq(campaignInvites.revoked, false)
        )
      )
      .limit(1);

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "Você não tem convite ativo para esta campanha" },
        { status: 403 }
      );
    }

    // Verificar se o personagem já está vinculado a esta campanha
    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.characterId, characterId),
          eq(characterCampaigns.campaignId, campaignId)
        )
      )
      .limit(1);

    if (existingLink) {
      return NextResponse.json(
        { success: false, error: "Este personagem já está vinculado a esta campanha" },
        { status: 409 }
      );
    }

    // Inserir vínculo
    const [newLink] = await db
      .insert(characterCampaigns)
      .values({
        characterId,
        campaignId,
        origin: "imported",
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
    logger.error({ err: error }, "Erro ao importar personagem para campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
