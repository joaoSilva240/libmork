// =============================================================================
// Libmork — API Route: Importação de Ancestralidades Pathfinder 2e
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { PF2E_RACES, Pf2eRaceDefinition } from "@/lib/content/pf2e-races";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { logger } from "@/lib/logger";

async function importSinglePf2eRace(def: Pf2eRaceDefinition, translateWithLLM: boolean) {
  try {
    let finalName = def.name;
    let finalDescription = def.description;
    let finalSize = def.size;
    let finalLanguages = def.languages;
    let finalTraits = def.traits;
    let finalHeritages = def.heritages;

    if (translateWithLLM) {
      try {
        const payloadToTranslate = {
          name: def.name,
          description: def.description,
          size: def.size,
          languages: def.languages,
          traits: def.traits,
          heritages: def.heritages,
        };

        const translated = await translateContentWithLLM(
          "race",
          payloadToTranslate,
          `Você é um especialista em Pathfinder 2e (PF2e) e tradução para RPG de mesa. Traduza os nomes, termos, descrições, traços raciais e linhagens para Português do Brasil (pt-BR). Mantenha estritamente a mesma estrutura JSON.`
        );

        if (typeof translated.name === "string" && translated.name) {
          finalName = translated.name;
        }
        if (typeof translated.description === "string" && translated.description) {
          finalDescription = translated.description;
        }
        if (typeof translated.size === "string" && translated.size) {
          finalSize = translated.size;
        }
        if (Array.isArray(translated.languages)) {
          finalLanguages = (translated.languages as unknown[])
            .filter((l): l is string => typeof l === "string" && Boolean(l));
        }
        if (Array.isArray(translated.traits)) {
          finalTraits = (translated.traits as Array<{ name?: string; description?: string }>).map((t, idx) => ({
            name: t.name || def.traits[idx]?.name || "Traço Racial",
            description: t.description ?? def.traits[idx]?.description ?? "",
          }));
        }
        if (Array.isArray(translated.heritages)) {
          finalHeritages = (translated.heritages as Array<{ name?: string; description?: string }>).map((h, idx) => ({
            name: h.name || def.heritages[idx]?.name || "Herança",
            description: h.description ?? def.heritages[idx]?.description ?? "",
          }));
        }
      } catch (err) {
        logger.warn({ err, raceName: def.name }, "[importSinglePf2eRace] Falha na tradução via LLM, mantendo dados originais");
      }
    }

    const [createdRace] = await db
      .insert(rpgRaces)
      .values({
        name: finalName,
        description: finalDescription,
        speed: def.speed,
        size: finalSize,
        hitPointsBonus: def.hitPointsBonus,
        attributeBonuses: def.attributeBonuses,
        languages: finalLanguages,
        traits: finalTraits,
        heritages: finalHeritages,
        sourceSystem: "pf2e",
      })
      .returning();

    return createdRace;
  } catch (err) {
    logger.error({ err, raceKey: def.key }, "Erro ao importar ancestralidade individual PF2e");
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem importar conteúdo" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { keys, all = false, translateWithLLM = false } = body;

    let targetDefs: Pf2eRaceDefinition[] = [];

    if (all) {
      targetDefs = PF2E_RACES;
    } else if (Array.isArray(keys) && keys.length > 0) {
      targetDefs = PF2E_RACES.filter((r) => keys.includes(r.key));
    } else {
      return NextResponse.json(
        { success: false, error: "Nenhuma ancestralidade selecionada para importação" },
        { status: 400 }
      );
    }

    const importedRaces = [];
    for (const def of targetDefs) {
      const imported = await importSinglePf2eRace(def, translateWithLLM);
      if (imported) {
        importedRaces.push(imported);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedRaces.length} ancestralidades do Pathfinder 2e importadas com sucesso`,
      data: importedRaces,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro na rota de importação Pathfinder 2e");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
