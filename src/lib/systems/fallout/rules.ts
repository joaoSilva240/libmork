// =============================================================================
// Libmork — Sistema Fallout 2d20: Motor de Regras
// Resolução oficial 2d20, Dados de Combate (DC), Localização de Dano e Derivações
// =============================================================================

import type {
  CombatDiceRollResult,
  CombatDie,
  FalloutAttribute,
  FalloutBodyLocation,
  FalloutBodyPart,
  FalloutCharacter,
  FalloutCharacterPerk,
  FalloutItem,
  FalloutModItem,
  FalloutOrigin,
  FalloutRollDie,
  FalloutRollParams,
  FalloutRollResult,
  FalloutSkillName,
  FalloutSkillState,
  FalloutWeaponItem,
} from "./types";
import type { CreateFalloutCharacterInput } from "./validators";
import { recalculateFalloutDerived } from "./derived";
import { FALLOUT_ORIGIN_CONFIGS } from "./origins";
import { catalogItemToFalloutItem, type CatalogItem } from "./itemCatalog";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_ATTRIBUTE_CONFIGS,
  FALLOUT_BODY_LOCATIONS,
  FALLOUT_DEFAULT_BODY_PARTS,
  FALLOUT_SKILLS,
} from "./types";

/**
 * Gera um número aleatório inteiro entre min e max (inclusivos).
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Rola o teste central de 2d20 do Fallout.
 *
 * - Alvo de Sucesso (Target Number) = Atributo + Perícia
 * - Limiar Crítico: se for Tag Skill = Graduação da Perícia (mínimo 1), senão = 1
 * - Complicação: qualquer dado >= complicationThreshold (padrão 20)
 * - Sucessos excedentes além da Dificuldade geram Action Points (AP)
 */
export function roll2d20(params: FalloutRollParams, diceOverride?: number[]): FalloutRollResult {
  const targetNumber = params.attributeValue + params.skillRank;
  const criticalThreshold = params.isTagSkill ? Math.max(params.skillRank, 1) : 1;
  const complicationThreshold = params.complicationThreshold ?? 20;
  const difficulty = params.difficulty ?? 1;

  const extraDice = Math.max(0, Math.min(params.extraDiceCount ?? 0, 3));
  const totalDiceCount = Math.max(2, Math.min(2 + extraDice, 5));

  const rolledValues: number[] = diceOverride
    ? diceOverride.slice(0, totalDiceCount)
    : Array.from({ length: totalDiceCount }, () => rollDie(20));

  const dice: FalloutRollDie[] = rolledValues.map((val) => {
    let successes = 0;
    const isCritical = val <= criticalThreshold;
    const isComplication = val >= complicationThreshold;

    if (val <= targetNumber) {
      successes += 1;
    }
    if (isCritical) {
      successes += 1; // Crítico concede 1 sucesso adicional (total 2)
    }

    return {
      value: val,
      successes,
      isCritical,
      isComplication,
    };
  });

  const totalSuccesses = dice.reduce((acc, d) => acc + d.successes, 0);
  const totalComplications = dice.filter((d) => d.isComplication).length;
  const isSuccess = totalSuccesses >= difficulty;
  const apGenerated = isSuccess ? Math.max(0, totalSuccesses - difficulty) : 0;

  return {
    targetNumber,
    criticalThreshold,
    complicationThreshold,
    dice,
    totalSuccesses,
    totalComplications,
    difficulty,
    isSuccess,
    apGenerated,
  };
}

/**
 * Mapeia face de d6 para o dado de combate (Combat Die — DC) de Fallout 2d20:
 * - 1: 1 dano
 * - 2: 2 danos
 * - 3: 0 dano
 * - 4: 0 dano
 * - 5: 1 dano + 1 Efeito
 * - 6: 1 dano + 1 Efeito
 */
export function evaluateCombatDieFace(face: number): CombatDie {
  const clamped = Math.max(1, Math.min(face, 6));
  switch (clamped) {
    case 1:
      return { dieValue: 1, damage: 1, effect: false };
    case 2:
      return { dieValue: 2, damage: 2, effect: false };
    case 3:
      return { dieValue: 3, damage: 0, effect: false };
    case 4:
      return { dieValue: 4, damage: 0, effect: false };
    case 5:
      return { dieValue: 5, damage: 1, effect: true };
    case 6:
      return { dieValue: 6, damage: 1, effect: true };
    default:
      return { dieValue: clamped, damage: 0, effect: false };
  }
}

