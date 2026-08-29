// =============================================================================
// Libmork — API Route: Importação de Conteúdo D&D 5e (Magias, Itens, Perícias, Condições)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spells, items, skills, conditions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, isNull } from "drizzle-orm";
import { fetchPf2eSpellIconFiles, resolvePf2eSpellIcon } from "@/lib/content/pf2e-spell-icons";
import { fetchSf2eItems } from "@/lib/content/sf2e-items";
import { logger } from "@/lib/logger";

const DND_ABILITY_MAP: Record<string, "forca" | "destreza" | "vigor" | "inteligencia" | "empatia"> = {
  STR: "forca",
  DEX: "destreza",
  CON: "vigor",
  INT: "inteligencia",
  WIS: "empatia",
  CHA: "empatia",
};

const PF2ETOOLS_SPELL_INDEX_URL =
  "https://raw.githubusercontent.com/Pf2eToolsOrg/Pf2eTools/dev/data/spells/index.json";
const PF2ETOOLS_SPELLS_BASE_URL =
  "https://raw.githubusercontent.com/Pf2eToolsOrg/Pf2eTools/dev/data/spells/";
const PF2ETOOLS_SOURCE_CONCURRENCY = 6;

const NINEROUTER_URL = process.env.NINEROUTER_URL || "http://100.83.170.1:20128/v1";
const NINEROUTER_KEY = process.env.NINEROUTER_KEY || "";
const NINEROUTER_MODEL = process.env.NINEROUTER_MODEL || "ollama/gpt-oss:120b";

type Pf2eSpell = {
  name?: unknown;
  level?: unknown;
  components?: unknown;
  cast?: { number?: unknown; unit?: unknown; entry?: unknown };
  duration?: { number?: unknown; unit?: unknown; entry?: unknown };
  entries?: unknown;
  range?: unknown;
  target?: unknown;
  targets?: unknown;
  area?: unknown;
  damage?: unknown;
  damageType?: unknown;
  savingThrow?: unknown;
  traits?: unknown;
  traditions?: unknown;
  source?: unknown;
  requirements?: unknown;
  trigger?: unknown;
  extraEffect?: unknown;
  heightened?: unknown;
};

function formatPf2eText(value: unknown): string {
  if (typeof value === "string") {
    return value
      .replace(/\{@[^ ]+\s+([^}|]+)(?:\|[^}]*)?\}/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(formatPf2eText).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (Array.isArray(object.items)) {
      return object.items.map(formatPf2eText).filter(Boolean).map((item) => `• ${item}`).join("\n");
    }
    if (object.entries !== undefined) return formatPf2eText(object.entries);
    if (object.rows && Array.isArray(object.rows)) {
      return object.rows.map(formatPf2eText).filter(Boolean).join("\n");
    }
    return Object.values(object).map(formatPf2eText).filter(Boolean).join("\n");
  }
  return "";
}

function normalizeSpellName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function getPf2eActionCost(spell: Pf2eSpell): number | null {
  const cast = spell.cast;
  if (!cast || typeof cast.unit !== "string") return null;
  const unit = cast.unit.toLocaleLowerCase();
  if (unit === "reaction" || unit === "free") return 0;
  if (unit !== "action" || typeof cast.number !== "number" || !Number.isFinite(cast.number)) {
    return null;
  }
  return Math.max(1, Math.min(3, Math.trunc(cast.number)));
}

function getPf2eDuration(spell: Pf2eSpell): string {
  const duration = spell.duration;
  if (!duration) return "Instantâneo";
  if (typeof duration.entry === "string" && duration.entry.trim()) return duration.entry;
  if (typeof duration.number === "number" && typeof duration.unit === "string") {
    return `${duration.number} ${duration.unit}`;
  }
  return "Instantâneo";
}

