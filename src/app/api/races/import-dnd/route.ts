// =============================================================================
// Libmork — API Route: Importação de Raças D&D 5e (dnd5eapi.co)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgRaces } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { logger } from "@/lib/logger";

interface DnDAbilityBonus {
  ability_score: { index: string; name: string };
  bonus: number;
}

interface DnDReference {
  index: string;
  name: string;
  url: string;
}

interface DnDRaceDetail {
  index: string;
  name: string;
  speed: number;
  ability_bonuses?: DnDAbilityBonus[];
  alignment?: string;
  age?: string;
  size?: string;
  size_description?: string;
  languages?: DnDReference[];
  language_desc?: string;
  traits?: DnDReference[];
  subraces?: DnDReference[];
}

const DND_ABILITY_MAP: Record<string, string> = {
  STR: "forca",
  DEX: "destreza",
  CON: "vigor",
  INT: "inteligencia",
  WIS: "empatia",
  CHA: "empatia",
};

const SIZE_MAP: Record<string, string> = {
  Medium: "Médio",
  Small: "Pequeno",
  Large: "Grande",
  Tiny: "Miúdo",
};

async function fetchAndImportDndRace(index: string, translateWithLLM: boolean) {
  try {
    const res = await fetch(`https://www.dnd5eapi.co/api/races/${index}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;

    const raceData: DnDRaceDetail = await res.json();

    // Map attributes
    const attributeBonuses: Record<string, number> = {};
    (raceData.ability_bonuses || []).forEach((ab) => {
      const code = ab.ability_score?.name?.toUpperCase() || "";
      const mapped = DND_ABILITY_MAP[code];
      if (mapped) {
        attributeBonuses[mapped] = (attributeBonuses[mapped] || 0) + ab.bonus;
      }
    });

    // Languages
    const languages = (raceData.languages || []).map((l) => l.name);

    // Fetch Trait Descriptions
    const traitPromises = (raceData.traits || []).map(async (t) => {
      try {
        const trRes = await fetch(`https://www.dnd5eapi.co${t.url}`, {
          headers: { Accept: "application/json" },
        });
        if (trRes.ok) {
          const trData = await trRes.json();
          const desc = Array.isArray(trData.desc) ? trData.desc.join("\n\n") : String(trData.desc || "");
          return { name: t.name, description: desc };
        }
      } catch {}
      return { name: t.name, description: "" };
    });

    // Fetch Subrace Descriptions
    const subracePromises = (raceData.subraces || []).map(async (s) => {
      try {
        const subRes = await fetch(`https://www.dnd5eapi.co${s.url}`, {
          headers: { Accept: "application/json" },
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          const desc = subData.desc || "";
          return { name: s.name, description: desc };
        }
      } catch {}
      return { name: s.name, description: "" };
    });

    const [traits, heritages] = await Promise.all([
      Promise.all(traitPromises),
      Promise.all(subracePromises),
    ]);

    const size = SIZE_MAP[raceData.size || "Medium"] || raceData.size || "Médio";
    const descParts = [
      raceData.alignment,
      raceData.age,
      raceData.size_description,
      raceData.language_desc,
    ].filter(Boolean);
    const description = descParts.join("\n\n") || `Raça ${raceData.name} do D&D 5e.`;

    let finalName = raceData.name;
    let finalDescription = description;
    let finalSize = size;
    let finalLanguages = languages;
    let finalTraits = traits;
    let finalHeritages = heritages;

    if (translateWithLLM) {
      try {
        const payloadToTranslate = {
          name: raceData.name,
          description,
          size,
          languages,
          traits,
          heritages,
        };

        const translated = await translateContentWithLLM(
          "race",
          payloadToTranslate,
          `Você é um especialista em D&D 5e e tradução de RPG. Traduza o nome da raça, descrição, tamanho (Medium->Médio, Small->Pequeno), idiomas, traços raciais (nome e descrição) e sub-raças (nome e descrição) para Português do Brasil (pt-BR). Retorne estritamente um JSON com a mesma estrutura de chaves.`
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
            name: t.name || traits[idx]?.name || "Traço Racial",
            description: t.description ?? traits[idx]?.description ?? "",
          }));
        }
        if (Array.isArray(translated.heritages)) {
          finalHeritages = (translated.heritages as Array<{ name?: string; description?: string }>).map((h, idx) => ({
            name: h.name || heritages[idx]?.name || "Sub-raça",
            description: h.description ?? heritages[idx]?.description ?? "",
          }));
        }
      } catch (err) {
        logger.warn({ err, raceName: raceData.name }, "[fetchAndImportDndRace] Falha na tradução via LLM, mantendo termos originais");
      }
    }

    const [createdRace] = await db
      .insert(rpgRaces)
      .values({
        name: finalName,
        description: finalDescription,
        speed: raceData.speed || 30,
        size: finalSize,
        hitPointsBonus: 0,
        attributeBonuses,
        languages: finalLanguages,
        traits: finalTraits,
        heritages: finalHeritages,
        sourceSystem: "dnd5e",
      })
      .returning();

    return createdRace;
  } catch (err) {
    logger.error({ err, index }, "Erro ao processar importação de raça D&D 5e");
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
    const { indexes, all = false, translateWithLLM = false } = body;

    let targetIndexes: string[] = [];

    if (all) {
      const res = await fetch("https://www.dnd5eapi.co/api/races", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        targetIndexes = (data.results || []).map((r: { index: string }) => r.index);
      }
    } else if (Array.isArray(indexes) && indexes.length > 0) {
      targetIndexes = indexes;
    } else {
      return NextResponse.json(
        { success: false, error: "Nenhuma raça selecionada para importação" },
        { status: 400 }
      );
    }

    const importedRaces = [];
    for (const index of targetIndexes) {
      const imported = await fetchAndImportDndRace(index, translateWithLLM);
      if (imported) {
        importedRaces.push(imported);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${importedRaces.length} raças importadas com sucesso do D&D 5e`,
      data: importedRaces,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro na rota de importação de raças D&D 5e");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