/**
 * Rola dados de combate (Combat Dice — DC).
 */
export function rollCombatDice(count: number, diceOverride?: number[]): CombatDiceRollResult {
  const diceCount = Math.max(1, Math.min(count, 50));
  const rawValues = diceOverride
    ? diceOverride.slice(0, diceCount)
    : Array.from({ length: diceCount }, () => rollDie(6));

  const dice = rawValues.map(evaluateCombatDieFace);
  const totalDamage = dice.reduce((acc, d) => acc + d.damage, 0);
  const totalEffects = dice.filter((d) => d.effect).length;

  return {
    diceCount,
    dice,
    totalDamage,
    totalEffects,
  };
}

/**
 * Resolve a localização do dano no corpo humanoide (1d20).
 */
export function calculateHitLocation(roll1d20?: number): {
  location: FalloutBodyLocation;
  label: string;
  roll: number;
} {
  const roll = roll1d20 ? Math.max(1, Math.min(roll1d20, 20)) : rollDie(20);

  if (roll <= 2) return { location: "head", label: "Cabeça", roll };
  if (roll <= 8) return { location: "torso", label: "Tronco", roll };
  if (roll <= 11) return { location: "armL", label: "Braço Esquerdo", roll };
  if (roll <= 14) return { location: "armR", label: "Braço Direito", roll };
  if (roll <= 17) return { location: "legL", label: "Perna Esquerda", roll };
  return { location: "legR", label: "Perna Direita", roll };
}

// =============================================================================
// Derivações de Estatísticas Oficiais
// =============================================================================

/**
 * Max HP = END + LUC + (Nível - 1) + bônus
 */
export function calculateMaxHp(
  end: number,
  luc: number,
  level: number = 1,
  bonus: number = 0,
): number {
  return Math.max(1, end + luc + Math.max(0, level - 1) + bonus);
}

/**
 * HP Máximo Efetivo = Max HP - Radiação
 * (A radiação acumula e corta diretamente o teto máximo de vida)
 */
export function calculateEffectiveMaxHp(maxHp: number, radiation: number): number {
  const rads = Math.max(0, radiation);
  return Math.max(0, maxHp - rads);
}

/**
 * Defesa = (AGI <= 8 ? 1 : 2) + bônus
 */
export function calculateDefense(agi: number, bonus: number = 0): number {
  const base = agi <= 8 ? 1 : 2;
  return Math.max(1, base + bonus);
}

/**
 * Iniciativa = PER + AGI + bônus
 */
export function calculateInitiative(per: number, agi: number, bonus: number = 0): number {
  return Math.max(1, per + agi + bonus);
}

/**
 * Bônus de Dano Corpo a Corpo (Combat Dice DC):
 * - STR <= 6: 0
 * - STR 7-8: +1 CD
 * - STR 9-10: +2 CD
 * - STR 11+: +3 CD
 */
export function calculateMeleeDamageBonus(str: number): number {
  if (str >= 11) return 3;
  if (str >= 9) return 2;
  if (str >= 7) return 1;
  return 0;
}

/**
 * Capacidade de Carga Máxima = STR * 10 + 150 lbs + bônus
 */
export function calculateCarryWeightMax(str: number, bonus: number = 0): number {
  return Math.max(10, str * 10 + 150 + bonus);
}

/**
 * Nível de Sobrecarga: a cada 50 lbs excedentes, gera +1 nível de encumbrance
 */
export function calculateEncumbranceLevel(totalWeight: number, maxWeight: number): number {
  if (totalWeight <= maxWeight) return 0;
  const dif = totalWeight - maxWeight;
  return Math.ceil(dif / 50);
}

/**
 * XP para o Próximo Nível = Nível * (Nível + 1) / 2 * 100
 */
export function calculateNextLevelXp(level: number): number {
  const current = Math.max(1, level);
  const next = current + 1;
  return ((next * current) / 2) * 100;
}

// =============================================================================
// Inicializadores de Estrutura
// =============================================================================

