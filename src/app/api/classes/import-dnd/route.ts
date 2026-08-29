// =============================================================================
// Libmork — API Route: Importação de Classes via D&D 5e API (dnd5eapi.co)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { logger } from "@/lib/logger";

interface DnDClassDetail {
  index: string;
  name: string;
  hit_die: number;
  proficiencies?: Array<{ index: string; name: string }>;
  saving_throws?: Array<{ index: string; name: string }>;
  starting_equipment?: Array<{
    equipment: { name: string; index: string; url: string };
    quantity: number;
  }>;
  spellcasting?: {
    level: number;
    spellcasting_ability: { index: string; name: string };
  };
}

interface DnDLevelDetail {
  level: number;
  ability_score_bonuses?: number;
  prof_bonus?: number;
  features?: Array<{ index: string; name: string }>;
  spellcasting?: Record<string, unknown>;
  class_specific?: Record<string, unknown>;
}

async function fetchAndImportDndClass(index: string, translateWithLLM: boolean) {
  try {
    const [classRes, levelsRes] = await Promise.all([
      fetch(`https://www.dnd5eapi.co/api/classes/${index}`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`https://www.dnd5eapi.co/api/classes/${index}/levels`, {
        headers: { Accept: "application/json" },
      }),
    ]);

    if (!classRes.ok) return null;

    const classData: DnDClassDetail = await classRes.json();
    const levelsData: DnDLevelDetail[] = levelsRes.ok ? await levelsRes.json() : [];

    // Parse proficiências
    const weapons: string[] = [];
    const armor: string[] = [];
    const languages: string[] = [];
    const tools: string[] = [];

    (classData.proficiencies || []).forEach((prof) => {
      const pName = prof.name.toLowerCase();
      if (pName.includes("armor") || pName.includes("shield")) {
        armor.push(prof.name);
      } else if (pName.includes("weapon") || pName.includes("crossbow") || pName.includes("sword") || pName.includes("dagger")) {
        weapons.push(prof.name);
      } else if (pName.includes("tool") || pName.includes("kit") || pName.includes("instrument") || pName.includes("supplies") || pName.includes("cards") || pName.includes("dice")) {
        tools.push(prof.name);
      } else if (pName.includes("language")) {
        languages.push(prof.name);
      } else {
        weapons.push(prof.name);
      }
    });

    // Parse itens iniciais
    const initialItems = (classData.starting_equipment || []).map((eq) => ({
      item_id: null,
      name: eq.equipment.name,
      quantity: eq.quantity || 1,
      description: `Equipamento inicial padrão de ${classData.name}`,
    }));

    const hitDie = classData.hit_die || 8;
    const isCaster = Boolean(classData.spellcasting);
    const savingThrows = (classData.saving_throws || []).map((s) => s.name).join(", ");
    let classDescription = `Dado de Vida: d${hitDie}. Testes de Resistência: ${savingThrows || "Nenhum"}.`;

    // Parse níveis 1 a 20
    const rawBenefitsByLevel: Array<{
      level: number;
      hp_bonus: number;
      mana_bonus: number;
      attribute_bonuses?: Record<string, number>;
      extra_trained_skills?: number;
      advantages?: string[];
      description: string;
    }> = [];

    for (let lvl = 1; lvl <= 20; lvl++) {
      const lvlData = levelsData.find((l) => l.level === lvl);
      const features = (lvlData?.features || []).map((f) => f.name);
      const isAsi = (lvlData?.ability_score_bonuses ?? 0) > 0 || lvl === 4 || lvl === 8 || lvl === 12 || lvl === 16 || lvl === 19;
      const manaBonus = isCaster ? (lvl === 1 ? 5 : 3) : 0;
      const hpBonus = Math.ceil(hitDie / 2) + 1;

      const descList: string[] = [];
      if (features.length > 0) {
        descList.push(`Características: ${features.join(", ")}`);
      }
      if (isAsi) {
        descList.push("Aumento no Valor de Habilidade (+2 ou +1/+1)");
      }
      if (lvlData?.prof_bonus) {
        descList.push(`Bônus de Proficiência: +${lvlData.prof_bonus}`);
      }

      rawBenefitsByLevel.push({
        level: lvl,
        hp_bonus: hpBonus,
        mana_bonus: manaBonus,
        attribute_bonuses: undefined,
        extra_trained_skills: lvl === 1 ? 2 : 0,
        advantages: features,
        description: descList.join(". ") || `Progressão do Nível ${lvl}`,
      });
    }

    let finalName = classData.name;
    let finalDescription = classDescription;
    let finalProficiencies = { weapons, armor, languages, tools };
    let finalInitialItems = initialItems;
    let finalBenefits = rawBenefitsByLevel;

    // Tradução opcional com LLM / 9Router
    if (translateWithLLM) {
      try {
        const payloadToTranslate = {
          name: classData.name,
          description: classDescription,
          proficiencies: { weapons, armor, languages, tools },
          initialItems: initialItems.map((i) => ({ name: i.name, quantity: i.quantity, description: i.description })),
          benefits: rawBenefitsByLevel.map((b) => ({
            level: b.level,
            advantages: b.advantages,
            description: b.description,
          })),
        };

        const translated = await translateContentWithLLM(
          "class",
          payloadToTranslate,
          `Você é um especialista em D&D 5e e tradução de RPG. Traduza o nome da classe, descrição, proficiências, nomes dos itens iniciais e descrição/habilidades dos níveis para Português do Brasil (pt-BR). Retorne estritamente um JSON com a mesma estrutura de chaves.`
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
            weapons: Array.isArray(tp.weapons) ? (tp.weapons as string[]) : weapons,
            armor: Array.isArray(tp.armor) ? (tp.armor as string[]) : armor,
            languages: Array.isArray(tp.languages) ? (tp.languages as string[]) : languages,
            tools: Array.isArray(tp.tools) ? (tp.tools as string[]) : tools,
          };
        }
        if (Array.isArray(translated.initialItems)) {
          finalInitialItems = (translated.initialItems as Array<{ name?: string; quantity?: number; description?: string }>).map((item, idx) => ({
            item_id: null,
            name: item.name || initialItems[idx]?.name || "Item",
            quantity: Number(item.quantity) || initialItems[idx]?.quantity || 1,
            description: item.description || initialItems[idx]?.description || "",
          }));
        }
        if (Array.isArray(translated.benefits)) {
          const transBenefits = translated.benefits as Array<{ level?: number; advantages?: string[]; description?: string }>;
          finalBenefits = rawBenefitsByLevel.map((orig, idx) => {
            const tb = transBenefits[idx];
            return {
              ...orig,
              advantages: Array.isArray(tb?.advantages) ? tb.advantages : orig.advantages,
              description: typeof tb?.description === "string" ? tb.description : orig.description,
            };
          });
        }
      } catch (err) {
        logger.warn({ err, className: classData.name }, "[fetchAndImportDndClass] Falha na tradução via LLM, mantendo termos originais");
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

      const benefitRows = finalBenefits.map((b) => ({
        classId: newClass.id,
        level: b.level,
        benefits: {
          hp_bonus: b.hp_bonus,
          mana_bonus: b.mana_bonus,
          attribute_bonuses: b.attribute_bonuses,
          extra_trained_skills: b.extra_trained_skills,
          advantages: b.advantages,
          description: b.description,
        },
      }));

      if (benefitRows.length > 0) {
        await tx.insert(classLevelBenefits).values(benefitRows);
      }

      return newClass;
    });

    return createdClass;
  } catch (err) {
    logger.error({ err, index }, "Erro ao importar classe D&D 5e");
    return null;
  }
}