function getPf2eUseType(spell: Pf2eSpell): string {
  const types: string[] = [];
  const comps = spell.components;

  if (Array.isArray(comps)) {
    const arr = comps.map(c => String(c).toUpperCase());
    if (arr.includes("V")) types.push("verbal");
    if (arr.includes("S")) types.push("somatic");
    if (arr.includes("M") || arr.includes("F")) types.push("manual");
  } else if (comps && typeof comps === "object") {
    const obj = comps as Record<string, unknown>;
    if (obj.V) types.push("verbal");
    if (obj.S) types.push("somatic");
    if (obj.M || obj.F) types.push("manual");
  }

  if (types.length === 0 && comps) {
    const text = formatPf2eText(comps).toUpperCase();
    if (text.includes("V")) types.push("verbal");
    if (text.includes("S")) types.push("somatic");
    if (text.includes("M") || text.includes("F")) types.push("manual");
  }

  if (types.length === 0) {
    return "somatic";
  }
  const joined = types.join(",");
  // Defensive: ensure never exceeds varchar(250) even if future values are longer
  return joined.length > 250 ? joined.slice(0, 250) : joined;
}

function getPf2eRange(spell: Pf2eSpell): string | null {
  const range = spell.range;
  if (!range) return null;
  if (typeof range === "string") return formatPf2eText(range);
  if (typeof range === "object") {
    const r = range as Record<string, unknown>;
    if (r.number !== undefined && r.unit !== undefined) {
      return `${r.number} ${r.unit}`;
    }
    if (r.entry !== undefined) {
      return formatPf2eText(r.entry);
    }
    if (r.unit !== undefined) {
      return String(r.unit);
    }
  }
  return formatPf2eText(range);
}

function getPf2eTarget(spell: Pf2eSpell): string | null {
  const target = spell.target || spell.targets;
  if (!target) return null;
  return formatPf2eText(target);
}

function getPf2eArea(spell: Pf2eSpell): string | null {
  const area = spell.area;
  if (!area) return null;
  if (typeof area === "object") {
    const a = area as Record<string, unknown>;
    if (a.entry !== undefined) {
      return formatPf2eText(a.entry);
    }
  }
  return formatPf2eText(area);
}

function getPf2eDamageType(spell: Pf2eSpell): string | null {
  if (spell.damageType) return String(spell.damageType);
  if (spell.damage) {
    if (typeof spell.damage === "string") return spell.damage;
    if (typeof spell.damage === "object") {
      const d = spell.damage as Record<string, unknown>;
      if (d.type) return String(d.type);
      if (d.damageType) return String(d.damageType);
    }
  }
  const traits = Array.isArray(spell.traits) ? spell.traits.map((t) => String(t).toLowerCase()) : [];
  const commonTypes = [
    "fire", "acid", "electricity", "cold", "sonic", "force", "mental", 
    "poison", "piercing", "slashing", "bludgeoning", "positive", "negative",
    "vitality", "void", "good", "evil", "lawful", "chaotic", "spirit"
  ];
  for (const t of commonTypes) {
    if (traits.includes(t)) return t;
  }
  const desc = formatPf2eText(spell.entries).toLowerCase();
  for (const t of commonTypes) {
    if (desc.includes(`${t} damage`)) return t;
  }
  return null;
}

