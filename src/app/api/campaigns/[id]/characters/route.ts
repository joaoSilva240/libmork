// =============================================================================
// Libmork — API Route: Vínculo Personagem ↔ Campanha (RF-011, D-07)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns, characters, characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const linkCharacterSchema = z.object({
  characterId: z.string().uuid(),
});

/**
 * GET /api/campaigns/:id/characters
 * Lista personagens vinculados à campanha (mestre ou dono do personagem).
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

    const links = await db
      .select({
        linkId: characterCampaigns.id,
        characterId: characters.id,
        name: characters.name,
        level: characters.level,
        imageUrl: characters.imageUrl,
        approvalStatus: characterCampaigns.approvalStatus,
        origin: characterCampaigns.origin,
        sessionsPlayed: characterCampaigns.sessionsPlayed,
      })
      .from(characterCampaigns)
      .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
      .where(eq(characterCampaigns.campaignId, id));

    return NextResponse.json({
      success: true,
      data: links,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar vínculos");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/characters
 * Vincula um personagem à campanha (RF-011).
 * - Dono do personagem vincula: origin "player_created", status "pending"
 * - Mestre da campanha vincula: origin "master_distributed", status "approved"
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
      .where(eq(campaigns.id, id))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = linkCharacterSchema.safeParse(body);

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
      .where(eq(characters.id, characterId))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    const isMaster = campaign.masterId === session.user.id;
    const isOwner = character.ownerId === session.user.id;

    if (!isMaster && !isOwner) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para vincular este personagem" },
        { status: 403 }
      );
    }

    // Verifica se o vínculo já existe
    const [existingLink] = await db
      .select()
      .from(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.characterId, characterId),
          eq(characterCampaigns.campaignId, id)
        )
      )
      .limit(1);

    if (existingLink) {
      return NextResponse.json(
        { success: false, error: "Personagem já vinculado a esta campanha" },
        { status: 409 }
      );
    }

    const [newLink] = await db
      .insert(characterCampaigns)
      .values({
        characterId,
        campaignId: id,
        origin: isMaster ? "master_distributed" : "player_created",
        approvalStatus: isMaster ? "approved" : "pending",
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
    logger.error({ err: error }, "Erro ao vincular personagem");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