export function initializeFalloutBodyParts(): Record<FalloutBodyLocation, FalloutBodyPart> {
  const parts: Partial<Record<FalloutBodyLocation, FalloutBodyPart>> = {};

  for (const loc of FALLOUT_BODY_LOCATIONS) {
    const meta = FALLOUT_DEFAULT_BODY_PARTS[loc];
    parts[loc] = {
      location: loc,
      label: meta.label,
      minRoll: meta.minRoll,
      maxRoll: meta.maxRoll,
      injuries: [0, 0, 0],
      status: "healthy",
      resistances: {
        physical: 0,
        energy: 0,
        radiation: 0,
        poison: 0,
      },
    };
  }

  return parts as Record<FalloutBodyLocation, FalloutBodyPart>;
}

export function initializeFalloutSkills(
  tagSkills: FalloutSkillName[] = [],
): Record<FalloutSkillName, FalloutSkillState> {
  const skills: Partial<Record<FalloutSkillName, FalloutSkillState>> = {};

  for (const skill of FALLOUT_SKILLS) {
    skills[skill] = {
      name: skill,
      rank: 0,
      isTag: tagSkills.includes(skill),
    };
  }

  return skills as Record<FalloutSkillName, FalloutSkillState>;
}

/** Aceita o formato legado (string) e o estruturado do catálogo, sem bloquear ranks. */
export function normalizeFalloutPerk(
  entry: string | FalloutCharacterPerk,
): FalloutCharacterPerk {
  if (typeof entry === "string") return { name: entry, rank: 1 };
  return { ...entry, rank: Math.max(1, entry.rank ?? 1) };
}

/** Ajuste de rank em jogo: piso 1 e teto no maxRank quando o catálogo informa. */
export function adjustFalloutPerkRank(
  perk: FalloutCharacterPerk,
  delta: number,
): FalloutCharacterPerk {
  const raised = Math.max(1, perk.rank + delta);
  return { ...perk, rank: perk.maxRank ? Math.min(raised, perk.maxRank) : raised };
}

/** Rótulo curto PT-BR do atributo: FOR, PER, RES, CAR, INT, AGI, SOR. */
export function getFalloutAttributeShortLabel(attribute: FalloutAttribute): string {
  return FALLOUT_ATTRIBUTE_CONFIGS[attribute].shortLabel.split(" / ")[0];
}

type PerkRequirementSource = {
  requirements?: string | null;
  requirementsEx?: unknown;
};

// No compêndio Foundry `system.requirements` vem vazio: a fonte real é `requirementsEx`.
export function getFalloutPerkRequirementText(
  source: PerkRequirementSource | null | undefined,
): string | null {
  const structured = source?.requirementsEx;
  if (structured && typeof structured === "object") {
    const { attributes, level } = structured as { attributes?: unknown; level?: unknown };
    const parts: string[] = [];
    if (attributes && typeof attributes === "object") {
      for (const attribute of FALLOUT_ATTRIBUTES) {
        const entry = (attributes as Record<string, unknown>)[attribute];
        const minimum =
          entry && typeof entry === "object" ? (entry as { value?: unknown }).value : undefined;
        if (typeof minimum === "number" && minimum > 0) {
          parts.push(`${getFalloutAttributeShortLabel(attribute)} ${minimum}`);
        }
      }
    }
    if (typeof level === "number" && level > 1) parts.push(`Nível ${level}`);
    if (parts.length > 0) return parts.join(", ");
  }
  const legacy = typeof source?.requirements === "string" ? source.requirements.trim() : "";
  return legacy || null;
}

export function applyFalloutConsumable(
  character: FalloutCharacter,
  itemId: string,
): FalloutCharacter | null {
  const index = character.items.findIndex((i) => i.id === itemId);
  if (index === -1) return null;
  const item = character.items[index];
  if (item.type !== "consumable") return null;
  if (item.quantity <= 0) return null;

  const hpCurrent = Math.min(character.hpMax, character.hpCurrent + (item.hpRestored ?? 0));
  const radiation = Math.max(0, character.radiation - (item.radsCured ?? 0)) + (item.radsInflicted ?? 0);
  const newQuantity = item.quantity - 1;

  const items = newQuantity <= 0
    ? character.items.filter((_, i) => i !== index)
    : character.items.map((it, i) => i === index ? { ...it, quantity: newQuantity } : it);

  return { ...character, hpCurrent, radiation, items };
}

