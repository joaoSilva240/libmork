// =============================================================================
// Libmork — API Route: Transferência de Riquezas entre Personagens (Issue #36)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { transferWealthSchema } from "@/lib/validators/wealth";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { CoinsBalance } from "@/lib/validators/character";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = transferWealthSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { sourceCharacterId, targetCharacterId, coinType, amount } = parsed.data;

    // Execução atômica com db.transaction
    const result = await db.transaction(async (tx) => {
      // 1. Busca os dois personagens do usuário autenticado
      const [sourceChar] = await tx
        .select({
          id: characters.id,
          name: characters.name,
          ownerId: characters.ownerId,
          coins: characters.coins,
        })
        .from(characters)
        .where(
          and(
            eq(characters.id, sourceCharacterId),
            eq(characters.ownerId, session.user.id)
          )
        )
        .limit(1);

      if (!sourceChar) {
        return { status: 404, error: "Personagem de origem não encontrado ou não pertence a você" };
      }

      const [targetChar] = await tx
        .select({
          id: characters.id,
          name: characters.name,
          ownerId: characters.ownerId,
          coins: characters.coins,
        })
        .from(characters)
        .where(
          and(
            eq(characters.id, targetCharacterId),
            eq(characters.ownerId, session.user.id)
          )
        )
        .limit(1);

      if (!targetChar) {
        return { status: 404, error: "Personagem de destino não encontrado ou não pertence a você" };
      }

      // 2. Normaliza moedas do personagem de origem
      const sourceCoins: CoinsBalance = {
        bronze: 0,
        prata: 0,
        ouro: 0,
        platina: 0,
        diamante: 0,
        ...((sourceChar.coins as CoinsBalance | null) ?? {}),
      };

      const currentBalance = sourceCoins[coinType] ?? 0;
      if (currentBalance < amount) {
        return {
          status: 400,
          error: `Saldo insuficiente de ${coinType}. Disponível: ${currentBalance}, solicitado: ${amount}`,
        };
      }

      // 3. Normaliza moedas do personagem de destino
      const targetCoins: CoinsBalance = {
        bronze: 0,
        prata: 0,
        ouro: 0,
        platina: 0,
        diamante: 0,
        ...((targetChar.coins as CoinsBalance | null) ?? {}),
      };

      // 4. Calcula novos saldos
      const updatedSourceCoins: CoinsBalance = {
        ...sourceCoins,
        [coinType]: currentBalance - amount,
      };

      const updatedTargetCoins: CoinsBalance = {
        ...targetCoins,
        [coinType]: (targetCoins[coinType] ?? 0) + amount,
      };

      // 5. Atualiza no banco de dados de forma atômica
      await tx
        .update(characters)
        .set({ coins: updatedSourceCoins, updatedAt: new Date() })
        .where(eq(characters.id, sourceCharacterId));

      await tx
        .update(characters)
        .set({ coins: updatedTargetCoins, updatedAt: new Date() })
        .where(eq(characters.id, targetCharacterId));

      return { status: 200, success: true };
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Transferência realizada com sucesso",
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao transferir riqueza entre personagens");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