/**
 * POST /api/classes/import-dnd
 * Importa uma ou várias classes da D&D 5e API com seus respectivos benefícios de nível.
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
    const translateWithLLM: boolean = Boolean(body.translateWithLLM);
    let targetIndexes: string[] = [];

    if (body.importAll) {
      const catalogRes = await fetch("https://www.dnd5eapi.co/api/classes", {
        headers: { Accept: "application/json" },
      });
      if (catalogRes.ok) {
        const catalogData = await catalogRes.json();
        targetIndexes = (catalogData.results || []).map((c: { index: string }) => c.index);
      } else {
        targetIndexes = [
          "barbarian", "bard", "cleric", "druid", "fighter", "monk",
          "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"
        ];
      }
    } else if (Array.isArray(body.classIndexes) && body.classIndexes.length > 0) {
      targetIndexes = body.classIndexes;
    } else {
      targetIndexes = [
        "barbarian", "bard", "cleric", "druid", "fighter", "monk",
        "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"
      ];
    }

    const importedClasses = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < targetIndexes.length; i += BATCH_SIZE) {
      const chunk = targetIndexes.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        chunk.map((idx) => fetchAndImportDndClass(idx, translateWithLLM))
      );
      for (const res of results) {
        if (res) importedClasses.push(res);
      }
      if (i + BATCH_SIZE < targetIndexes.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedClasses.length} classe(s) do D&D 5e importada(s) com sucesso para a biblioteca!`,
      data: importedClasses,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro na rota de importação de classes D&D 5e");
    return NextResponse.json(
      { success: false, error: "Erro ao importar classes da API D&D 5e" },
      { status: 500 }
    );
  }
}