function getPf2eCastingTime(spell: Pf2eSpell): string | null {
  const cast = spell.cast;
  if (!cast) return null;
  if (typeof cast === "string") return formatPf2eText(cast);
  if (typeof cast === "object") {
    const c = cast as Record<string, unknown>;
    if (c.number !== undefined && c.unit !== undefined) {
      return `${c.number} ${c.unit}`;
    }
    if (c.entry !== undefined) {
      return formatPf2eText(c.entry);
    }
    if (c.unit !== undefined) {
      return String(c.unit);
    }
  }
  return formatPf2eText(cast);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPf2eDamage(spell: Pf2eSpell): any {
  if (!spell.entries) return null;
  const rawText = typeof spell.entries === "string" ? spell.entries : JSON.stringify(spell.entries);
  
  const regex = /\{@(damage|dice)\s+([^}]+)\}/gi;
  const damageTypes = [
    "fire", "acid", "electricity", "cold", "sonic", "force", "mental", 
    "poison", "piercing", "slashing", "bludgeoning", "positive", "negative",
    "vitality", "void", "good", "evil", "lawful", "chaotic", "spirit",
    "bleed"
  ];
  
  const results: Array<{ formula: string; type: string | null }> = [];
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(rawText)) !== null) {
    const fullMatch = match[0];
    const content = match[2];
    
    // Extract formula (first part before pipe |)
    const formula = content.split('|')[0].trim();
    
    // Search the text right after the match (up to 60 characters)
    const afterIndex = match.index + fullMatch.length;
    const searchArea = rawText.substring(afterIndex, afterIndex + 60).toLowerCase();
    
    let detectedType: string | null = null;
    
    // First try with word boundaries
    for (const type of damageTypes) {
      const typeRegex = new RegExp(`\\b${type}\\b`, 'i');
      if (typeRegex.test(searchArea)) {
        detectedType = type;
        break;
      }
    }
    
    // Fallback if not matched by word boundary (e.g. adjacent characters)
    if (!detectedType) {
      for (const type of damageTypes) {
        if (searchArea.includes(type)) {
          detectedType = type;
          break;
        }
      }
    }
    
    results.push({ formula, type: detectedType });
  }
  
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];
  return results;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function translateSpellWithLLM(spellData: {
  name: string;
  description: string;
  range: string | null;
  target: string | null;
  area: string | null;
  castingTime: string | null;
  damageType: string | null;
  duration: string | null;
  extraEffect: string | null;
}): Promise<unknown> {
  const url = `${NINEROUTER_URL}/chat/completions`;
  const systemPrompt = `You are a translation assistant specialized in tabletop RPG systems, specifically Pathfinder 2nd Edition (PF2e).
Your task is to translate the provided spell details from English to Portuguese (pt-BR).
You MUST keep the terminology structure of Pathfinder 2e (for example: "saving throw" -> "salvamento", "reflex" -> "reflexos", "fortitude" -> "fortitude", "will" -> "vontade", "basic reflex" -> "reflexo básico", "heightened" -> "graduação", "action" -> "ação", etc.).

You must respond with a JSON object containing the translated values for the following fields:
- name
- description
- range
- target
- area
- castingTime
- damageType
- duration
- extraEffect

Keep the formatting clean and preserve any game mechanics accurately. Do not add any conversational text or explanation outside the JSON object.`;

  const userPrompt = JSON.stringify(spellData);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${NINEROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: NINEROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      stream: false
    }),
  });

  if (!response.ok) {
    throw new Error(`9Router API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from 9Router");
  }

  let cleanContent = content.trim();
  
  // Tenta extrair o bloco markdown do JSON (```json ... ``` ou ``` ... ```)
  const match = cleanContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (match) {
    cleanContent = match[1].trim();
  } else {
    // Caso não encontre um bloco de código par, remove backticks soltos do início/fim
    cleanContent = cleanContent
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }
  
  // Garantia adicional: extrai tudo que estiver entre o primeiro caractere JSON válido ({ ou [) e o último (} ou ])
  const firstBrace = cleanContent.indexOf("{");
  const firstBracket = cleanContent.indexOf("[");
  const startIdx = firstBrace !== -1 && firstBracket !== -1 
    ? Math.min(firstBrace, firstBracket) 
    : firstBrace !== -1 
    ? firstBrace 
    : firstBracket;

  const lastBrace = cleanContent.lastIndexOf("}");
  const lastBracket = cleanContent.lastIndexOf("]");
  const endIdx = lastBrace !== -1 && lastBracket !== -1
    ? Math.max(lastBrace, lastBracket)
    : lastBrace !== -1
    ? lastBrace
    : lastBracket;

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanContent = cleanContent.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleanContent);
}

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
    let importedSpellCount = 0;
    let importedDndCount = 0;
    let spellFailed = 0;

    // 1. IMPORTAR MAGIAS PATHFINDER 2E
    if (!contentType || contentType === "spells" || contentType === "all") {
      try {
        const indexRes = await fetch(PF2ETOOLS_SPELL_INDEX_URL, {
          headers: { Accept: "application/json" },
        });
        if (!indexRes.ok) throw new Error(`índice HTTP ${indexRes.status}`);
        const indexData: unknown = await indexRes.json();
        const sourceIndex = indexData && typeof indexData === "object"
          ? (indexData as Record<string, unknown>)
          : {};
        const selectedFiles = [...new Set(Object.values(sourceIndex)
          .filter((file): file is string => typeof file === "string" && file.length > 0))];
        const loadedSpells: Pf2eSpell[] = [];
        for (let offset = 0; offset < selectedFiles.length; offset += PF2ETOOLS_SOURCE_CONCURRENCY) {
          const batch = selectedFiles.slice(offset, offset + PF2ETOOLS_SOURCE_CONCURRENCY);
          const batchSpells = await Promise.all(batch.map(async (file) => {
            try {
              const response = await fetch(`${PF2ETOOLS_SPELLS_BASE_URL}${file}`, {
                headers: { Accept: "application/json" },
              });
              if (!response.ok) throw new Error(`fonte HTTP ${response.status}`);
              const data: unknown = await response.json();
              const entries = data && typeof data === "object"
                ? (data as Record<string, unknown>).spell
                : undefined;
              return Array.isArray(entries) ? entries as Pf2eSpell[] : [];
            } catch (err) {
              logger.error(`Erro ao carregar fonte de magias Pathfinder 2e (${file}):`, err);
              return [];
            }
          }));
          loadedSpells.push(...batchSpells.flat());
        }
        const seenNames = new Set<string>();
        const uniqueSpells = loadedSpells.filter((spell) => {
          const name = typeof spell.name === "string" ? spell.name.trim() : "";
          const key = normalizeSpellName(name);
          if (!name || seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });

        let iconFiles: string[] = [];
        try {
          iconFiles = await fetchPf2eSpellIconFiles();
        } catch (err) {
          logger.error("Erro ao listar ícones de magias Pathfinder 2e:", err);
        }
        const existingSpells = await db.select({ id: spells.id, name: spells.name, imageUrl: spells.imageUrl }).from(spells).where(isNull(spells.campaignId));

        for (const spell of uniqueSpells) {
          const name = spell.name as string;
          const imageUrl = resolvePf2eSpellIcon(name, iconFiles);
          const existing = existingSpells.find((item) => normalizeSpellName(item.name) === normalizeSpellName(name));
          
          const rawLevel = typeof spell.level === "number" ? spell.level : 1;
          const circle = Math.max(1, Math.min(9, Math.trunc(rawLevel)));
          const description = formatPf2eText(spell.entries).slice(0, 5000);

          const duration = getPf2eDuration(spell);
          let useType = getPf2eUseType(spell);
          // Defensive truncation to guarantee varchar(250) compliance
          if (useType.length > 250) useType = useType.slice(0, 250);
          const actionCostOverride = getPf2eActionCost(spell);
          const range = getPf2eRange(spell);
          const target = getPf2eTarget(spell);
          const area = getPf2eArea(spell);
          const damage = extractPf2eDamage(spell);
          const damageType = getPf2eDamageType(spell);
          const castingTime = getPf2eCastingTime(spell);
          const structuredEffectsData = {
            heightened: spell.heightened || null,
            requirements: spell.requirements || null,
            trigger: spell.trigger || null,
            savingThrow: spell.savingThrow || null,
            traits: spell.traits || null,
            traditions: spell.traditions || null,
            source: spell.source || null,
          };

          if (existing) {
            try {
              await db.update(spells).set({
                circle,
                manaCost: circle * 2,
                description,
                duration,
                useType,
                actionCostOverride,
                imageUrl: existing.imageUrl || imageUrl || null,
                range,
                target,
                area,
                damage,
                damageType,
                structuredEffects: structuredEffectsData,
                castingTime,
              }).where(eq(spells.id, existing.id));
              importedCount++;
              importedSpellCount++;
            } catch (err) {
              spellFailed++;
              logger.error('Falha ao importar magia', name, err);
              continue;
            }
          } else {
            try {
              await db.insert(spells).values({
                name,
                circle,
                manaCost: circle * 2,
                description,
                duration,
                useType,
                actionCostOverride,
                campaignId: null,
                imageUrl,
                range,
                target,
                area,
                damage,
                damageType,
                structuredEffects: structuredEffectsData,
                castingTime,
                translation: null,
              });
              importedCount++;
              importedSpellCount++;
            } catch (err) {
              spellFailed++;
              logger.error('Falha ao importar magia', name, err);
              continue;
            }
          }
        }
        if (spellFailed > 0) {
          logger.error(`Magias com falha: ${spellFailed} de ${uniqueSpells.length}`);
        }
        logger.info(`Magias Pathfinder 2e processadas! Criadas/Atualizadas: ${importedSpellCount}, Falhas: ${spellFailed}`);
      } catch (err) {
        logger.error("Erro ao importar magias Pathfinder 2e:", err);
      }
    }

    // 2. IMPORTAR ITENS SF2e (Foundry PF2e, v14-dev)
    let sf2eFailures: Array<{ category: string; error: string }> = [];
    let sf2eCreated = 0;
    let sf2eUpdated = 0;
    if (!contentType || contentType === "items" || contentType === "all") {
      await db.delete(items).where(isNull(items.campaignId));
      const result = await fetchSf2eItems();
      sf2eFailures = result.failures;
      for (const item of result.items) {
        const existing = await db.select({ id: items.id, qualityDescription: items.qualityDescription, counterpointDescription: items.counterpointDescription }).from(items)
          .where(eq(items.sourceKey, item.sourceKey)).then((rows) => rows[0]);
        const values = { name: item.name, description: item.description, imageUrl: item.imageUrl,
          sourceData: item.sourceData, campaignId: null as string | null };
        if (existing) {
          await db.update(items).set(values).where(eq(items.id, existing.id));
          sf2eUpdated++;
        } else {
          await db.insert(items).values({ ...values, sourceKey: item.sourceKey });
          sf2eCreated++;
        }
        importedCount++;
        importedDndCount++;
      }
      const failures = result.failures.length;
      const failureText = failures ? `; ${failures} falhas` : "";
      if (contentType === "items") {
        return NextResponse.json({ success: true, message: `${sf2eCreated} itens SF2e criados, ${sf2eUpdated} atualizados${failureText}`, created: sf2eCreated, updated: sf2eUpdated, failures: result.failures, categories: [...new Set(result.failures.map((failure) => failure.category))] });
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

        const existingSkills = await db.select({ id: skills.id, name: skills.name }).from(skills).where(isNull(skills.campaignId));

        for (const sk of skillList) {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co/api/skills/${sk.index}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const keyAttr = DND_ABILITY_MAP[detail.ability_score?.name] || "destreza";
            const description = Array.isArray(detail.desc) ? detail.desc.join("\n") : "";
            const name = detail.name;
            const rollExpression = `1d20 + ${keyAttr}`;

            const existing = existingSkills.find((item) => normalizeSpellName(item.name) === normalizeSpellName(name));
            if (existing) {
              await db.update(skills).set({
                description,
                keyAttribute: keyAttr,
                rollExpression,
              }).where(eq(skills.id, existing.id));
            } else {
              await db.insert(skills).values({
                name,
                description,
                keyAttribute: keyAttr,
                rollExpression,
                campaignId: null,
              });
            }
            importedCount++;
            importedDndCount++;
          } catch (err) {
            logger.error(`Erro ao importar perícia ${sk.index}:`, err);
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

        const existingConditions = await db.select({ id: conditions.id, name: conditions.name }).from(conditions).where(isNull(conditions.campaignId));

        for (const cond of condList) {
          try {
            const detailRes = await fetch(`https://www.dnd5eapi.co/api/conditions/${cond.index}`);
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();

            const description = Array.isArray(detail.desc) ? detail.desc.join("\n") : "";
            const name = detail.name;

            const existing = existingConditions.find((item) => normalizeSpellName(item.name) === normalizeSpellName(name));
            if (existing) {
              await db.update(conditions).set({
                description,
              }).where(eq(conditions.id, existing.id));
            } else {
              await db.insert(conditions).values({
                name,
                description,
                campaignId: null,
              });
            }
            importedCount++;
            importedDndCount++;
          } catch (err) {
            logger.error(`Erro ao importar condição ${cond.index}:`, err);
          }
        }
      }
    }

    const failureSuffix = spellFailed > 0 ? `; ${spellFailed} falha(s) em magias` : "";
    const message = contentType === "spells"
      ? `${importedSpellCount} magias Pathfinder 2e importadas com sucesso (${importedCount} registros cadastrados na Biblioteca Global)${failureSuffix}`
      : contentType === "all"
      ? `${importedSpellCount} magias Pathfinder 2e e ${importedDndCount} conteúdos D&D 5e importados com sucesso (${importedCount} registros cadastrados na Biblioteca Global)${failureSuffix}`
      : `${importedDndCount} conteúdos importados com sucesso (${importedCount} registros cadastrados na Biblioteca Global)${failureSuffix}`;

    return NextResponse.json({
      success: true,
      message,
      importedCount,
      importedSpellCount,
      spellFailed,
      failures: spellFailed,
      sf2e: { created: sf2eCreated, updated: sf2eUpdated, failures: sf2eFailures, failedCategories: [...new Set(sf2eFailures.map((failure) => failure.category))] },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao importar conteúdo D&D 5e');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
