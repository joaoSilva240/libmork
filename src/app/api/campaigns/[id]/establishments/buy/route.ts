import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { establishmentInventory, characterItems, characterSpells, characterSkills, characters } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import type { CoinsBalance } from "@/lib/validators/character";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(); const user = session?.user;
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const { characterId, inventoryItemId } = body;

    if (!characterId || !inventoryItemId) {
      return NextResponse.json({ error: "Dados incompletos para a compra" }, { status: 400 });
    }

    const [item] = await db
      .select()
      .from(establishmentInventory)
      .where(eq(establishmentInventory.id, inventoryItemId));

    if (!item) {
      return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    if (item.stock === 0) {
      return NextResponse.json({ error: "Produto esgotado no estabelecimento" }, { status: 400 });
    }

    // --- Validação e Dedução de Ouro ANTES de adicionar ao inventário (Issue #35) ---
    const finalPrice = Number(item.priceGold) || 0;
    let newCoins: CoinsBalance | null = null;

    if (finalPrice > 0) {
      const [character] = await db
        .select({ coins: characters.coins })
        .from(characters)
        .where(eq(characters.id, characterId));

      const currentCoins: CoinsBalance = (character?.coins as CoinsBalance) ?? {
        bronze: 0,
        prata: 0,
        ouro: 0,
        platina: 0,
        diamante: 0,
      };

      const currentGold = currentCoins.ouro ?? 0;

      if (currentGold < finalPrice) {
        return NextResponse.json(
          {
            success: false,
            error: `Ouro insuficiente para realizar a compra. Necessário: ${finalPrice} Ouro, Saldo atual: ${currentGold} Ouro.`,
          },
          { status: 400 }
        );
      }

      newCoins = {
        ...currentCoins,
        ouro: currentGold - finalPrice,
      };
    }

    // Processar adição de acordo com o contentType
    const contentType = item.contentType || "items";

    if ((contentType === "items" || !contentType) && item.contentId) {
      const [existingItem] = await db
        .select()
        .from(characterItems)
        .where(
          and(
            eq(characterItems.characterId, characterId),
            eq(characterItems.itemId, item.contentId)
          )
        );

      if (existingItem) {
        await db
          .update(characterItems)
          .set({ quantity: existingItem.quantity + 1 })
          .where(eq(characterItems.id, existingItem.id));
      } else {
        await db.insert(characterItems).values({
          characterId,
          itemId: item.contentId,
          quantity: 1,
        });
      }
    } else if (contentType === "spells" && item.contentId) {
      const [existingSpell] = await db
        .select()
        .from(characterSpells)
        .where(
          and(
            eq(characterSpells.characterId, characterId),
            eq(characterSpells.spellId, item.contentId)
          )
        );

      if (existingSpell) {
        return NextResponse.json({
          success: false,
          error: "Personagem já possui esta magia!",
        }, { status: 400 });
      }

      try {
        await db.insert(characterSpells).values({
          characterId,
          spellId: item.contentId,
        });
      } catch {
        return NextResponse.json({
          success: false,
          error: "Personagem já possui esta magia!",
        }, { status: 400 });
      }
    } else if (contentType === "skills" && item.contentId) {
      const [existingSkill] = await db
        .select()
        .from(characterSkills)
        .where(
          and(
            eq(characterSkills.characterId, characterId),
            eq(characterSkills.skillId, item.contentId)
          )
        );

      if (existingSkill) {
        return NextResponse.json({
          success: false,
          error: "Personagem já possui esta habilidade!",
        }, { status: 400 });
      }

      try {
        await db.insert(characterSkills).values({
          characterId,
          skillId: item.contentId,
          trained: true,
        });
      } catch {
        return NextResponse.json({
          success: false,
          error: "Personagem já possui esta habilidade!",
        }, { status: 400 });
      }
    }

    // Aplicar dedução de ouro se houver
    if (newCoins) {
      await db
        .update(characters)
        .set({ coins: newCoins })
        .where(eq(characters.id, characterId));
    }

    // Atualiza o estoque do estabelecimento se não for infinito (-1)
    if (item.stock > 0) {
      await db
        .update(establishmentInventory)
        .set({ stock: item.stock - 1 })
        .where(eq(establishmentInventory.id, inventoryItemId));
    }

    return NextResponse.json({
      success: true,
      message: `Item "${item.name}" comprado com sucesso!`,
      ...(newCoins ? { remainingCoins: newCoins } : {}),
    });
  } catch (err) {
    console.error("[Buy Establishment Item Error]:", err);
    return NextResponse.json({ error: "Erro ao processar compra" }, { status: 500 });
  }
}
