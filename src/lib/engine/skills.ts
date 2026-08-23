// =============================================================================
// Libmork — Motor de Regras: Perícias (D-20, D-35, D-40)
// =============================================================================

import { getModifier, getTrainedSkillSlots, type AttributeMap } from "./attributes";

/**
 * Resolve um teste de perícia.
 *
 * @param keyAttribute Atributo chave da perícia
 * @param attributes Mapa de atributos do personagem
 * @param trained Se o personagem é treinado na perícia
 * @returns Modificador total e se tem vantagem
 */
export function getSkillTestModifier(
  keyAttribute: keyof AttributeMap,
  attributes: AttributeMap,
  trained: boolean,
): {
  modifier: number;
  advantage: boolean;
} {
  return {
    modifier: getModifier(attributes[keyAttribute]),
    advantage: trained,
  };
}

/**
 * Valida se o personagem pode treinar mais perícias (D-40).
 */
export function canTrainMoreSkills(
  currentTrainedCount: number,
  inteligencia: number,
  level: number = 1,
): boolean {
  return currentTrainedCount < getTrainedSkillSlots(inteligencia, level);
}
