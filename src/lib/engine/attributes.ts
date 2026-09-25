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
