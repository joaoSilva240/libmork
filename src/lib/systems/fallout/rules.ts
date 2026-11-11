// =============================================================================
// Libmork — Sistema Fallout 2d20: Motor de Regras
// Resolução oficial 2d20, Dados de Combate (DC), Localização de Dano e Derivações
// =============================================================================

import type {
  CombatDiceRollResult,
  CombatDie,
  FalloutBodyLocation,
  FalloutBodyPart,
  FalloutCharacter,
  FalloutRollDie,
  FalloutRollParams,
  FalloutRollResult,
  FalloutSkillName,
  FalloutSkillState,
} from "./types";
import type { CreateFalloutCharacterInput } from "./validators";
import { FALLOUT_BODY_LOCATIONS, FALLOUT_DEFAULT_BODY_PARTS, FALLOUT_SKILLS } from "./types";

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
      injuries: 0,
      isCrippled: false,
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

export function createInitialFalloutCharacter(
  input: CreateFalloutCharacterInput,
  ownerId: string,
  id?: string,
): FalloutCharacter {
  const charId = id || `fallout-char-${Date.now()}`;
  const now = new Date().toISOString();

  const maxHp = calculateMaxHp(input.attributes.end, input.attributes.luc, input.level);

  return {
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
    hpCurrent: maxHp,
    hpMax: maxHp,
    radiation: 0,
    luckPointsCurrent: input.attributes.luc,
    defense: calculateDefense(input.attributes.agi),
    initiative: calculateInitiative(input.attributes.per, input.attributes.agi),
    meleeDamageBonus: calculateMeleeDamageBonus(input.attributes.str),
    carryWeightMax: calculateCarryWeightMax(input.attributes.str),
    caps: input.caps || 0,
    bodyParts: initializeFalloutBodyParts(),
    items: [],
    perks: [],
    createdAt: now,
    updatedAt: now,
  };
}
