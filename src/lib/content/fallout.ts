// =============================================================================
// Libmork — Importador de conteúdo Fallout 2d20
// Fonte: Muttley/foundryvtt-fallout (MIT; conteúdo dos packs © Modiphius,
// ver public/systems/fallout/ATTRIBUTION.txt). Inglês primeiro, traduzir depois.
// =============================================================================

export const FALLOUT_RULE_SYSTEM = "fallout_2d20";

/** Packs de itens importados para a biblioteca global (diretórios *.db). */
export const FALLOUT_ITEM_PACKS = [
  "weapons",
  "apparel",
  "consumables",
  "ammunition",
  "miscellany",
  "books_and_magz",
  "robot_modules",
  "weapon_mods",
  "apparel_mods",
] as const;

export type FalloutItemPack = (typeof FALLOUT_ITEM_PACKS)[number];

export const FALLOUT_PERK_PACK = "perks";

const LOCAL_ICON_BASE = "/systems/fallout/items";

/** Icones copiados localmente em public/systems/fallout/items/. */
const LOCAL_ICONS = new Set([
  "addiction.svg",
  "ammo.svg",
  "apparel.svg",
  "apparel_mod.svg",
  "books_and_magz.svg",
  "consumable.svg",
  "disease.svg",
  "miscellany.svg",
  "perk.svg",
  "robot_armor.svg",
  "robot_mod.svg",
  "trait.svg",
  "weapon.svg",
  "weapon_mod.svg",
]);

export type FalloutPackEntry = {
  _id?: unknown;
  name?: unknown;
  img?: unknown;
  type?: unknown;
  system?: unknown;
};

export type FalloutPerkRow = {
  name: string;
  circle: number;
  manaCost: 0;
  useType: "perk";
  description: string | null;
  imageUrl: string | null;
  structuredEffects: Record<string, unknown>;
};

export type FalloutItemRow = {
  name: string;
  description: string | null;
  qualityDescription: string | null;
  sourceKey: string;
  imageUrl: string | null;
  sourceData: Record<string, unknown>;
};

/**
 * Extrai o slug do nome do arquivo do Foundry (`<slug>__<id16>.json`).
 * O id vem sempre por último; o slug pode conter `__` (ex.: variantes
 * "tempered__torso") — por isso o parse ancora no final do nome.
 */
export function falloutSlugFromFilename(filename: string): string | null {
  const base = filename.replace(/\.json$/i, "");
  const match = base.match(/^(.*?)__[A-Za-z0-9]{16}$/);
  if (match) {
    const slug = match[1].replace(/_+$/, "");
    return slug || null;
  }
  const sep = base.indexOf("__");
  if (sep <= 0) return null;
  return base.slice(0, sep);
}

export function falloutSourceKey(pack: string, slug: string): string {
  return `fallout:${pack}:${slug}`;
}

/**
 * Garante sourceKeys únicos quando um pack contém várias entradas com o
 * mesmo slug (ex.: o mod "Barbed" existe em 4 variantes de arma). A primeira
 * ocorrência (ordem determinística por foundryId) fica com o slug puro; as
 * demais recebem sufixo `-<foundryId>`.
 */
export function assignUniqueFalloutSourceKeys<T extends { sourceKey: string }>(
  rows: Array<{ row: T; foundryId: string | null }>,
): T[] {
  const sorted = [...rows].sort((a, b) =>
    (a.foundryId ?? "").localeCompare(b.foundryId ?? ""),
  );
  const used = new Set<string>();
  for (const entry of sorted) {
    let key = entry.row.sourceKey;
    if (used.has(key)) {
      const suffix = entry.foundryId ? `-${entry.foundryId}` : `-${used.size}`;
      key = `${entry.row.sourceKey}${suffix}`;
    }
    entry.row.sourceKey = key;
    used.add(key);
  }
  return sorted.map((entry) => entry.row);
}

/** Converte o caminho de ícone do Foundry no ícone local, quando existente. */
export function falloutLocalIcon(img: unknown): string | null {
  if (typeof img !== "string" || !img) return null;
  const basename = img.trim().split("/").pop() ?? "";
  return LOCAL_ICONS.has(basename) ? `${LOCAL_ICON_BASE}/${basename}` : null;
}

/** Entidades nomeadas Latin-1 mais comuns no texto do compendio. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  ccedil: "ç",
  Ccedil: "Ç",
  copy: "©",
  reg: "®",
  trade: "™",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "’",
  rsquo: "’",
  ldquo: "”",
  rdquo: "”",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
};

/** HTML do Foundry -> texto plano com quebras de linha e bullets. */
export function falloutStripHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\s*\/(ul|ol|div|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return NAMED_ENTITIES[entity] ?? match;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** Perk do compendio -> linha da tabela spells (useType='perk'). */
export function parseFalloutPerk(entry: FalloutPackEntry): FalloutPerkRow | null {
  const name = asTrimmedString(entry.name, 100);
  if (!name) return null;

  const system = asRecord(entry.system);
  const description = falloutStripHtml(system.description) || null;
  const rank = asRecord(system.rank);
  const rawMax = typeof rank.max === "number" && Number.isFinite(rank.max) ? rank.max : 1;
  const circle = Math.max(1, Math.min(9, Math.trunc(rawMax)));

  return {
    name,
    circle,
    manaCost: 0,
    useType: "perk",
    description,
    imageUrl: falloutLocalIcon(entry.img) ?? `${LOCAL_ICON_BASE}/perk.svg`,
    structuredEffects: {
      origin: "fallout_2d20_compendium",
      foundryId: typeof entry._id === "string" ? entry._id : null,
      foundryType: typeof entry.type === "string" ? entry.type : null,
      rank,
      requirements: asTrimmedString(system.requirements, 500),
      requirementsEx: system.requirementsEx ?? null,
      source: asTrimmedString(system.source, 100),
    },
  };
}

function summarizeItem(system: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (typeof system.cost === "number" && system.cost > 0) parts.push(`Cost: ${system.cost} caps`);
  if (typeof system.rarity === "number" && system.rarity > 0) parts.push(`Rarity: ${system.rarity}`);
  if (typeof system.weight === "number" && system.weight > 0) parts.push(`Weight: ${system.weight}`);
  return parts.length > 0 ? parts.join(" • ") : null;
}

/** Item de equipamento do compendio -> linha da tabela items. */
export function parseFalloutItem(
  entry: FalloutPackEntry,
  pack: FalloutItemPack,
  slug: string,
): FalloutItemRow | null {
  const name = asTrimmedString(entry.name, 100);
  if (!name) return null;

  const system = asRecord(entry.system);
  const descriptionText = falloutStripHtml(system.description);
  const effectText = falloutStripHtml(system.effect);
  const description = [descriptionText, effectText].filter(Boolean).join("\n\n") || null;

  return {
    name,
    description,
    qualityDescription: summarizeItem(system),
    sourceKey: falloutSourceKey(pack, slug),
    imageUrl: falloutLocalIcon(entry.img),
    sourceData: {
      origin: "fallout_2d20_compendium",
      foundryId: typeof entry._id === "string" ? entry._id : null,
      foundryType: typeof entry.type === "string" ? entry.type : null,
      pack,
      slug,
      ...system,
    },
  };
}
