// =============================================================================
// Libmork — Helper: Leitor e Parser de Monstros Pathfinder 2e (Foundry PF2e)
// =============================================================================

export interface Pf2eMonsterCatalogItem {
  index: string;
  name: string;
  level: number;
  pack: string;
  path: string;
}

export interface Pf2eNpcPinParsed {
  pinType: "attack" | "spell" | "skill";
  label: string;
  rollExpression?: string;
  manaCost?: number;
  circle?: number;
}

export interface Pf2eMonsterParsed {
  name: string;
  level: number;
  hitPoints: number;
  manaPoints: number;
  attributes: {
    forca: number;
    destreza: number;
    vigor: number;
    inteligencia: number;
    empatia: number;
  };
  imageUrl: string | null;
  xpReward: number;
  pins: Pf2eNpcPinParsed[];
  publicNotes?: string;
}

const PF2E_TREE_URL = "https://api.github.com/repos/foundryvtt/pf2e/git/trees/v14-dev?recursive=1";
const PF2E_RAW_BASE = "https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/";

const TARGET_PACKS = [
  "packs/pf2e/pathfinder-bestiary",
  "packs/pf2e/pathfinder-monster-core",
  "packs/pf2e/pathfinder-bestiary-2",
  "packs/pf2e/pathfinder-bestiary-3",
  "packs/pf2e/npc-gallery",
];

let catalogCache: { timestamp: number; items: Pf2eMonsterCatalogItem[] } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de cache em memória

const clamp = (val: number, min = 1, max = 30) => Math.max(min, Math.min(max, Math.round(val || 10)));

/**
 * Valida rigorosamente se o caminho recebido pertence aos packs autorizados do Foundry PF2e.
 */
export function isValidPf2ePath(path: string): boolean {
  if (typeof path !== "string" || path.includes("..") || path.includes("\\")) return false;
  const isTargetPack = TARGET_PACKS.some((pack) => path.startsWith(`${pack}/`));
  const isJson = path.toLowerCase().endsWith(".json");
  return isTargetPack && isJson;
}

/**
 * Busca o catálogo completo de monstros a partir do repositório Git do Foundry PF2e com cache.
 */
export async function fetchPf2eMonsterCatalog(): Promise<Pf2eMonsterCatalogItem[]> {
  if (catalogCache && Date.now() - catalogCache.timestamp < CACHE_TTL_MS) {
    return catalogCache.items;
  }

  try {
    const res = await fetch(PF2E_TREE_URL, {
      headers: { Accept: "application/json", "User-Agent": "LibmorkApp" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`[fetchPf2eMonsterCatalog] HTTP status: ${res.status}`);
      return catalogCache?.items || [];
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.tree)) {
      return catalogCache?.items || [];
    }

    const catalogItems: Pf2eMonsterCatalogItem[] = [];

    for (const node of data.tree) {
      if (typeof node.path !== "string" || !isValidPf2ePath(node.path)) continue;

      const matchingPack = TARGET_PACKS.find((pack) => node.path.startsWith(`${pack}/`));
      if (!matchingPack) continue;

      const filename = node.path.split("/").pop() || "";
      const index = filename.replace(/\.json$/i, "");
      const formattedName = index
        .split("-")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      catalogItems.push({
        index,
        name: formattedName,
        level: 1, // Padrão exibido no catálogo leve
        pack: matchingPack.split("/").pop() || matchingPack,
        path: node.path,
      });
    }

    catalogCache = { timestamp: Date.now(), items: catalogItems };
    return catalogItems;
  } catch (error) {
    console.error("[fetchPf2eMonsterCatalog] Erro ao buscar catálogo:", error);
    return catalogCache?.items || [];
  }
}

/**
 * Limpa marcações HTML/Foundry do texto.
 */
function cleanFoundryText(text: string): string {
  if (!text) return "";
  return text
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
    .replace(/@Damage\[([^\]]+)\]/g, "$1")
    .replace(/@Check\[([^\]]+)\]/g, "$1")
    .replace(/@Template\[([^\]]+)\]/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca e interpreta o JSON bruto de um monstro do Foundry PF2e.
 */
