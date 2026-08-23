// =============================================================================
// Libmork — Motor de Regras: Contrato de Sistemas (Modular Game Systems)
// =============================================================================

import type { DefenseReaction } from "./combat";
import type { AttributeMap, getDerivedStats } from "./attributes";

export type { AttributeMap };
export type DerivedStats = ReturnType<typeof getDerivedStats>;

export interface AttackResolutionParams {
  rawDamage: number;
  reaction: DefenseReaction;
  attackRoll: number;
  defenseValue: number;
  vigor: number;
  level: number;
  isPhysical: boolean;
}

export interface AttackResolutionResult {
  hit: boolean;
  damageTaken: number;
  blocked: number;
  details: string;
}

export interface TestResolutionResult {
  success: boolean;
  total: number;
  details: string;
}

export interface PhoenixRebirthResult {
  newLevel: number;
  newHpMax: number;
  newHpCurrent: number;
  newManaMax: number;
  newManaCurrent: number;
}

/**
 * Contrato base para qualquer sistema de regras registrado no Libmork.
 * Permite suporte plugável a múltiplos sistemas de RPG (Libmork, D&D, Tormenta20, etc).
 */
export interface GameSystem {
  id: string;
  name: string;
  description: string;

  /** Cálculo de modificador de atributo */
  getModifier(attributeValue: number): number;

  /** Cálculo de status derivados */
  getDerivedStats(attributes: AttributeMap, level: number): DerivedStats;

  /** Defesa estática para esquiva */
  getDefenseValue(destreza: number): number;

  /** Mitigação de dano em bloqueio */
  getBlockValue(vigor: number, level: number): number;

  /** Quantidade de slots de perícias treinadas */
  getTrainedSkillSlots(inteligencia: number, level: number): number;

  /** Resolução de testes de atributo/perícia */
  resolveTest(
    engine: "d20_mod" | "dual_d20_sum",
    modifier: number,
    difficulty: number,
    advantage?: boolean,
  ): TestResolutionResult;

  /** Resolução de ataque e defesa */
  resolveAttack(params: AttackResolutionParams): AttackResolutionResult;

  /** Cálculo de custo em ações para conjuração de magias */
  getSpellActionCost(circle: number, spellCastTime?: number | null): number;

  /** Dificuldade do teste de salvaguarda de morte */
  getDeathSaveDifficulty(vigor: number): number;

  /** Processa rolagem do teste de morte */
  processDeathSaveRoll(
    currentSuccesses: number,
    currentFailures: number,
    dieRoll: number,
    vigorMod: number
  ): {
    success: boolean;
    dieRoll: number;
    dc: number;
    newSuccesses: number;
    newFailures: number;
    isStabilized: boolean;
    isDead: boolean;
    details: string;
  };

  /** Cálculo de renascimento Fênix */
  calculatePhoenixRebirth(
    currentLevel: number,
    vigor: number,
    inteligencia: number,
  ): PhoenixRebirthResult;

  /** Cálculo de Pontos de Sombra na morte definitiva */
  calculateShadowPointsGained(level: number): number;

  /** Cálculo da dificuldade ajustada por Pontos de Sombra na campanha (RF-055) */
  getEffectiveDifficulty(baseDifficulty: number, shadowPointsDifficultyModifier?: number): number;
}
