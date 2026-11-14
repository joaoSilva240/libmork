// =============================================================================
// Libmork — Sistema Fallout 2d20: Catálogo de Itens da Biblioteca Global
// Converte linhas da tabela `items` (compendio Foundry) em FalloutItem da ficha.
// =============================================================================

import {
  FALLOUT_BODY_LOCATIONS,
  FALLOUT_DAMAGE_EFFECTS,
  FALLOUT_WEAPON_QUALITIES,
  type FalloutApparelItem,
  type FalloutBodyLocation,
  type FalloutDamageEffect,
  type FalloutDamageType,
  type FalloutItem,
  type FalloutItemType,
  type FalloutWeaponItem,
  type FalloutWeaponQuality,
} from "./types";

/** Linha de `items` retornada por GET /api/content/items?ruleSystem=fallout_2d20. */
export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  qualityDescription: string | null;
  imageUrl: string | null;
  sourceKey: string | null;
  sourceData?: Record<string, unknown> | null;
};

/** Categorias exibidas como chips de filtro no seletor (spec §3.3). */
export const FALLOUT_ITEM_FILTER_CATEGORIES = [
  "weapon",
  "apparel",
  "consumable",
  "ammo",
  "mod",
] as const;
export type FalloutItemFilterCategory = (typeof FALLOUT_ITEM_FILTER_CATEGORIES)[number];

const CATEGORY_LABELS: Record<FalloutItemFilterCategory, string> = {
  weapon: "Armas",
  apparel: "Vestuário",
  consumable: "Consumíveis",
  ammo: "Munição",
  mod: "Mods",
};

export function getFalloutItemCategoryLabel(category: FalloutItemFilterCategory): string {
  return CATEGORY_LABELS[category];
}

/** Rótulos PT-BR dos 4 tipos de dano, compartilhados entre o seletor e a ficha. */
export const FALLOUT_DAMAGE_TYPE_LABELS: Record<FalloutDamageType, string> = {
  physical: "Físico",
  energy: "Energia",
  radiation: "Radiação",
  poison: "Veneno",
};

