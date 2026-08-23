// =============================================================================
// Libmork — API Route: Importação de Conteúdo D&D 5e (Magias, Itens, Perícias, Condições)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spells, items, skills, conditions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const DND_ABILITY_MAP: Record<string, "forca" | "destreza" | "vigor" | "inteligencia" | "empatia"> = {
  STR: "forca",
  DEX: "destreza",
  CON: "vigor",
  INT: "inteligencia",
  WIS: "empatia",
  CHA: "empatia",
};

/**
 * POST /api/content/import-dnd
 * Importa Magias, Itens, Perícias e Condições da D&D 5e API para a Biblioteca Global Libmork.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const contentType = body.contentType; // "spells" | "items" | "skills" | "conditions" | "all"

    let importedCount = 0;

    // 1. IMPORTAR MAGIAS D&D 5E
    if (!contentType || contentType === "spells" || contentType === "all") {
      const spellsRes = await fetch("https://www.dnd5eapi.co/api/spells", {
        headers: { Accept: "application/json" },
      });

      if (spellsRes.ok) {
        const spellsData = await spellsRes.json();
        const spellList: Array<{ index: string; name: string }> = spellsData.results || [];
        const topSpells = spellList.slice(0, 50); // Importa as 50 magias principais

        for (const s of topSpells) {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co/api/spells/${s.index}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const circle = Math.max(1, Math.min(9, detail.level || 1));
            const manaCost = circle * 2;
            const description = Array.isArray(detail.desc) ? detail.desc.join("\n") : detail.desc || "";

            await db.insert(spells).values({
              name: detail.name,
              circle,
              manaCost,
              description,
              duration: detail.duration || "Instantâneo",
              useType: "somatic",
              campaignId: null,
            });
            importedCount++;
          } catch (err) {
            console.error(`Erro ao importar magia ${s.index}:`, err);
          }
        }
      }
    }

    // 2. IMPORTAR ITENS & EQUIPAMENTOS D&D 5E
    if (!contentType || contentType === "items" || contentType === "all") {
      const itemsRes = await fetch("https://www.dnd5eapi.co/api/equipment", {
        headers: { Accept: "application/json" },
      });

      if (itemsRes.ok) {
        const itemsData = await itemsRes.json();
        const itemList: Array<{ index: string; name: string }> = itemsData.results || [];
        const topItems = itemList.slice(0, 50);

        for (const itemObj of topItems) {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co/api/equipment/${itemObj.index}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const description = Array.isArray(detail.desc)
              ? detail.desc.join("\n")
              : detail.equipment_category?.name
              ? `Categoria: ${detail.equipment_category.name}`
              : detail.name;

            await db.insert(items).values({
              name: detail.name,
              description,
              qualityDescription: detail.cost ? `Custo: ${detail.cost.quantity} ${detail.cost.unit}` : null,
              campaignId: null,
            });
            importedCount++;
          } catch (err) {
            console.error(`Erro ao importar item ${itemObj.index}:`, err);
          }
        }
      }
    }

    // 3. IMPORTAR PERÍCIAS D&D 5E
    if (!contentType || contentType === "skills" || contentType === "all") {
      const skillsRes = await fetch("https://www.dnd5eapi.co/api/skills", {
        headers: { Accept: "application/json" },
      });

      if (skillsRes.ok) {
        const skillsData = await skillsRes.json();
        const skillList: Array<{ index: string; name: string }> = skillsData.results || [];

        for (const sk of skillList) {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co/api/skills/${sk.index}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const keyAttr = DND_ABILITY_MAP[detail.ability_score?.name] || "destreza";
            const description = Array.isArray(detail.desc) ? detail.desc.join("\n") : "";

            await db.insert(skills).values({
              name: detail.name,
              description,
              keyAttribute: keyAttr,
              rollExpression: `1d20 + ${keyAttr}`,
              campaignId: null,
            });
            importedCount++;
          } catch (err) {
            console.error(`Erro ao importar perícia ${sk.index}:`, err);
          }
        }
      }
    }

    // 4. IMPORTAR CONDIÇÕES D&D 5E
    if (!contentType || contentType === "conditions" || contentType === "all") {
      const condRes = await fetch("https://www.dnd5eapi.co/api/conditions", {
        headers: { Accept: "application/json" },
      });

      if (condRes.ok) {
        const condData = await condRes.json();
        const condList: Array<{ index: string; name: string }> = condData.results || [];

        for (const cond of condList) {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co/api/conditions/${cond.index}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const description = Array.isArray(detail.desc) ? detail.desc.join("\n") : "";

            await db.insert(conditions).values({
              name: detail.name,
              description,
              campaignId: null,
            });
            importedCount++;
          } catch (err) {
            console.error(`Erro ao importar condição ${cond.index}:`, err);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Conteúdo D&D 5e importado com sucesso! (${importedCount} registros cadastrados na Biblioteca Global)`,
    });
  } catch (error) {
    console.error("Erro ao importar conteúdo D&D 5e:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
