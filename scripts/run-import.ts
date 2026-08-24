// =============================================================================
// Libmork — CLI Script: run-import.ts
// =============================================================================

import { config } from "dotenv";
import { resolve } from "path";

// Carrega variáveis de ambiente ANTES de importar o DB
config({ path: resolve(process.cwd(), ".env.local") });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { spells, items, skills, conditions } from "../src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Verifique o .env.local");
}

const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(client, { schema });
import { fetchPf2eSpellIconFiles, resolvePf2eSpellIcon } from "../src/lib/content/pf2e-spell-icons";

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
  return types.join(",");
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

async function runImport() {
  console.log("=== INICIANDO IMPORTAÇÃO DE CONTEÚDO GLOBAL ===");
  
  let spellCreated = 0;
  let spellUpdated = 0;
  let itemCreated = 0;
  let itemUpdated = 0;
  let skillCreated = 0;
  let skillUpdated = 0;
  let conditionCreated = 0;
  let conditionUpdated = 0;

  try {
    // 1. IMPORTAR MAGIAS PATHFINDER 2E
    console.log("\n[1/4] Buscando índice de Magias Pathfinder 2e...");
    const indexRes = await fetch(PF2ETOOLS_SPELL_INDEX_URL, {
      headers: { Accept: "application/json" },
    });
    if (!indexRes.ok) throw new Error(`índice HTTP ${indexRes.status}`);
    const indexData: any = await indexRes.json();
    const sourceIndex = indexData && typeof indexData === "object" ? indexData : {};
    
    const selectedFiles = [...new Set(Object.values(sourceIndex)
      .filter((file): file is string => typeof file === "string" && file.length > 0))];
    
    console.log(`Carregando magias a partir de ${selectedFiles.length} fontes...`);
    const loadedSpells: Pf2eSpell[] = [];
    
    for (let offset = 0; offset < selectedFiles.length; offset += PF2ETOOLS_SOURCE_CONCURRENCY) {
      const batch = selectedFiles.slice(offset, offset + PF2ETOOLS_SOURCE_CONCURRENCY);
      const batchSpells = await Promise.all(batch.map(async (file) => {
        try {
          const response = await fetch(`${PF2ETOOLS_SPELLS_BASE_URL}${file}`, {
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error(`fonte HTTP ${response.status}`);
          const data: any = await response.json();
          const entries = data && typeof data === "object" ? data.spell : undefined;
          return Array.isArray(entries) ? (entries as Pf2eSpell[]) : [];
        } catch (err: any) {
          console.error(`Erro ao carregar fonte de magias Pathfinder 2e (${file}):`, err.message);
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

    console.log(`Total de magias únicas encontradas: ${uniqueSpells.length}. Buscando ícones...`);
    
    let iconFiles: string[] = [];
    try {
      iconFiles = await fetchPf2eSpellIconFiles();
    } catch (err: any) {
      console.error("Erro ao listar ícones de magias Pathfinder 2e:", err.message);
    }

    console.log("Consultando banco por magias globais existentes...");
    const existingSpells = await db
      .select({ id: spells.id, name: spells.name, imageUrl: spells.imageUrl })
      .from(spells)
      .where(isNull(spells.campaignId));

    console.log("Populando/atualizando magias no banco...");
    for (const spell of uniqueSpells) {
      const name = spell.name as string;
      const imageUrl = resolvePf2eSpellIcon(name, iconFiles);
      const existing = existingSpells.find((item) => normalizeSpellName(item.name) === normalizeSpellName(name));
      
      const rawLevel = typeof spell.level === "number" ? spell.level : 1;
      const circle = Math.max(1, Math.min(9, Math.trunc(rawLevel)));
      const description = formatPf2eText(spell.entries).slice(0, 5000);

      const duration = getPf2eDuration(spell);
      const useType = getPf2eUseType(spell);
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
        spellUpdated++;
      } else {
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
        spellCreated++;
      }
    }
    console.log(`-> Magias Pathfinder 2e processadas! Criadas: ${spellCreated}, Atualizadas: ${spellUpdated}`);

    // 2. IMPORTAR ITENS & EQUIPAMENTOS D&D 5E
    console.log("\n[2/4] Buscando Itens & Equipamentos D&D 5e...");
    const itemsRes = await fetch("https://www.dnd5eapi.co/api/equipment", {
      headers: { Accept: "application/json" },
    });

    if (itemsRes.ok) {
      const itemsData: any = await itemsRes.json();
      const itemList: Array<{ index: string; name: string }> = itemsData.results || [];
      const topItems = itemList.slice(0, 50);

      const existingItems = await db
        .select({ id: items.id, name: items.name })
        .from(items)
        .where(isNull(items.campaignId));

      for (const itemObj of topItems) {
        try {
          const detailRes = await fetch(`https://www.dnd5eapi.co/api/equipment/${itemObj.index}`);
          if (!detailRes.ok) continue;
          const detail: any = await detailRes.json();

          const description = Array.isArray(detail.desc)
            ? detail.desc.join("\n")
            : detail.equipment_category?.name
            ? `Categoria: ${detail.equipment_category.name}`
            : detail.name;

          const name = detail.name;
          const qualityDescription = detail.cost ? `Custo: ${detail.cost.quantity} ${detail.cost.unit}` : null;

          const existing = existingItems.find((item) => normalizeSpellName(item.name) === normalizeSpellName(name));
          if (existing) {
            await db.update(items).set({
              description,
              qualityDescription,
            }).where(eq(items.id, existing.id));
            itemUpdated++;
          } else {
            await db.insert(items).values({
              name,
              description,
              qualityDescription,
              campaignId: null,
            });
            itemCreated++;
          }
        } catch (err: any) {
          console.error(`Erro ao importar item ${itemObj.index}:`, err.message);
        }
      }
      console.log(`-> Itens D&D 5e processados! Criados: ${itemCreated}, Atualizados: ${itemUpdated}`);
    } else {
      console.error(`Falha ao buscar equipamentos D&D 5e: ${itemsRes.status}`);
    }

    // 3. IMPORTAR PERÍCIAS D&D 5E
    console.log("\n[3/4] Buscando Perícias D&D 5e...");
    const skillsRes = await fetch("https://www.dnd5eapi.co/api/skills", {
      headers: { Accept: "application/json" },
    });

    if (skillsRes.ok) {
      const skillsData: any = await skillsRes.json();
      const skillList: Array<{ index: string; name: string }> = skillsData.results || [];

      const existingSkills = await db
        .select({ id: skills.id, name: skills.name })
        .from(skills)
        .where(isNull(skills.campaignId));

      for (const sk of skillList) {
        try {
          const detailRes = await fetch(`https://www.dnd5eapi.co/api/skills/${sk.index}`);
          if (!detailRes.ok) continue;
          const detail: any = await detailRes.json();

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
            skillUpdated++;
          } else {
            await db.insert(skills).values({
              name,
              description,
              keyAttribute: keyAttr,
              rollExpression,
              campaignId: null,
            });
            skillCreated++;
          }
        } catch (err: any) {
          console.error(`Erro ao importar perícia ${sk.index}:`, err.message);
        }
      }
      console.log(`-> Perícias D&D 5e processadas! Criadas: ${skillCreated}, Atualizadas: ${skillUpdated}`);
    } else {
      console.error(`Falha ao buscar perícias D&D 5e: ${skillsRes.status}`);
    }

    // 4. IMPORTAR CONDIÇÕES D&D 5E
    console.log("\n[4/4] Buscando Condições D&D 5e...");
    const condRes = await fetch("https://www.dnd5eapi.co/api/conditions", {
      headers: { Accept: "application/json" },
    });

    if (condRes.ok) {
      const condData: any = await condRes.json();
      const condList: Array<{ index: string; name: string }> = condData.results || [];

      const existingConditions = await db
        .select({ id: conditions.id, name: conditions.name })
        .from(conditions)
        .where(isNull(conditions.campaignId));

      for (const cond of condList) {
        try {
          const detailRes = await fetch(`https://www.dnd5eapi.co/api/conditions/${cond.index}`);
          if (!detailRes.ok) continue;
          const detail: any = await detailRes.json();

          const description = Array.isArray(detail.desc) ? detail.desc.join("\n") : "";
          const name = detail.name;

          const existing = existingConditions.find((item) => normalizeSpellName(item.name) === normalizeSpellName(name));
          if (existing) {
            await db.update(conditions).set({
              description,
            }).where(eq(conditions.id, existing.id));
            conditionUpdated++;
          } else {
            await db.insert(conditions).values({
              name,
              description,
              campaignId: null,
            });
            conditionCreated++;
          }
        } catch (err: any) {
          console.error(`Erro ao importar condição ${cond.index}:`, err.message);
        }
      }
      console.log(`-> Condições D&D 5e processadas! Criadas: ${conditionCreated}, Atualizadas: ${conditionUpdated}`);
    } else {
      console.error(`Falha ao buscar condições D&D 5e: ${condRes.status}`);
    }

  } catch (error: any) {
    console.error("\nErro fatal durante a importação:", error.message);
  } finally {
    console.log("\nFechando conexões do banco de dados...");
    await client.end();
    console.log("Conexão fechada com sucesso.");
    
    console.log("\n=== RESUMO DA IMPORTAÇÃO ===");
    console.log(`- Magias:   Criadas: ${spellCreated} | Atualizadas: ${spellUpdated}`);
    console.log(`- Itens:    Criados: ${itemCreated} | Atualizados: ${itemUpdated}`);
    console.log(`- Perícias: Criadas: ${skillCreated} | Atualizadas: ${skillUpdated}`);
    console.log(`- Condições:Criadas: ${conditionCreated} | Atualizadas: ${conditionUpdated}`);
    console.log("=============================");
  }
}

runImport();
