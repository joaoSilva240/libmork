// =============================================================================
// Libmork — Motor de Regras: Pathfinder 2e (PF2e Rules Core)
// =============================================================================
// Implementação das regras fundamentais do Pathfinder 2e:
// - 4 Graus de Sucesso (Critical Success, Success, Failure, Critical Failure)
// - Sistema de Proficiência TEML (Untrained, Trained, Expert, Master, Legendary)
// - Penalidade de Ataque Múltiplo (MAP)
// - Cálculos de CA e Salvaguardas
// =============================================================================

import type { Pf2eProficiencyRank, Pf2eDegreeOfSuccess } from "@/lib/utils/constants";
import type { AttackResolutionParams, AttackResolutionResult, TestResolutionResult } from "./types";

/**
 * Calcula o modificador de atributo no padrão Pathfinder 2e / d20.
 * Fórmula: Math.floor((score - 10) / 2)
 *
 * Exemplo:
 * - 8  -> -1
 * - 10 -> +0
 * - 12 -> +1
 * - 14 -> +2
 * - 16 -> +3
 * - 18 -> +4
 */
export function getPf2eModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Retorna o bônus de proficiência baseado no ranking TEML e no nível do personagem.
 *
 * Tabela oficial PF2e:
 * - Untrained (Destreinado): +0
 * - Trained (Treinado): nível + 2
 * - Expert (Especialista): nível + 4
 * - Master (Mestre): nível + 6
 * - Legendary (Lendário): nível + 8
 */
export function getPf2eProficiencyBonus(rank: Pf2eProficiencyRank, level: number = 1): number {
  const currentLevel = Math.max(1, level);
  switch (rank) {
    case "untrained":
      return 0;
    case "trained":
      return currentLevel + 2;
    case "expert":
      return currentLevel + 4;
    case "master":
      return currentLevel + 6;
    case "legendary":
      return currentLevel + 8;
  }
}

/**
 * Retorna a Penalidade de Ataques Múltiplos (MAP) com base no índice do ataque no turno.
 *
 * - 1º ataque (índice 0): 0
 * - 2º ataque (índice 1): -5 (-4 para armas com traço Ágil)
 * - 3º+ ataque (índice 2+): -10 (-8 para armas com traço Ágil)
 */
export function getPf2eMultipleAttackPenalty(
  attackIndex: number,
  isAgile: boolean = false,
): number {
  if (attackIndex <= 0) return 0;
  if (attackIndex === 1) return isAgile ? -4 : -5;
  return isAgile ? -8 : -10;
}

const DEGREE_UPGRADES: Record<Pf2eDegreeOfSuccess, Pf2eDegreeOfSuccess> = {
  critical_failure: "failure",
  failure: "success",
  success: "critical_success",
  critical_success: "critical_success",
};

const DEGREE_DOWNGRADES: Record<Pf2eDegreeOfSuccess, Pf2eDegreeOfSuccess> = {
  critical_success: "success",
  success: "failure",
  failure: "critical_failure",
  critical_failure: "critical_failure",
};

export interface ResolvePf2eDegreeParams {
  roll: number;
  modifier: number;
  dc: number;
}

export interface ResolvePf2eDegreeResult {
  roll: number;
  modifier: number;
  total: number;
  dc: number;
  initialDegree: Pf2eDegreeOfSuccess;
  degree: Pf2eDegreeOfSuccess;
  isNatural20: boolean;
  isNatural1: boolean;
  success: boolean;
  details: string;
}

/**
 * Resolve o grau de sucesso oficial do Pathfinder 2e (Core Rulebook p. 445):
 * 1. Calcula o grau inicial comparando total contra DC:
 *    - total >= DC + 10 -> critical_success
 *    - total >= DC      -> success
 *    - total > DC - 10  -> failure
 *    - total <= DC - 10 -> critical_failure
 * 2. Aplica a elevação por Natural 20 (+1 degrau) ou rebaixamento por Natural 1 (-1 degrau).
 */
export function resolvePf2eDegreeOfSuccess(
  params: ResolvePf2eDegreeParams,
): ResolvePf2eDegreeResult {
  const { roll, modifier, dc } = params;
  const total = roll + modifier;

  let initialDegree: Pf2eDegreeOfSuccess;
  if (total >= dc + 10) {
    initialDegree = "critical_success";
  } else if (total >= dc) {
    initialDegree = "success";
  } else if (total > dc - 10) {
    initialDegree = "failure";
  } else {
    initialDegree = "critical_failure";
  }

  const isNatural20 = roll === 20;
  const isNatural1 = roll === 1;

  let degree = initialDegree;
  if (isNatural20) {
    degree = DEGREE_UPGRADES[initialDegree];
  } else if (isNatural1) {
    degree = DEGREE_DOWNGRADES[initialDegree];
  }

  const success = degree === "success" || degree === "critical_success";

  const degreeLabels: Record<Pf2eDegreeOfSuccess, string> = {
    critical_success: "Sucesso Crítico ⚡",
    success: "Sucesso",
    failure: "Falha",
    critical_failure: "Falha Crítica 💀",
  };

  const naturalLabel = isNatural20 ? " [Natural 20]" : isNatural1 ? " [Natural 1]" : "";
  const details = `Rolou [${roll}] + ${modifier} = ${total} vs CD ${dc}${naturalLabel} — ${degreeLabels[degree]}`;

  return {
    roll,
    modifier,
    total,
    dc,
    initialDegree,
    degree,
    isNatural20,
    isNatural1,
    success,
    details,
  };
}

