// =============================================================================
// Libmork — API Route: Riquezas do Jogador (Issue #36)
// =============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { CoinsBalance } from "@/lib/validators/character";

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
      .select({
        id: characters.id,
        name: characters.name,
        imageUrl: characters.imageUrl,
        level: characters.level,
        deathStatus: characters.deathStatus,
        coins: characters.coins,
      })
      .from(characters)
      .where(eq(characters.ownerId, session.user.id));

    const totals: CoinsBalance = {
      bronze: 0,
      prata: 0,
      ouro: 0,
      platina: 0,
      diamante: 0,
    };

    const characterList = userCharacters.map((char) => {
      const charCoins = (char.coins as CoinsBalance | null) ?? {
        bronze: 0,
        prata: 0,
        ouro: 0,
        platina: 0,
        diamante: 0,
      };

      const normalizedCoins: CoinsBalance = {
        bronze: Number(charCoins.bronze) || 0,
        prata: Number(charCoins.prata) || 0,
        ouro: Number(charCoins.ouro) || 0,
        platina: Number(charCoins.platina) || 0,
        diamante: Number(charCoins.diamante) || 0,
      };

      totals.bronze += normalizedCoins.bronze;
      totals.prata += normalizedCoins.prata;
      totals.ouro += normalizedCoins.ouro;
      totals.platina += normalizedCoins.platina;
      totals.diamante += normalizedCoins.diamante;

      return {
        id: char.id,
        name: char.name,
        imageUrl: char.imageUrl,
        level: char.level,
        deathStatus: char.deathStatus,
        coins: normalizedCoins,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totals,
        characters: characterList,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao obter riquezas do jogador");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
