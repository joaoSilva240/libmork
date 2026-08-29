// =============================================================================
// Libmork — API Route: Distribuição de Ficha Pronta (RF-010, D-07)
// =============================================================================
// O mestre cria uma ficha já vinculada a um jogador, que a personaliza depois.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { campaigns, characters, users, characterCampaigns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

const distributeSchema = z.object({
  playerEmail: z.string().email("E-mail do jogador inválido"),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  classId: z.string().uuid().optional().nullable(),
  attributes: z
    .object({
      forca: z.number().int().min(1).max(30),
      destreza: z.number().int().min(1).max(30),
      vigor: z.number().int().min(1).max(30),
      inteligencia: z.number().int().min(1).max(30),
      empatia: z.number().int().min(1).max(30),
    })
    .optional(),
});

/**
 * POST /api/campaigns/:id/distribute
 * Distribui uma ficha pronta para um jogador (apenas o mestre).
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

    const body = await request.json();
    const validation = distributeSchema.safeParse(body);

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

    const { playerEmail, name, classId, attributes } = validation.data;

    // Encontra o jogador pelo e-mail
    const [player] = await db
      .select()
      .from(users)
      .where(eq(users.email, playerEmail))
      .limit(1);

    if (!player) {
      return NextResponse.json(
        { success: false, error: "Jogador não encontrado com este e-mail" },
        { status: 404 }
      );
    }

    // Cria a ficha com o jogador como dono
    const [newCharacter] = await db
      .insert(characters)
      .values({
        ownerId: player.id,
        name,
        classId: classId ?? null,
        attributes: attributes ?? {
          forca: 8,
          destreza: 8,
          vigor: 8,
          inteligencia: 8,
          empatia: 8,
        },
        hitPointsMax: 15,
        hitPointsCurrent: 15,
        manaPointsMax: 5,
        manaPointsCurrent: 5,
        block: 0,
        level: 1,
        xp: 0,
        deathStatus: "alive",
        deathSuccesses: 0,
        deathFailures: 0,
      })
      .returning();

    // Vincula à campanha como distribuída e já aprovada (D-07b)
    const [link] = await db
      .insert(characterCampaigns)
      .values({
        characterId: newCharacter.id,
        campaignId: id,
        origin: "master_distributed",
        approvalStatus: "approved",
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: {
          character: newCharacter,
          link,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao distribuir ficha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