/**
 * Calcula a Classe de Armadura (CA) no padrão Pathfinder 2e.
 * Fórmula: 10 + Destreza (com limite da armadura) + Proficiência TEML + Bônus de Item + Escudo
 */
export function calculatePf2eAc(params: {
  dexterityMod: number;
  armorProficiencyBonus: number;
  itemBonus?: number;
  maxDexBonus?: number | null;
  shieldRaised?: boolean;
  shieldBonus?: number;
}): number {
  const dex =
    params.maxDexBonus !== undefined && params.maxDexBonus !== null
      ? Math.min(params.dexterityMod, params.maxDexBonus)
      : params.dexterityMod;

  const base = 10 + dex + params.armorProficiencyBonus + (params.itemBonus ?? 0);
  const shield = params.shieldRaised ? (params.shieldBonus ?? 2) : 0;
  return base + shield;
}

/**
 * Calcula a Salvaguarda (Fortitude, Reflexos ou Vontade) de PF2e.
 * Fórmula: Modificador de Atributo + Bônus de Proficiência TEML + Bônus de Item
 */
export function calculatePf2eSave(params: {
  attributeMod: number;
  proficiencyBonus: number;
  itemBonus?: number;
}): number {
  return params.attributeMod + params.proficiencyBonus + (params.itemBonus ?? 0);
}

/**
 * Resolve ataque em Pathfinder 2e compatível com a interface do Libmork.
 * Em acerto crítico (critical_success), o dano total é dobrado.
 */
export function resolvePf2eAttack(
  params: AttackResolutionParams & { isAgile?: boolean; attackIndex?: number },
): AttackResolutionResult {
  const { rawDamage, reaction, attackRoll, defenseValue, vigor, level } = params;

  // CD para acertar é a Defesa/CA do alvo
  const total = attackRoll; // no Libmork AttackResolutionParams, attackRoll já inclui rolagem + mod
  let initialDegree: Pf2eDegreeOfSuccess;
  if (total >= defenseValue + 10) {
    initialDegree = "critical_success";
  } else if (total >= defenseValue) {
    initialDegree = "success";
  } else if (total > defenseValue - 10) {
    initialDegree = "failure";
  } else {
    initialDegree = "critical_failure";
  }

  const isHit = initialDegree === "success" || initialDegree === "critical_success";
  const isCritical = initialDegree === "critical_success";

  if (!isHit) {
    return {
      hit: false,
      damageTaken: 0,
      blocked: 0,
      details: `Ataque ${total} vs CA ${defenseValue} — Erro (${initialDegree === "critical_failure" ? "Falha Crítica" : "Falha"})`,
    };
  }

  // Dano base (dobrado no crítico)
  const effectiveDamage = isCritical ? rawDamage * 2 : rawDamage;

  if (reaction === "dodge") {
    // Em esquiva bem sucedida do atacante, o alvo recebe o dano
    return {
      hit: true,
      damageTaken: effectiveDamage,
      blocked: 0,
      details: isCritical
        ? `Ataque ${total} vs CA ${defenseValue} — ACERTO CRÍTICO! Dano dobrado: ${effectiveDamage}`
        : `Ataque ${total} vs CA ${defenseValue} — Acerto. Dano: ${effectiveDamage}`,
    };
  }

  // Bloqueio com Escudo (Shield Block)
  // Reduz dano pelo valor de dureza/mitigação
  const hardness = Math.max(5, getPf2eModifier(vigor) + level);
  const blocked = Math.min(effectiveDamage, hardness);
  const damageTaken = Math.max(0, effectiveDamage - blocked);

  return {
    hit: true,
    damageTaken,
    blocked,
    details: isCritical
      ? `Ataque ${total} vs CA ${defenseValue} — ACERTO CRÍTICO! Dano: ${effectiveDamage}, Bloqueio com Escudo mitigou ${blocked}. Dano sofrido: ${damageTaken}`
      : `Ataque ${total} vs CA ${defenseValue} — Acerto. Dano: ${effectiveDamage}, Bloqueio mitigou ${blocked}. Dano sofrido: ${damageTaken}`,
  };
}