const PACK_TO_TYPE: Record<string, FalloutItemType> = {
  weapons: "weapon",
  apparel: "apparel",
  consumables: "consumable",
  ammunition: "ammo",
  weapon_mods: "mod",
  apparel_mods: "mod",
  robot_modules: "mod",
  miscellany: "miscellany",
  books_and_magz: "miscellany",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Pack do compendio -> tipo de item da ficha (desconhecido cai em miscellany). */
export function getFalloutItemCategory(item: CatalogItem): FalloutItemType {
  const pack = asRecord(item.sourceData).pack;
  return (typeof pack === "string" && PACK_TO_TYPE[pack]) || "miscellany";
}

const DAMAGE_EFFECT_ALIASES: Record<string, FalloutDamageEffect> = {
  piercing_x: "piercing",
};

const QUALITY_SET = new Set<string>(FALLOUT_WEAPON_QUALITIES);
const EFFECT_SET = new Set<string>(FALLOUT_DAMAGE_EFFECTS);

/** Coleta as chaves ativas (rank>0 ou value>0) que existem no enum Fallout. */
function activeKeys(
  source: unknown,
  allowed: Set<string>,
  aliases: Record<string, string> = {},
): string[] {
  const result: string[] = [];
  for (const [key, entry] of Object.entries(asRecord(source))) {
    const { rank, value } = asRecord(entry);
    if (asNumber(rank) <= 0 && asNumber(value) <= 0) continue;
    const mapped = aliases[key] ?? key;
    if (allowed.has(mapped) && !result.includes(mapped)) result.push(mapped);
  }
  return result;
}

function pickDamageType(source: unknown): FalloutDamageType {
  const record = asRecord(source);
  for (const type of ["physical", "energy", "radiation", "poison"] as const) {
    if (record[type] === true) return type;
  }
  return "physical";
}

const RANGES = new Set(["close", "medium", "long", "extreme"]);
function pickRange(value: unknown): FalloutWeaponItem["range"] {
  return typeof value === "string" && RANGES.has(value)
    ? (value as FalloutWeaponItem["range"])
    : "close";
}

const APPAREL_TYPES = new Set(["outfit", "armor", "headgear", "powerArmor"]);
function pickApparelType(value: unknown): FalloutApparelItem["apparelType"] {
  return typeof value === "string" && APPAREL_TYPES.has(value)
    ? (value as FalloutApparelItem["apparelType"])
    : "armor";
}

const CONSUMABLE_CATEGORIES = new Set(["chem", "food", "beverage", "med"]);
// O Foundry usa food/beverage/chem/other; a union da ficha não tem "other",
// então tipos desconhecidos caem em "food" como rótulo genérico seguro.
function pickConsumableCategory(value: unknown): "chem" | "food" | "beverage" | "med" {
  return typeof value === "string" && CONSUMABLE_CATEGORIES.has(value)
    ? (value as "chem" | "food" | "beverage" | "med")
    : "food";
}

/** Converte uma linha do catálogo no item estruturado da ficha (peso e caps inclusos). */
export function catalogItemToFalloutItem(item: CatalogItem): FalloutItem {
  const sd = asRecord(item.sourceData);
  const type = getFalloutItemCategory(item);
  const base = {
    id: `item-${item.id}`,
    name: item.name,
    weight: asNumber(sd.weight),
    costCaps: asNumber(sd.cost),
  };

  if (type === "weapon") {
    const damage = asRecord(sd.damage);
    return {
      ...base,
      type: "weapon",
      damageDiceRating: asNumber(damage.rating),
      damageType: pickDamageType(damage.damageType),
      damageEffects: activeKeys(damage.damageEffect, EFFECT_SET, DAMAGE_EFFECT_ALIASES) as FalloutDamageEffect[],
      qualities: activeKeys(damage.weaponQuality, QUALITY_SET) as FalloutWeaponQuality[],
      ammoType: typeof sd.ammo === "string" && sd.ammo ? sd.ammo : undefined,
      ammoPerShot: asNumber(sd.ammoPerShot, 1),
      fireRate: asNumber(sd.fireRate),
      range: pickRange(sd.range),
      equipped: false,
    };
  }

  if (type === "apparel") {
    const resistance = asRecord(sd.resistance);
    const location = asRecord(sd.location);
    return {
      ...base,
      type: "apparel",
      apparelType: pickApparelType(sd.apparelType),
      locationsCovered: FALLOUT_BODY_LOCATIONS.filter(
        (loc) => location[loc] === true,
      ) as FalloutBodyLocation[],
      resistances: {
        physical: asNumber(resistance.physical),
        energy: asNumber(resistance.energy),
        radiation: asNumber(resistance.radiation),
        poison: asNumber(resistance.poison),
      },
      equipped: false,
      stashed: false,
      powered: false,
    };
  }

  if (type === "consumable") {
    return {
      ...base,
      type: "consumable",
      category: pickConsumableCategory(sd.consumableType),
      hpRestored: asNumber(sd.hp),
      quantity: asNumber(sd.quantity, 1),
      addictive: sd.addictive === true,
    };
  }

  if (type === "ammo") {
    const shots = asRecord(sd.shots);
    const shotsMax = asNumber(shots.max, 1);
    return {
      ...base,
      type: "ammo",
      description: item.description ?? undefined,
      quantity: asNumber(sd.quantity, 1),
      shotsMax,
      shotsCurrent: asNumber(shots.current, shotsMax),
      stashed: false,
    };
  }

  return {
    ...base,
    type: type as "mod" | "miscellany",
    description: item.description ?? undefined,
    quantity: asNumber(sd.quantity, 1),
    equipped: false,
    stashed: false,
  };
}
