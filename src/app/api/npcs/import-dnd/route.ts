// =============================================================================
// Libmork — API Route: Importação de Monstros via D&D 5e API (dnd5eapi.co)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { logger } from "@/lib/logger";

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

const clamp = (val: number, min = 1, max = 30) => Math.max(min, Math.min(max, Math.round(val || 10)));

async function fetchAndImportMonster(index: string, userId: string, translateWithLLM = false) {
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/monsters/${index}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    const data: DnDMonsterResponse = await res.json();

    let finalName = data.name;
    let finalActions = data.actions;

    if (translateWithLLM) {
      try {
        const payloadToTranslate = {
          name: data.name,
          actions: data.actions?.slice(0, 5).map((a) => a.name) || [],
        };
        const translated = await translateContentWithLLM(
          "item",
          payloadToTranslate,
          `Translate this D&D 5e monster name and action labels from English to Brazilian Portuguese. Return JSON with "name" and "actions" array of strings.`
        );
        if (typeof translated.name === "string" && translated.name) {
          finalName = translated.name;
        }
        if (Array.isArray(translated.actions) && data.actions) {
          const actArray = translated.actions as unknown[];
          finalActions = data.actions.map((act, idx) => ({
            ...act,
            name: typeof actArray[idx] === "string" ? (actArray[idx] as string) : act.name,
          }));
        }
      } catch (err) {
        logger.warn({ err, monsterName: data.name }, "[fetchAndImportMonster D&D 5e] Falha na tradução via LLM");
      }
    }

    const level = clamp(Math.ceil(data.challenge_rating || 1), 1, 20);
    const xpReward = data.xp || Math.round((data.challenge_rating || 1) * 100);
    const imageUrl = data.image ? `https://www.dnd5eapi.co${data.image}` : null;

    const [created] = await db.transaction(async (tx) => {
      const [npc] = await tx
        .insert(npcs)
        .values({
          name: finalName,
          npcType: "enemy",
          ownerId: userId,
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

      if (finalActions && finalActions.length > 0) {
        const pinValues = finalActions.slice(0, 5).map((action) => {
          const bonus = action.attack_bonus ? ` +${action.attack_bonus}` : "";
          const dice = action.damage?.[0]?.damage_dice ? ` (${action.damage[0].damage_dice})` : "";
          return {
            npcId: npc.id,
            pinType: "attack" as const,
            label: action.name,
            rollExpression: `1d20${bonus}${dice}`,
          };
        });

        await tx.insert(npcPins).values(pinValues);
      }

      return [npc];
    });

    return created;
  } catch (err) {
    logger.error({ err, index }, "Erro ao importar monstro");
    return null;
  }
}

/**
 * POST /api/npcs/import-dnd
 * Importa um, vários ou TODOS os 334 monstros da D&D 5e API.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const translateWithLLM: boolean = Boolean(body.translateWithLLM);
    let targetIndexes: string[] = [];

    if (body.importAll) {
      const catalogRes = await fetch("https://www.dnd5eapi.co/api/monsters", {
        headers: { Accept: "application/json" },
      });
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json();
        targetIndexes = (catalogData.results || []).map((m: { index: string }) => m.index);
      }
    } else if (Array.isArray(body.monsterIndexes) && body.monsterIndexes.length > 0) {
      targetIndexes = body.monsterIndexes;
    } else {
      // Lista expandida com top 30 se não especificado
      targetIndexes = [
        "goblin", "skeleton", "orc", "zombie", "wolf", "owlbear", "mimic", "minotaur",
        "troll", "gargoyle", "kobold", "bandit", "vampire-spawn", "young-red-dragon",
        "beholder", "aboleth", "adult-black-dragon", "basilisk", "bugbear", "centaur",
        "chimera", "cockatrice", "cyclops", "dryad", "ettin", "ghoul", "giant-spider",
        "griffin", "harpy", "hydra", "lich", "manticore", "mummy", "nothic", "pegasus",
        "satyr", "shadow", "specter", "tarrasque", "unicorn", "wight", "wraith", "wyvern"
      ];
    }

    const importedMonsters = [];
    const BATCH_SIZE = 15;

    // Processa em lotes com limite para evitar timeout
    for (let i = 0; i < targetIndexes.length; i += BATCH_SIZE) {
      const chunk = targetIndexes.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        chunk.map((idx) => fetchAndImportMonster(idx, session.user.id, translateWithLLM))
      );
      for (const res of results) {
        if (res) importedMonsters.push(res);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedMonsters.length} monstros da D&D 5e API importados com sucesso para a biblioteca!`,
      data: importedMonsters,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro na rota de importação D&D 5e');
    return NextResponse.json(
      { success: false, error: "Erro ao importar monstros da API D&D 5e" },
      { status: 500 }
    );
  }
}
