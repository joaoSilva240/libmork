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

/** Mapa de atributos do personagem */
export type AttributeMap = Record<Attribute, number>;

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
export function getDerivedStats(attributes: AttributeMap, level: number) {
  return {
    hitPointsMax: getMaxHitPoints(attributes.vigor, level),
    manaPointsMax: getMaxManaPoints(attributes.inteligencia, level),
    block: getBlockValue(attributes.vigor, level),
    trainedSkillSlots: getTrainedSkillSlots(attributes.inteligencia, level),
    modifiers: Object.fromEntries(
      ATTRIBUTES.map((attr) => [attr, getModifier(attributes[attr])]),
    ) as Record<Attribute, number>,
  };
}

/**
 * Valida a distribuição de atributos na criação do personagem (D-17).
 * Cada atributo começa em 8, com 8 pontos livres. Soma total = 48.
 */
export function validateCreationAttributes(attributes: AttributeMap): {
  valid: boolean;
  error?: string;
} {
  const total = ATTRIBUTES.reduce((sum, attr) => sum + attributes[attr], 0);
  const expectedTotal = ATTRIBUTES.length * ATTRIBUTE_BASE_VALUE + ATTRIBUTE_FREE_POINTS;

  if (total !== expectedTotal) {
    return {
      valid: false,
      error: `Soma dos atributos deve ser ${expectedTotal}, mas é ${total}`,
    };
  }

  for (const attr of ATTRIBUTES) {
    if (attributes[attr] < 1) {
      return { valid: false, error: `${attr} não pode ser menor que 1` };
    }
  }

  return { valid: true };
}
