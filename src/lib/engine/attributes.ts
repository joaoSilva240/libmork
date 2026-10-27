// =============================================================================
// Libmork — Motor de Regras: Atributos e Derivações (D-12, D-17, D-40)
// =============================================================================
// Executado no CLIENTE para velocidade (D-43).
// =============================================================================

import {
  ATTRIBUTE_BASE_VALUE,
  ATTRIBUTE_FREE_POINTS,
  ATTRIBUTES,
} from "@/lib/utils/constants";
import type { Attribute } from "@/lib/utils/constants";

/** Mapa de atributos do personagem; Sorte é opcional para personagens legados. */
export type AttributeMap = Record<Exclude<Attribute, "sorte">, number> & Partial<Record<"sorte", number>>;

type RaceAttributeBonusKey = Exclude<Attribute, "sorte">;
export type RaceAttributeBonuses = Partial<Record<RaceAttributeBonusKey, number>>;

export type RaceHeritage = {
  name: string;
  description?: string;
  speed?: number;
  size?: string;
  hitPointsBonus?: number;
  attributeBonuses?: RaceAttributeBonuses;
};

export type RaceMovementSize = {
  speed: number;
  size: string;
};

export type HeritageBonuses = {
  hitPointsBonus: number;
  attributeBonuses: RaceAttributeBonuses;
};

export function normalizeAttributeMap(attributes: Partial<Record<Attribute, number>>): Record<Attribute, number> {
  return {
    forca: attributes.forca ?? ATTRIBUTE_BASE_VALUE,
    destreza: attributes.destreza ?? ATTRIBUTE_BASE_VALUE,
    vigor: attributes.vigor ?? ATTRIBUTE_BASE_VALUE,
    inteligencia: attributes.inteligencia ?? ATTRIBUTE_BASE_VALUE,
    empatia: attributes.empatia ?? ATTRIBUTE_BASE_VALUE,
    sorte: attributes.sorte ?? ATTRIBUTE_BASE_VALUE,
  };
}

const HERITAGE_ATTRIBUTES = ["forca", "destreza", "vigor", "inteligencia", "empatia"] as const;
const SIZE_ORDER = ["miudo", "pequeno", "medio", "grande", "enorme", "colossal"] as const;

function getSizeRank(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  const rank = SIZE_ORDER.indexOf(normalized as (typeof SIZE_ORDER)[number]);
  return rank === -1 ? undefined : rank;
}

