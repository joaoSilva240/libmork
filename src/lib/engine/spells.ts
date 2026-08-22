// =============================================================================
// Libmork — Motor de Regras: Magias e Custo de Ações (D-22, D-39)
// =============================================================================
// Executado no CLIENTE para velocidade (D-43).
// =============================================================================

import { SPELL_ACTION_COST_BY_CIRCLE, ACTIONS_PER_TURN } from "@/lib/utils/constants";

/**
 * Retorna o custo de ações para conjurar uma magia (D-39).
 *
 * @param circle Círculo da magia (1-9)
 * @param actionCostOverride Override individual da magia (campo "Tempo de Conjuração")
 * @returns Número de ações necessárias
 */
export function getSpellActionCost(circle: number, actionCostOverride?: number | null): number {
  if (actionCostOverride != null && actionCostOverride > 0) {
    return actionCostOverride;
  }
  return SPELL_ACTION_COST_BY_CIRCLE[circle] ?? 1;
}

/**
 * Verifica se o personagem tem ações suficientes para conjurar a magia.
 */
export function canCastSpell(
  actionsRemaining: number,
  circle: number,
  actionCostOverride?: number | null,
): { canCast: boolean; cost: number; actionsAfter: number } {
  const cost = getSpellActionCost(circle, actionCostOverride);
  return {
    canCast: actionsRemaining >= cost,
    cost,
    actionsAfter: actionsRemaining - cost,
  };
}

/**
 * Verifica se o personagem tem mana suficiente para conjurar a magia.
 */
export function hasEnoughMana(currentMana: number, manaCost: number): boolean {
  return currentMana >= manaCost;
}

/**
 * Verifica se a magia consome o turno inteiro (7º-9º círculo padrão).
 */
export function isFullTurnSpell(circle: number, actionCostOverride?: number | null): boolean {
  return getSpellActionCost(circle, actionCostOverride) >= ACTIONS_PER_TURN;
}
