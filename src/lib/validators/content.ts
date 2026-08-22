// =============================================================================
// Libmork — Validators: Conteúdo (Biblioteca Global e por Campanha)
// =============================================================================
// RF-016 (biblioteca global), RF-017 (privado por campanha), RF-031, RF-034.
// =============================================================================

import { z } from "zod";
import { ATTRIBUTES, SPELL_USE_TYPES } from "@/lib/utils/constants";

/**
 * Schema de perícia/habilidade (RF-031, D-20, D-35).
 */
export const skillSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  rollExpression: z.string().max(200).optional().nullable(),
  keyAttribute: z.enum(ATTRIBUTES, { message: "Atributo chave inválido" }),
});

/**
 * Schema de magia (RF-034, D-22, D-39).
 */
export const spellSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  circle: z.number().int().min(1).max(9).default(1),
  manaCost: z.number().int().min(0).default(0),
  description: z.string().max(5000).optional().nullable(),
  useType: z.enum(SPELL_USE_TYPES).default("somatic"),
  duration: z.string().max(100).optional().nullable(),
  extraEffect: z.string().max(5000).optional().nullable(),
  actionCostOverride: z.number().int().min(0).max(3).optional().nullable(),
});

/**
 * Schema de item (D-27).
 */
export const itemSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  qualityDescription: z.string().max(5000).optional().nullable(),
  counterpointDescription: z.string().max(5000).optional().nullable(),
});

/**
 * Schema de condição (D-08).
 */
export const conditionSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
});

/** Tipos de conteúdo suportados */
export const CONTENT_TYPES = ["skills", "spells", "items", "conditions"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const contentTypeSchema = z.enum(CONTENT_TYPES, {
  message: "Tipo de conteúdo inválido",
});

/**
 * Validador de criação por tipo de conteúdo.
 */
export function getContentCreateValidator(type: ContentType) {
  switch (type) {
    case "skills":
      return skillSchema;
    case "spells":
      return spellSchema;
    case "items":
      return itemSchema;
    case "conditions":
      return conditionSchema;
  }
}

/**
 * Validador de atualização (parcial) por tipo de conteúdo.
 */
export function getContentUpdateValidator(type: ContentType) {
  switch (type) {
    case "skills":
      return skillSchema.partial();
    case "spells":
      return spellSchema.partial();
    case "items":
      return itemSchema.partial();
    case "conditions":
      return conditionSchema.partial();
  }
}

/** Nome singular para mensagens de erro (ex.: "magia não encontrada") */
export const CONTENT_LABELS: Record<ContentType, string> = {
  skills: "perícia",
  spells: "magia",
  items: "item",
  conditions: "condição",
};
