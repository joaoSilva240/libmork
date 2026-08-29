// =============================================================================
// Libmork — API Route: Importação de Monstros/NPCs do Pathfinder 2e
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, npcPins } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { fetchAndParsePf2eMonster, fetchPf2eMonsterCatalog } from "@/lib/content/pf2e-monsters";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { logger } from "@/lib/logger";

async function importSinglePf2eMonster(path: string, userId: string, translateWithLLM: boolean) {
  try {
    const monsterData = await fetchAndParsePf2eMonster(path);
    if (!monsterData) return null;

    let finalName = monsterData.name;
    let finalPins = monsterData.pins;

    // Tradução opcional com LLM/9Router
    if (translateWithLLM) {
      try {
        const payloadToTranslate = {
          name: monsterData.name,
          pins: monsterData.pins.map((p) => p.label),
        };

        const translated = await translateContentWithLLM("item", payloadToTranslate, 
          `Translate this tabletop RPG Pathfinder 2e Monster name and skill/attack labels from English to Brazilian Portuguese. Return JSON only with "name" and "pins" array of translated labels.`
        );

        if (typeof translated.name === "string" && translated.name) {
          finalName = translated.name;
        }
        if (Array.isArray(translated.pins)) {
          const pinsArray = translated.pins as unknown[];
          finalPins = monsterData.pins.map((p, idx) => ({
            ...p,
            label: typeof pinsArray[idx] === "string" ? (pinsArray[idx] as string) : p.label,
          }));
        }
      } catch (err) {
        logger.warn({ err, monsterName: monsterData.name }, "[importSinglePf2eMonster] Falha na tradução via LLM, mantendo original");
      }
    }

    const createdNpc = await db.transaction(async (tx) => {
      const [npc] = await tx
        .insert(npcs)
        .values({
          name: finalName,
          npcType: "enemy",
          ownerId: userId,
          worldId: null,
          hitPoints: monsterData.hitPoints,
          hitPointsMax: monsterData.hitPoints,
          manaPoints: monsterData.manaPoints,
          manaPointsMax: monsterData.manaPoints,
          level: Math.max(1, monsterData.level),
          xpReward: monsterData.xpReward,
          imageUrl: monsterData.imageUrl,
          attributes: monsterData.attributes,
        })
        .returning();

      if (finalPins.length > 0) {
        const pinRows = finalPins.map((pin) => ({
          npcId: npc.id,
          pinType: pin.pinType,
          label: pin.label,
          rollExpression: pin.rollExpression || null,
          manaCost: pin.manaCost || null,
          circle: pin.circle || null,
        }));

        await tx.insert(npcPins).values(pinRows);
      }

      return npc;
    });

    return createdNpc;
  } catch (error) {
    logger.error({ err: error, path }, "[importSinglePf2eMonster] Erro ao importar monstro");
    return null;
  }
}

/**
 * POST /api/npcs/import-pf2e
 * Importa um ou vários monstros da coleção de Bestiários do Pathfinder 2e.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const monsterPaths: string[] = Array.isArray(body.monsterPaths) ? body.monsterPaths : [];
    const importAll: boolean = Boolean(body.importAll);
    const translateWithLLM: boolean = Boolean(body.translateWithLLM);

    let targetPaths: string[] = monsterPaths;

    if (importAll) {
      const fullCatalog = await fetchPf2eMonsterCatalog();
      targetPaths = fullCatalog.map((c) => c.path);
    }

    const MAX_BATCH_IMPORT = 50;

    if (targetPaths.length > MAX_BATCH_IMPORT) {
      return NextResponse.json(
        {
          success: false,
          error: `Limite por requisição excedido. Selecione até ${MAX_BATCH_IMPORT} monstros por vez para evitar timeouts.`,
        },
        { status: 400 }
      );
    }

    const importedNpcs = [];
    const BATCH_SIZE = 3; // Reduz de 10 para 3 requisições simultâneas para mitigar limite e timeout no GitHub Raw

    for (let i = 0; i < targetPaths.length; i += BATCH_SIZE) {
      const batch = targetPaths.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((path) => importSinglePf2eMonster(path, session.user.id, translateWithLLM))
      );
      for (const item of results) {
        if (item) importedNpcs.push(item);
      }
      // Pequena pausa entre lotes de busca no GitHub
      if (i + BATCH_SIZE < targetPaths.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedNpcs.length} monstros do Pathfinder 2e importados com sucesso para a biblioteca!`,
      data: importedNpcs,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro na rota de importação Pathfinder 2e');
    return NextResponse.json(
      { success: false, error: "Erro ao importar monstros do Pathfinder 2e" },
      { status: 500 }
    );
  }
}