export function createInitialFalloutCharacter(
  input: CreateFalloutCharacterInput,
  ownerId: string,
  id?: string,
): FalloutCharacter {
  const charId = id || `fallout-char-${Date.now()}`;
  const now = new Date().toISOString();

  const base: FalloutCharacter = {
    id: charId,
    campaignId: input.campaignId || null,
    ownerId,
    name: input.name,
    origin: input.origin || "vault_dweller",
    level: input.level || 1,
    xp: input.xp || 0,
    attributes: { ...input.attributes },
    skills: initializeFalloutSkills(input.tagSkills),
    tagSkills: [...(input.tagSkills || [])],
    hpCurrent: 0,
    hpMax: 0,
    radiation: 0,
    luckPointsCurrent: input.attributes.luc,
    defense: 0,
    initiative: 0,
    meleeDamageBonus: 0,
    carryWeightMax: 0,
    carryWeightCurrent: 0,
    encumbranceLevel: 0,
    caps: input.caps || 0,
    bodyParts: initializeFalloutBodyParts(),
    items: input.items ?? [],
    perks: [...(input.perks || [])],
    createdAt: now,
    updatedAt: now,
  };

  const derived = recalculateFalloutDerived(base);
  return { ...derived, hpCurrent: derived.hpMax };
}

export function getMaxFalloutPerks(level: number): number {
  return Math.ceil(Math.max(1, level) / 2);
}

export function applyModToWeapon(weapon: FalloutWeaponItem, mod: FalloutModItem): FalloutWeaponItem {
  const fx = mod.modEffects;
  const qualitiesAdd = fx.qualitiesAdd ?? [];
  const qualitiesRemove = new Set(fx.qualitiesRemove ?? []);
  return {
    ...weapon,
    damageDiceRating: weapon.damageDiceRating + (fx.damageBonus ?? 0),
    fireRate: Math.max(0, weapon.fireRate + (fx.fireRateBonus ?? 0)),
    weight: weapon.weight + (fx.weightDelta ?? 0),
    qualities: [...new Set([...weapon.qualities.filter((q) => !qualitiesRemove.has(q)), ...qualitiesAdd])],
    installedMods: [...weapon.installedMods, mod.id],
    installedModsData: { ...weapon.installedModsData, [mod.id]: mod.modEffects },
  };
}

export function removeModFromWeapon(weapon: FalloutWeaponItem, mod: FalloutModItem): FalloutWeaponItem {
  const fx = weapon.installedModsData[mod.id] ?? mod.modEffects;
  const qualitiesAdd = new Set(fx.qualitiesAdd ?? []);
  const qualitiesRemove = fx.qualitiesRemove ?? [];
  const { [mod.id]: _, ...remainingData } = weapon.installedModsData;
  return {
    ...weapon,
    damageDiceRating: weapon.damageDiceRating - (fx.damageBonus ?? 0),
    fireRate: Math.max(0, weapon.fireRate - (fx.fireRateBonus ?? 0)),
    weight: weapon.weight - (fx.weightDelta ?? 0),
    qualities: [...weapon.qualities.filter((q) => !qualitiesAdd.has(q)), ...qualitiesRemove],
    installedMods: weapon.installedMods.filter((id) => id !== mod.id),
    installedModsData: remainingData,
  };
}

export function resolveStartingItems(
  origin: FalloutOrigin,
  catalogLookup: (sourceKey: string) => CatalogItem | null,
): FalloutItem[] {
  const config = FALLOUT_ORIGIN_CONFIGS[origin];
  const items: FalloutItem[] = [];
  for (const entry of config.startingItems) {
    const catalogItem = catalogLookup(entry.sourceKey);
    let item: FalloutItem;
    if (catalogItem) {
      item = catalogItemToFalloutItem(catalogItem);
    } else {
      item = {
        id: `starting-${entry.sourceKey}-${items.length}`,
        name: entry.name,
        type: "miscellany",
        weight: 0,
        costCaps: 0,
        quantity: entry.quantity ?? 1,
      };
    }
    if (entry.quantity && (item.type === "ammo" || item.type === "consumable" || item.type === "mod")) {
      (item as any).quantity = entry.quantity;
    }
    items.push(item);
  }
  return items;
}
