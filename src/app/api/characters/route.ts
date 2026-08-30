// =============================================================================
// Libmork — API Route: Listar e Criar Personagens (RF-006)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, characterCampaigns, rpgRaces, characterItems, characterSpells } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createCharacterSchema } from "@/lib/validators/character";
import { getDerivedStats } from "@/lib/engine/attributes";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/characters
 * Lista todos os personagens do usuário autenticado.
 */
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const userCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.ownerId, session.user.id));

    return NextResponse.json({
      success: true,
      data: userCharacters,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar personagens');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/characters
 * Cria um novo personagem para o usuário autenticado.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createCharacterSchema.safeParse(body);

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

    const { name, classId, imageUrl, attributes, campaignId, raceId, items: itemsInput, spells: spellsInput } = validation.data;

    // Buscar bônus de raça se fornecido
    let raceHpBonus = 0;
    if (raceId) {
      const [race] = await db.select({ hitPointsBonus: rpgRaces.hitPointsBonus }).from(rpgRaces).where(eq(rpgRaces.id, raceId));
      if (race) raceHpBonus = race.hitPointsBonus;
    }

    const finalAttributes = attributes || { forca: 8, destreza: 8, vigor: 8, inteligencia: 8, empatia: 8 };
    const derived = getDerivedStats(finalAttributes, 1);

    const newCharacter = await db.transaction(async (tx) => {
      const [created] = await tx.insert(characters).values({
        ownerId: session.user.id,
        name,
        classId: classId || null,
        imageUrl: imageUrl || null,
        attributes: finalAttributes,
        hitPointsMax: derived.hitPointsMax + raceHpBonus,
        hitPointsCurrent: derived.hitPointsMax + raceHpBonus,
        manaPointsMax: derived.manaPointsMax,
        manaPointsCurrent: derived.manaPointsMax,
        block: derived.block,
        level: 1,
        xp: 0,
        deathStatus: "alive",
        deathSuccesses: 0,
        deathFailures: 0,
      }).returning();

      if (campaignId) {
        await tx.insert(characterCampaigns).values({
          campaignId,
          characterId: created.id,
          origin: "player_created",
          approvalStatus: "approved",
        });
      }

      if (itemsInput && itemsInput.length > 0) {
        await tx.insert(characterItems).values(
          itemsInput.map((item) => ({
            characterId: created.id,
            itemId: item.itemId,
            quantity: item.quantity,
          }))
        );
      }

      if (spellsInput && spellsInput.length > 0) {
        await tx.insert(characterSpells).values(
          spellsInput.map((spellId) => ({
            characterId: created.id,
            spellId,
          }))
        );
      }

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        data: newCharacter,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar personagem');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
