// =============================================================================
// Libmork — Motor de Regras: Combate (D-19, D-24, D-41)
// =============================================================================
// Executado no CLIENTE para velocidade (D-43).
// =============================================================================

import { getModifier, getBlockValue } from "./attributes";

/** Tipo de reação defensiva (D-41) */
export type DefenseReaction = "dodge" | "block";

/**
 * Calcula o dano efetivo após reação defensiva (D-19, D-24).
 *
 * @param rawDamage Dano bruto do ataque
 * @param reaction Reação defensiva escolhida (Esquivar ou Bloqueio)
 * @param attackRoll Resultado da rolagem de ataque (para esquiva)
 * @param defenseValue Valor de defesa estático do alvo (para esquiva)
 * @param vigor Valor de Vigor do defensor (para bloqueio)
 * @param level Nível do defensor (para bloqueio)
 * @param isPhysical Se o dano é físico (bloqueio só funciona contra físico — D-19)
 */
export function resolveAttack(params: {
  rawDamage: number;
  reaction: DefenseReaction;
  attackRoll: number;
  defenseValue: number;
  vigor: number;
  level: number;
  isPhysical: boolean;
}): {
  hit: boolean;
  damageTaken: number;
  blocked: number;
  details: string;
} {
  const { rawDamage, reaction, attackRoll, defenseValue, vigor, level, isPhysical } = params;

  if (reaction === "dodge") {
    // Esquiva: testa contra defesa estática
    const hit = attackRoll >= defenseValue;
    return {
      hit,
      damageTaken: hit ? rawDamage : 0,
      blocked: 0,
      details: hit
        ? `Ataque ${attackRoll} >= Defesa ${defenseValue}: acertou! Dano: ${rawDamage}`
        : `Ataque ${attackRoll} < Defesa ${defenseValue}: esquivou!`,
    };
  }

  // Bloqueio: acerto automático, mas dano mitigado (D-19)
  if (!isPhysical) {
    // Bloqueio só funciona contra dano físico
    return {
      hit: true,
      damageTaken: rawDamage,
      blocked: 0,
      details: `Bloqueio ineficaz contra dano não-físico. Dano total: ${rawDamage}`,
    };
  }

  const blockValue = getBlockValue(vigor, level);
  const damageTaken = Math.max(0, rawDamage - blockValue);

  return {
    hit: true,
    damageTaken,
    blocked: Math.min(blockValue, rawDamage),
    details: `Bloqueio: ${rawDamage} - ${blockValue} (Vigor) = ${damageTaken} dano recebido`,
  };
}

/**
 * Calcula o valor de defesa estática de um personagem (para esquiva).
 * Fórmula: 10 + modificador de Destreza
 */
export function getDefenseValue(destreza: number): number {
  return 10 + getModifier(destreza);
}

/**
 * Verifica se o personagem está caído (0 HP) e deve entrar no fluxo de morte (D-25).
 */
export function shouldEnterDeathFlow(currentHp: number): boolean {
  return currentHp <= 0;
}

/**
 * Calcula a dificuldade do teste de morte (D-25).
 * Fórmula: 10 - modificador de Vigor
 */
export function getDeathSaveDifficulty(vigor: number): number {
  return 10 - getModifier(vigor);
}

/**
 * Calcula stats do Renascimento Fênix (D-25).
 * Metade dos níveis (arredondado para baixo), 50% HP/Mana do novo nível.
 */
export function calculatePhoenixRebirth(
  currentLevel: number,
  vigor: number,
  inteligencia: number,
): {
  newLevel: number;
  newHpMax: number;
  newHpCurrent: number;
  newManaMax: number;
  newManaCurrent: number;
} {
  const newLevel = Math.max(1, Math.floor(currentLevel / 2));
  const newHpMax = 15 + getModifier(vigor) * newLevel;
  const newManaMax = 5 + getModifier(inteligencia) * newLevel;

  return {
    newLevel,
    newHpMax,
    newHpCurrent: Math.floor(newHpMax * 0.5),
    newManaMax,
    newManaCurrent: Math.floor(newManaMax * 0.5),
  };
}

/**
 * Calcula os Pontos de Sombra ganhos na morte definitiva (D-26).
 * Metade do nível do personagem morto, arredondado para baixo.
 */
export function calculateShadowPointsGained(level: number): number {
  return Math.floor(level / 2);
}