function getValidSpeed(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Returns the highest movement and size among the race and selected heritages. */
export function getActiveHeritageMovementSize(
  race: Pick<{ speed: unknown; size: unknown; heritages: unknown }, "speed" | "size" | "heritages">,
  activeHeritages: string[],
): RaceMovementSize {
  if (new Set(activeHeritages).size !== activeHeritages.length) {
    throw new Error("Heranças ativas não podem conter duplicatas");
  }

  const available = Array.isArray(race.heritages) ? race.heritages as RaceHeritage[] : [];
  const byName = new Map(available.map((heritage) => [heritage.name, heritage]));
  let speed = getValidSpeed(race.speed) ?? 0;
  let size = typeof race.size === "string" ? race.size : "";
  let sizeRank = getSizeRank(size);

  for (const name of activeHeritages) {
    const heritage = byName.get(name);
    if (!heritage) {
      throw new Error(`Herança "${name}" não pertence à raça selecionada`);
    }

    const heritageSpeed = getValidSpeed(heritage.speed);
    if (heritageSpeed !== undefined) speed = Math.max(speed, heritageSpeed);

    const heritageSizeRank = getSizeRank(heritage.size);
    if (heritageSizeRank !== undefined && (sizeRank === undefined || heritageSizeRank > sizeRank)) {
      size = heritage.size ?? size;
      sizeRank = heritageSizeRank;
    }
  }

  return { speed, size };
}

/** Returns the cumulative bonuses for the selected heritages. Legacy heritages default to zero. */
export function getActiveHeritageBonuses(
  heritages: unknown,
  activeHeritages: string[],
): HeritageBonuses {
  if (new Set(activeHeritages).size !== activeHeritages.length) {
    throw new Error("Heranças ativas não podem conter duplicatas");
  }

  const available = Array.isArray(heritages) ? heritages as RaceHeritage[] : [];
  const byName = new Map(available.map((heritage) => [heritage.name, heritage]));
  const attributeBonuses: RaceAttributeBonuses = {};
  let hitPointsBonus = 0;

  for (const name of activeHeritages) {
    const heritage = byName.get(name);
    if (!heritage) {
      throw new Error(`Herança "${name}" não pertence à raça selecionada`);
    }

    hitPointsBonus += heritage.hitPointsBonus ?? 0;
    for (const attribute of HERITAGE_ATTRIBUTES) {
      const bonus = heritage.attributeBonuses?.[attribute] ?? 0;
      if (bonus !== 0) {
        attributeBonuses[attribute] = (attributeBonuses[attribute] ?? 0) + bonus;
      }
    }
  }

  return { hitPointsBonus, attributeBonuses };
}

/** Applies the exact bonus delta between two active-heritage sets. */
export function transitionRaceHeritageAttributes(
  attributes: AttributeMap,
  previousBonuses: RaceAttributeBonuses,
  nextBonuses: RaceAttributeBonuses,
): AttributeMap {
  const updatedAttributes: AttributeMap = { ...attributes };

  for (const attribute of HERITAGE_ATTRIBUTES) {
    updatedAttributes[attribute] += (nextBonuses[attribute] ?? 0) - (previousBonuses[attribute] ?? 0);
  }

  return updatedAttributes;
}

/** Calculates maximum HP from persisted attributes and cumulative heritage HP bonuses. */
export function getHeritageHitPointsMax(
  attributes: AttributeMap,
  level: number,
  hitPointsBonus: number,
): number {
  return getDerivedStats(attributes, level).hitPointsMax + hitPointsBonus;
}

/**
 * Calcula o modificador de um atributo (D-17).
 * Fórmula: (valor - 10) / 2, arredondado para baixo.
 */
export function getModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

/**
 * Calcula a vida máxima do personagem (RF-036).
 * Fórmula: 15 + (mod Vigor × Nível)
 */
export function getMaxHitPoints(vigor: number, level: number): number {
  return 15 + getModifier(vigor) * level;
}

/**
 * Calcula a mana máxima do personagem (RF-036).
 * Fórmula: 5 + (mod Inteligência × Nível)
 */
export function getMaxManaPoints(inteligencia: number, level: number): number {
  return 5 + getModifier(inteligencia) * level;
}

/**
 * Calcula o valor de bloqueio (mitigação de dano físico) (D-12, D-19).
 * Fórmula: (Vigor ÷ 2) arredondado para baixo × Nível
 */
export function getBlockValue(vigor: number, level: number): number {
  return Math.floor(vigor / 2) * level;
}

/**
 * Calcula o número de perícias treinadas disponíveis (D-40).
 * Fórmula: igual ao cálculo de mitigação (Inteligência ÷ 2, arredondado para baixo × Nível)
 */
export function getTrainedSkillSlots(inteligencia: number, level: number = 1): number {
  return Math.floor(inteligencia / 2) * level;
}

/**
 * Calcula todos os status derivados de um personagem.
 */
export function getDerivedStats(attributes: Partial<Record<Attribute, number>>, level: number) {
  const normalized = normalizeAttributeMap(attributes);
  return {
    hitPointsMax: getMaxHitPoints(normalized.vigor, level),
    manaPointsMax: getMaxManaPoints(normalized.inteligencia, level),
    block: getBlockValue(normalized.vigor, level),
    trainedSkillSlots: getTrainedSkillSlots(normalized.inteligencia, level),
    modifiers: Object.fromEntries(
      ATTRIBUTES.map((attr) => [attr, getModifier(normalized[attr])]),
    ) as Record<Attribute, number>,
  };
}

/**
 * Valida a distribuição de atributos na criação do personagem (D-17, Issue #14).
 * Cada atributo começa em 8, com 10 pontos livres. Soma total = 58.
 */
export function validateCreationAttributes(attributes: Partial<Record<Attribute, number>>): {
  valid: boolean;
  error?: string;
} {
  const normalized = normalizeAttributeMap(attributes);
  const total = ATTRIBUTES.reduce((sum, attr) => sum + normalized[attr], 0);
  const expectedTotal = ATTRIBUTES.length * ATTRIBUTE_BASE_VALUE + ATTRIBUTE_FREE_POINTS;

  if (total !== expectedTotal) {
    return {
      valid: false,
      error: `Soma dos atributos deve ser ${expectedTotal}, mas é ${total}`,
    };
  }

  for (const attr of ATTRIBUTES) {
    if (normalized[attr] < 1) {
      return { valid: false, error: `${attr} não pode ser menor que 1` };
    }
  }

  return { valid: true };
}