export async function fetchAndParsePf2eMonster(path: string): Promise<Pf2eMonsterParsed | null> {
  if (!isValidPf2ePath(path)) {
    console.warn(`[fetchAndParsePf2eMonster] Caminho inválido ou não autorizado rejeitado: ${path}`);
    return null;
  }

  try {
    const rawUrl = `${PF2E_RAW_BASE}${path}`;
    const res = await fetch(rawUrl, {
      headers: { Accept: "application/json", "User-Agent": "LibmorkApp" },
    });

    if (!res.ok) {
      console.error(`[fetchAndParsePf2eMonster] Erro HTTP ao buscar ${path}: ${res.status}`);
      return null;
    }

    const json = await res.json();
    if (!json || typeof json !== "object") return null;

    const name = typeof json.name === "string" ? json.name.trim() : "Criatura sem nome";
    const system = json.system || {};
    const details = system.details || {};
    const attributes = system.attributes || {};
    const abilities = system.abilities || {};

    const level = typeof details.level?.value === "number" ? details.level.value : 1;
    const hitPoints = typeof attributes.hp?.max === "number" ? attributes.hp.max : 10;

    // Atributos base 10 + (modificador * 2)
    const strMod = abilities.str?.mod || 0;
    const dexMod = abilities.dex?.mod || 0;
    const conMod = abilities.con?.mod || 0;
    const intMod = abilities.int?.mod || 0;
    const wisMod = abilities.wis?.mod || 0;
    const chaMod = abilities.cha?.mod || 0;

    const parsedAttributes = {
      forca: clamp(10 + strMod * 2),
      destreza: clamp(10 + dexMod * 2),
      vigor: clamp(10 + conMod * 2),
      inteligencia: clamp(10 + intMod * 2),
      empatia: clamp(10 + Math.max(wisMod, chaMod) * 2),
    };

    // Imagem da criatura
    let imageUrl: string | null = null;
    if (typeof json.img === "string" && json.img && !json.img.includes("default-icons")) {
      imageUrl = `https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/${json.img}`;
    }

    // Itens / Pins do NPC
    const items = Array.isArray(json.items) ? json.items : [];
    const pins: Pf2eNpcPinParsed[] = [];
    let spellCount = 0;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const itemName = typeof item.name === "string" ? item.name.trim() : "";
      if (!itemName) continue;

      const itemType = item.type;
      const itemSystem = item.system || {};

      // 1. Ataques Ca corpo a corpo / Distância
      if (itemType === "melee") {
        const bonus = typeof itemSystem.bonus?.value === "number" ? itemSystem.bonus.value : 0;
        let damageStr = "";

        if (itemSystem.damageRolls && typeof itemSystem.damageRolls === "object") {
          const rolls = Object.values(itemSystem.damageRolls) as Array<{ damage?: string }>;
          if (rolls[0]?.damage) {
            damageStr = ` (${rolls[0].damage})`;
          }
        }

        const bonusStr = bonus >= 0 ? `+${bonus}` : `${bonus}`;
        pins.push({
          pinType: "attack",
          label: itemName,
          rollExpression: `1d20${bonusStr}${damageStr}`,
        });
      }
      // 2. Magias
      else if (itemType === "spell") {
        spellCount++;
        const circle = typeof itemSystem.level?.value === "number" ? itemSystem.level.value : 1;
        const manaCost = circle * 2;
        pins.push({
          pinType: "spell",
          label: itemName,
          circle,
          manaCost,
        });
      }
      // 3. Ações / Habilidades de combate
      else if (itemType === "action") {
        const category = itemSystem.category || "";
        const desc = cleanFoundryText(itemSystem.description?.value || "");
        pins.push({
          pinType: category === "offensive" ? "attack" : "skill",
          label: itemName,
          rollExpression: desc ? desc.slice(0, 150) : undefined,
        });
      }
      // 4. Equipamentos / Armas / Armaduras (Drops)
      else if (["equipment", "weapon", "armor", "treasure"].includes(itemType)) {
        pins.push({
          pinType: "skill",
          label: `[Item] ${itemName}`,
        });
      }
    }

    // Cálculo de Mana
    const manaPoints = spellCount > 0 ? Math.max(20, spellCount * 5) : 0;
    const xpReward = Math.max(50, Math.round(Math.max(1, level) * 100));
    const publicNotes = cleanFoundryText(details.publicNotes || "");

    return {
      name,
      level,
      hitPoints,
      manaPoints,
      attributes: parsedAttributes,
      imageUrl,
      xpReward,
      pins: pins.slice(0, 10), // Limita aos 10 principais pins
      publicNotes,
    };
  } catch (error) {
    console.error(`[fetchAndParsePf2eMonster] Erro ao parsear monstro de ${path}:`, error);
    return null;
  }
}
