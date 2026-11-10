// =============================================================================
// Libmork — Sistema Pathfinder 2e (Implementação de GameSystem)
// =============================================================================

import type {
  GameSystem,
  DerivedStats,
  AttackResolutionParams,
  AttackResolutionResult,
  TestResolutionResult,
  PhoenixRebirthResult,
  AttributeMap,
} from "../types";
import { normalizeAttributeMap } from "../attributes";
import {
  getPf2eModifier,
  getPf2eProficiencyBonus,
  resolvePf2eDegreeOfSuccess,
  resolvePf2eAttack,
  calculatePf2eAc,
} from "../pf2e-rules";

export class Pf2eSystem implements GameSystem {
  id = "pf2e";
  name = "Pathfinder 2e";
  description =
    "Sistema oficial Pathfinder 2e com 4 graus de sucesso, proficiências TEML e penalidade de ataque múltiplo (MAP).";

  /** Cálculo de modificador de atributo no padrão PF2e (Math.floor((score - 10) / 2)) */
  getModifier(attributeValue: number): number {
    return getPf2eModifier(attributeValue);
  }

  /**
   * Cálculo de status derivados para PF2e.
   * - HP: Base classe (8) + Ancestralidade (8) + (Constituição * nível)
   * - Mana/Focus: 1 foco inicial base + 1 por nível
   * - Defesa (CA): 10 + Destreza + Treinado (nível + 2)
   * - Bloqueio: Dureza do escudo baseada em Vigor/Constituição
   */
  getDerivedStats(attributes: AttributeMap, level: number): DerivedStats {
    const normalized = normalizeAttributeMap(attributes);
    const currentLevel = Math.max(1, level);
    const conMod = this.getModifier(normalized.vigor);

    // PV PF2e: Ancestralidade (8 base) + (Classe 8 + CON) * nível
    const hitPointsMax = Math.max(10, 8 + (8 + conMod) * currentLevel);

    // Em PF2e usamos Pontos de Foco (1 a 3 pontos)
    const manaPointsMax = Math.min(3, Math.max(1, Math.floor(currentLevel / 5) + 1));

    const block = Math.max(5, conMod + currentLevel);
    const trainedSkillSlots = this.getTrainedSkillSlots(normalized.inteligencia, currentLevel);

    const modifiers = {
      forca: this.getModifier(normalized.forca),
      destreza: this.getModifier(normalized.destreza),
      vigor: conMod,
      inteligencia: this.getModifier(normalized.inteligencia),
      empatia: this.getModifier(normalized.empatia),
      sorte: this.getModifier(normalized.sorte),
    };

    return {
      hitPointsMax,
      manaPointsMax,
      block,
      trainedSkillSlots,
      modifiers,
    };
  }

  /** Defesa / CA estática com Destreza */
  getDefenseValue(destreza: number): number {
    const dexMod = this.getModifier(destreza);
    return calculatePf2eAc({
      dexterityMod: dexMod,
      armorProficiencyBonus: getPf2eProficiencyBonus("trained", 1),
    });
  }

  /** Mitigação de dano em bloqueio de escudo */
  getBlockValue(vigor: number, level: number): number {
    const conMod = this.getModifier(vigor);
    return Math.max(5, conMod + Math.max(1, level));
  }

  /** Quantidade de slots de perícias treinadas (PF2e: base 4 + mod INT) */
  getTrainedSkillSlots(inteligencia: number, _level: number): number {
    const intMod = this.getModifier(inteligencia);
    return Math.max(2, 4 + intMod);
  }

  /**
   * Resolução de testes aplicando os 4 graus de sucesso oficiais de PF2e.
   */
  resolveTest(
    _engine: "d20_mod" | "dual_d20_sum",
    modifier: number,
    difficulty: number,
    advantage: boolean = false,
  ): TestResolutionResult {
    // Rolagem d20 (com vantagem se solicitado)
    let roll = Math.floor(Math.random() * 20) + 1;
    if (advantage) {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      roll = Math.max(roll, roll2);
    }

    const res = resolvePf2eDegreeOfSuccess({
      roll,
      modifier,
      dc: difficulty,
    });

    return {
      success: res.success,
      total: res.total,
      details: res.details,
    };
  }

  /** Resolução de ataque e dano com acerto crítico (dano dobrado) */
  resolveAttack(params: AttackResolutionParams): AttackResolutionResult {
    return resolvePf2eAttack(params);
  }

  /**
   * Custo em ações para conjurar magias em PF2e:
   * Por padrão em PF2e são 2 ações (Verbal + Somático), a menos que haja override específico (1 ou 3 ações).
   */
  getSpellActionCost(_circle: number, spellCastTime?: number | null): number {
    if (spellCastTime && spellCastTime >= 1 && spellCastTime <= 3) {
      return spellCastTime;
    }
    return 2;
  }

  /** Dificuldade base de teste de recuperação (Recovery Check): CD 10 */
  getDeathSaveDifficulty(_vigor: number): number {
    return 10;
  }

  /**
   * Processa teste de salvaguarda de recuperação (Recovery Check de PF2e).
   * - Sucesso Crítico (d20 nat 20 ou total >= CD + 10): reduz morrendo em 2
   * - Sucesso (total >= CD): reduz morrendo em 1
   * - Falha: aumenta morrendo em 1
   * - Falha Crítica (d20 nat 1 ou total <= CD - 10): aumenta morrendo em 2
   */
  processDeathSaveRoll(
    currentSuccesses: number,
    currentFailures: number,
    dieRoll: number,
    vigorMod: number,
  ) {
    const dc = 10;
    const res = resolvePf2eDegreeOfSuccess({
      roll: dieRoll,
      modifier: vigorMod,
      dc,
    });

    let newSuccesses = currentSuccesses;
    let newFailures = currentFailures;

    if (res.degree === "critical_success") {
      newSuccesses += 2;
    } else if (res.degree === "success") {
      newSuccesses += 1;
    } else if (res.degree === "critical_failure") {
      newFailures += 2;
    } else {
      newFailures += 1;
    }

    const isStabilized = newSuccesses >= 3;
    const isDead = newFailures >= 3;

    return {
      success: res.success,
      dieRoll,
      dc,
      newSuccesses,
      newFailures,
      isStabilized,
      isDead,
      details: `${res.details} (Sucessos: ${newSuccesses}/3, Falhas: ${newFailures}/3)`,
    };
  }

  /** Renascimento / Recuperação */
  calculatePhoenixRebirth(
    currentLevel: number,
    vigor: number,
    inteligencia: number,
  ): PhoenixRebirthResult {
    const stats = this.getDerivedStats(
      { forca: 10, destreza: 10, vigor, inteligencia, empatia: 10, sorte: 10 },
      currentLevel,
    );
    return {
      newLevel: currentLevel,
      newHpMax: stats.hitPointsMax,
      newHpCurrent: Math.floor(stats.hitPointsMax / 2),
      newManaMax: stats.manaPointsMax,
      newManaCurrent: 1,
    };
  }

  calculateShadowPointsGained(_level: number): number {
    return 0;
  }

  getEffectiveDifficulty(
    baseDifficulty: number,
    shadowPointsDifficultyModifier: number = 0,
  ): number {
    return baseDifficulty + shadowPointsDifficultyModifier;
  }
}

export const pf2eSystem = new Pf2eSystem();
