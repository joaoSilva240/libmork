// =============================================================================
// Libmork — API Route: Ficha Pública (RF-023, D-05)
// =============================================================================
// Retorna a ficha somente leitura via token de link público. SEM autenticação.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, publicShareLinks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/public-sheet/:token
 * Retorna a ficha pública do personagem (somente leitura).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const [link] = await db
      .select()
      .from(publicShareLinks)
      .where(
        and(
          eq(publicShareLinks.token, token),
          eq(publicShareLinks.revoked, false)
        )
      )
      .limit(1);

    if (!link) {
      return NextResponse.json(
        { success: false, error: "Link inválido ou revogado" },
        { status: 404 }
      );
    }

    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, link.characterId))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    // Dados públicos: apenas campos de leitura da ficha
    return NextResponse.json({
      success: true,
      data: {
        id: character.id,
        name: character.name,
        imageUrl: character.imageUrl,
        hitPointsMax: character.hitPointsMax,
        hitPointsCurrent: character.hitPointsCurrent,
        manaPointsMax: character.manaPointsMax,
        manaPointsCurrent: character.manaPointsCurrent,
        attributes: character.attributes,
        level: character.level,
        xp: character.xp,
        block: character.block,
        deathStatus: character.deathStatus,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao obter ficha pública');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}