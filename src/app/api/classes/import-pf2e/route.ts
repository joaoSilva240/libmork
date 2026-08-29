// =============================================================================
// Libmork — API Route: Importação de Classes Pathfinder 2e
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { PF2E_CLASSES, Pf2eClassDefinition } from "@/lib/content/pf2e-classes";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { logger } from "@/lib/logger";

async function importSinglePf2eClass(def: Pf2eClassDefinition, translateWithLLM: boolean) {
  try {
    let finalName = def.name;
    let finalDescription = def.description;
    let finalProficiencies = def.proficiencies;
    let finalInitialItems = def.initialItems.map((item) => ({
      item_id: null,
      name: item.name,
      quantity: item.quantity,
      description: item.description,
    }));
    let finalLevels = def.levels;

    if (translateWithLLM) {
      try {
        const payloadToTranslate = {
          name: def.name,
          description: def.description,
          proficiencies: def.proficiencies,
          initialItems: def.initialItems,
          benefits: def.levels.map((lvl) => ({
            level: lvl.level,
            advantages: lvl.advantages,
            description: lvl.description,
          })),
        };

        const translated = await translateContentWithLLM(
          "class",
          payloadToTranslate,
          `Você é um especialista em Pathfinder 2e (PF2e) e tradução para RPG de mesa. Traduza os nomes, termos, descrições e itens para Português do Brasil (pt-BR). Mantenha estritamente a mesma estrutura JSON.`
        );

        if (typeof translated.name === "string" && translated.name) {
          finalName = translated.name;
        }
        if (typeof translated.description === "string" && translated.description) {
          finalDescription = translated.description;
        }
        if (translated.proficiencies && typeof translated.proficiencies === "object") {
          const tp = translated.proficiencies as Record<string, unknown>;
          finalProficiencies = {
            weapons: Array.isArray(tp.weapons) ? (tp.weapons as string[]) : def.proficiencies.weapons,
            armor: Array.isArray(tp.armor) ? (tp.armor as string[]) : def.proficiencies.armor,
            languages: Array.isArray(tp.languages) ? (tp.languages as string[]) : def.proficiencies.languages,
            tools: Array.isArray(tp.tools) ? (tp.tools as string[]) : def.proficiencies.tools,
          };
        }
        if (Array.isArray(translated.initialItems)) {
          finalInitialItems = (translated.initialItems as Array<{ name?: string; quantity?: number; description?: string }>).map((item, idx) => ({
            item_id: null,
            name: item.name || def.initialItems[idx]?.name || "Item",
            quantity: Number(item.quantity) || def.initialItems[idx]?.quantity || 1,
            description: item.description || def.initialItems[idx]?.description || "",
          }));
        }
        if (Array.isArray(translated.benefits)) {
          const transBenefits = translated.benefits as Array<{ level?: number; advantages?: string[]; description?: string }>;
          finalLevels = def.levels.map((orig, idx) => {
            const tb = transBenefits[idx];
            return {
              ...orig,
              advantages: Array.isArray(tb?.advantages) ? tb.advantages : orig.advantages,
              description: typeof tb?.description === "string" ? tb.description : orig.description,
            };
          });
        }
      } catch (err) {
        logger.warn({ err, className: def.name }, "[importSinglePf2eClass] Falha na tradução via LLM, mantendo dados originais");
      }
    }

    const createdClass = await db.transaction(async (tx) => {
      const [newClass] = await tx
        .insert(rpgClasses)
        .values({
          name: finalName,
          description: finalDescription,
          initialItems: finalInitialItems,
          proficiencies: finalProficiencies,
        })
        .returning();

      const benefitRows = finalLevels.map((lvl) => ({
        classId: newClass.id,
        level: lvl.level,
        benefits: {
          hp_bonus: lvl.hpBonus,
          mana_bonus: lvl.manaBonus,
          attribute_bonuses: lvl.attributeBonuses,
          extra_trained_skills: lvl.extraTrainedSkills,
          advantages: lvl.advantages,
          skills_granted: lvl.skillsGranted,
          spells_granted: lvl.spellsGranted,
          description: lvl.description,
        },
      }));

      if (benefitRows.length > 0) {
        await tx.insert(classLevelBenefits).values(benefitRows);
      }

      return newClass;
    });

    return createdClass;
  } catch (error) {
    logger.error({ err: error, className: def.name }, "Erro ao importar classe Pathfinder 2e");
    return null;
  }
}

/**
 * POST /api/classes/import-pf2e
 * Importa uma ou várias classes da coleção de 23 classes do Pathfinder 2e.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar classes" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const classKeys: string[] = Array.isArray(body.classKeys) ? body.classKeys : [];
    const importAll: boolean = Boolean(body.importAll);
    const translateWithLLM: boolean = Boolean(body.translateWithLLM);

    let targetClasses: Pf2eClassDefinition[] = [];

    if (importAll) {
      targetClasses = PF2E_CLASSES;
    } else if (classKeys.length > 0) {
      targetClasses = PF2E_CLASSES.filter((c) => classKeys.includes(c.key));
    } else {
      targetClasses = PF2E_CLASSES;
    }

    const importedClasses = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < targetClasses.length; i += BATCH_SIZE) {
      const batch = targetClasses.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((cls) => importSinglePf2eClass(cls, translateWithLLM))
      );
      for (const item of results) {
        if (item) importedClasses.push(item);
      }
      if (i + BATCH_SIZE < targetClasses.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedClasses.length} classe(s) do Pathfinder 2e importada(s) com sucesso para a biblioteca!`,
      data: importedClasses,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro na rota de importação Pathfinder 2e");
    return NextResponse.json(
      { success: false, error: "Erro ao importar classes do Pathfinder 2e" },
      { status: 500 }
    );
  }
}
