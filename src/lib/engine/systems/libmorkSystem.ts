// =============================================================================
// Libmork — Sistema Padrão Libmork (Implementação de GameSystem)
// =============================================================================

import type {
  GameSystem,
  DerivedStats,
  AttackResolutionParams,
  AttackResolutionResult,
  TestResolutionResult,
  PhoenixRebirthResult,
} from "../types";
import { getModifier, getDerivedStats, getBlockValue, getTrainedSkillSlots } from "../attributes";
import { resolveAttack, getDefenseValue, getDeathSaveDifficulty, calculatePhoenixRebirth, calculateShadowPointsGained, processDeathSaveRoll } from "../combat";
import { resolveTest } from "../dice";
import { getSpellActionCost } from "../spells";

import type { AttributeMap } from "../attributes";

export class LibmorkSystem implements GameSystem {
  id = "libmork";
  name = "Libmork System";
  description = "Sistema próprio de regras Libmork (D&D + Ordem Paranormal + 2D20 inspirado).";

  getModifier(attributeValue: number): number {
    return getModifier(attributeValue);
  }

  getDerivedStats(attributes: AttributeMap, level: number): DerivedStats {
    return getDerivedStats(attributes, level);
  }

  getDefenseValue(destreza: number): number {
    return getDefenseValue(destreza);
  }

  getBlockValue(vigor: number, level: number): number {
    return getBlockValue(vigor, level);
  }

  getTrainedSkillSlots(inteligencia: number, level: number): number {
    return getTrainedSkillSlots(inteligencia, level);
  }

  resolveTest(
    engine: "d20_mod" | "dual_d20_sum",
    modifier: number,
    difficulty: number,
    advantage: boolean = false,
  ): TestResolutionResult {
    return resolveTest(engine, modifier, difficulty, advantage);
  }

  resolveAttack(params: AttackResolutionParams): AttackResolutionResult {
    return resolveAttack(params);
  }

  getSpellActionCost(circle: number, spellCastTime?: number | null): number {
    return getSpellActionCost(circle, spellCastTime);
  }

  getDeathSaveDifficulty(vigor: number): number {
    return getDeathSaveDifficulty(vigor);
  }

  processDeathSaveRoll(
    currentSuccesses: number,
    currentFailures: number,
    dieRoll: number,
    vigorMod: number
  ) {
    return processDeathSaveRoll(currentSuccesses, currentFailures, dieRoll, vigorMod);
  }

  calculatePhoenixRebirth(
    currentLevel: number,
    vigor: number,
    inteligencia: number,
  ): PhoenixRebirthResult {
    return calculatePhoenixRebirth(currentLevel, vigor, inteligencia);
  }

  calculateShadowPointsGained(level: number): number {
    return calculateShadowPointsGained(level);
  }

  getEffectiveDifficulty(baseDifficulty: number, shadowPointsDifficultyModifier: number = 0): number {
    return baseDifficulty + shadowPointsDifficultyModifier;
  }
}

export const libmorkSystem = new LibmorkSystem();
