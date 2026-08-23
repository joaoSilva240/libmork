// =============================================================================
// Libmork — API Route: Importação de Monstros via D&D 5e API (dnd5eapi.co)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const POPULAR_DND_MONSTERS = [
  "goblin",
  "skeleton",
  "orc",
  "zombie",
  "wolf",
  "owlbear",
  "mimic",
  "minotaur",
  "troll",
  "gargoyle",
  "kobold",
  "bandit",
  "vampire-spawn",
  "young-red-dragon",
  "beholder",
];

interface DnDMonsterResponse {
  index: string;
  name: string;
  hit_points: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  challenge_rating: number;
  xp?: number;
  image?: string;
  actions?: Array<{
    name: string;
    attack_bonus?: number;
    desc?: string;
    damage?: Array<{ damage_dice?: string }>;
  }>;
}

/**
 * POST /api/npcs/import-dnd
 * Importa monstros da D&D 5e API para a Biblioteca de Libmork.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const monsterIndexes: string[] =
      Array.isArray(body.monsterIndexes) && body.monsterIndexes.length > 0
        ? body.monsterIndexes
        : POPULAR_DND_MONSTERS;

    const importedMonsters = [];

    for (const index of monsterIndexes) {
      try {
        const res = await fetch(`https://www.dnd5eapi.co/api/monsters/${index}`, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) continue;

        const data: DnDMonsterResponse = await res.json();

        const clamp = (val: number, min = 1, max = 30) => Math.max(min, Math.min(max, Math.round(val || 10)));

        const level = clamp(Math.ceil(data.challenge_rating || 1), 1, 20);
        const xpReward = data.xp || Math.round((data.challenge_rating || 1) * 100);
        const imageUrl = data.image ? `https://www.dnd5eapi.co${data.image}` : null;

        const [created] = await db
          .insert(npcs)
          .values({
            name: data.name,
            npcType: "enemy",
            ownerId: session.user.id,
            worldId: null,
            hitPoints: data.hit_points || 10,
            hitPointsMax: data.hit_points || 10,
            manaPoints: 0,
            manaPointsMax: 0,
            level,
            xpReward,
            imageUrl,
            attributes: {
              forca: clamp(data.strength),
              destreza: clamp(data.dexterity),
              vigor: clamp(data.constitution),
              inteligencia: clamp(data.intelligence),
              empatia: clamp(Math.max(data.wisdom || 10, data.charisma || 10)),
            },
          })
          .returning();

        // Adicionar ações como pins do NPC
        if (data.actions && data.actions.length > 0) {
          const pinValues = data.actions.slice(0, 5).map((action) => {
            const bonus = action.attack_bonus ? ` +${action.attack_bonus}` : "";
            const dice = action.damage?.[0]?.damage_dice ? ` (${action.damage[0].damage_dice})` : "";
            return {
              npcId: created.id,
              pinType: "attack" as const,
              label: action.name,
              rollExpression: `1d20${bonus}${dice}`,
            };
          });

          await db.insert(npcPins).values(pinValues);
        }

        importedMonsters.push(created);
      } catch (err) {
        console.error(`Erro ao importar monstro ${index}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedMonsters.length} monstros do D&D 5e importados com sucesso para a biblioteca!`,
      data: importedMonsters,
    });
  } catch (error) {
    console.error("Erro na rota de importação D&D 5e:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao importar monstros da API D&D 5e" },
      { status: 500 }
    );
  }
}
