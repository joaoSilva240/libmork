// =============================================================================
// Libmork — Validators: Conteúdo (Biblioteca Global e por Campanha)
// =============================================================================
// RF-016 (biblioteca global), RF-017 (privado por campanha), RF-031, RF-034.
// =============================================================================

import { z } from "zod";
import { ATTRIBUTES } from "@/lib/utils/constants";
import { NPC_DAMAGE_TYPES } from "@/lib/engine/npc-attack";

/**
 * Sistema de regras ao qual o conteúdo pertence.
 * 'generic' = compartilhado (Libmork d20 / Pathfinder 2e).
 */
export const CONTENT_RULE_SYSTEMS = ["generic", "libmork", "pathfinder", "fallout_2d20"] as const;
export type ContentRuleSystem = (typeof CONTENT_RULE_SYSTEMS)[number];

export const ruleSystemSchema = z.enum(CONTENT_RULE_SYSTEMS, {
  message: "Sistema de regras inválido",
});

/**
 * Sistemas que compartilham o conteúdo 'generic' (base d20 comum). Fallout
 * 2d20 é mecanicamente distinto, então seu filtro exclui o genérico.
 */
export const GENERIC_SHARED_SYSTEMS = ["libmork", "pathfinder"] as const;

/** Valores de rule_system aplicáveis quando o usuário filtra por sistema. */
export function ruleSystemFilterValues(ruleSystem: ContentRuleSystem): string[] {
  return (GENERIC_SHARED_SYSTEMS as readonly string[]).includes(ruleSystem)
    ? ["generic", ruleSystem]
    : [ruleSystem];
}

/**
 * Schema de perícia/habilidade (RF-031, D-20, D-35).
 */
export const skillSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  rollExpression: z.string().max(200).optional().nullable(),
  keyAttribute: z.enum(ATTRIBUTES, { message: "Atributo chave inválido" }),
  ruleSystem: ruleSystemSchema.default("generic"),
});

/**
 * Schema de magia (RF-034, D-22, D-39).
 */
export const spellSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  circle: z.number().int().min(1).max(9).default(1),
  manaCost: z.number().int().min(0).default(0),
  description: z.string().max(5000).optional().nullable(),
  useType: z.string().default("somatic"),
  duration: z.string().max(100).optional().nullable(),
  extraEffect: z.string().max(5000).optional().nullable(),
  actionCostOverride: z.number().int().min(0).max(3).optional().nullable(),
  imageUrl: z
    .url()
    .refine((value) => /^https?:\/\//i.test(value), "URL deve usar HTTP ou HTTPS")
    .optional()
    .nullable(),
  range: z.string().max(250).optional().nullable(),
  target: z.string().optional().nullable(),
  area: z.string().max(250).optional().nullable(),
  damage: z.any().optional().nullable(),
  damageType: z.string().max(100).optional().nullable(),
  structuredEffects: z.any().optional().nullable(),
  castingTime: z.string().max(100).optional().nullable(),
  translation: z.any().optional().nullable(),
  ruleSystem: ruleSystemSchema.default("generic"),
});

/**
 * Schema de item (D-27).
 */
export const itemSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  qualityDescription: z.string().max(5000).optional().nullable(),
  counterpointDescription: z.string().max(5000).optional().nullable(),
  imageUrl: z.url().optional().nullable(),
  sourceData: z.record(z.string(), z.unknown()).optional().nullable(),
  translation: z.any().optional().nullable(),
  ruleSystem: ruleSystemSchema.default("generic"),
});

/**
 * Schema de condição (D-08).
 */
export const conditionSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  ruleSystem: ruleSystemSchema.default("generic"),
});

/**
 * Schema de atualização de magia — SEM defaults para não resetar
 * campos omitidos no PATCH (o create usa defaults para conveniência).
 */
export const updateSpellSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  circle: z.number().int().min(1).max(9).optional(),
  manaCost: z.number().int().min(0).optional(),
  description: z.string().max(5000).optional().nullable(),
  useType: z.string().optional(),
  duration: z.string().max(100).optional().nullable(),
  extraEffect: z.string().max(5000).optional().nullable(),
  actionCostOverride: z.number().int().min(0).max(3).optional().nullable(),
  imageUrl: z
    .url()
    .refine((value) => /^https?:\/\//i.test(value), "URL deve usar HTTP ou HTTPS")
    .optional()
    .nullable(),
  range: z.string().max(250).optional().nullable(),
  target: z.string().optional().nullable(),
  area: z.string().max(250).optional().nullable(),
  damage: z.any().optional().nullable(),
  damageType: z.string().max(100).optional().nullable(),
  structuredEffects: z.any().optional().nullable(),
  castingTime: z.string().max(100).optional().nullable(),
  translation: z.any().optional().nullable(),
  ruleSystem: ruleSystemSchema.optional(),
});

/**
 * Schema de ataque da Biblioteca Global (issue #90 follow-up).
 * Mesma validação de dados dos pins de NPC (diceExpression em npcPin.ts).
 */
export const attackSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  attackExpression: z
    .string()
    .max(200)
    .regex(
      /^\s*[+-]?\s*\d*d\s*\d+\s*(?:[+-]\s*\d+)?\s*$/i,
      "Ataque inválido. Use XdY±Z (ex.: 1d20+9).",
    )
    .optional()
    .nullable(),
  damageExpression: z
    .string()
    .max(200)
    .regex(/^\s*\d*d\s*\d+\s*(?:[+-]\s*\d+)?\s*$/i, "Dano inválido. Use XdY±Z (ex.: 3d6+5).")
    .optional()
    .nullable(),
  damageType: z.enum(NPC_DAMAGE_TYPES).optional().nullable(),
  criticalRange: z
    .number()
    .int()
    .min(1, "Faixa de crítico deve ser entre 1 e 20")
    .max(20, "Faixa de crítico deve ser entre 1 e 20")
    .optional()
    .nullable(),
});

/** Tipos de conteúdo suportados */
export const CONTENT_TYPES = ["skills", "spells", "items", "conditions", "attacks"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Tipos com junção ficha↔conteúdo (RF-017). Ataques não têm junção com fichas:
 * são vinculados a NPCs via npc_pins.content_id (issue #90 follow-up).
 */
export const CHARACTER_CONTENT_TYPES = ["skills", "spells", "items", "conditions"] as const;
export type CharacterContentType = (typeof CHARACTER_CONTENT_TYPES)[number];

export const characterContentTypeSchema = z.enum(CHARACTER_CONTENT_TYPES, {
  message: "Tipo de conteúdo inválido",
});

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
    case "attacks":
      return attackSchema;
  }
}

/**
 * Validador de atualização (parcial) por tipo de conteúdo.
 * Sem defaults nos campos opcionais — PATCH não pode resetar dados.
 */
export function getContentUpdateValidator(type: ContentType) {
  switch (type) {
    case "skills":
      return skillSchema.partial();
    case "spells":
      return updateSpellSchema;
    case "items":
      return itemSchema.partial();
    case "conditions":
      return conditionSchema.partial();
    case "attacks":
      return attackSchema.partial();
  }
}

/** Nome singular para mensagens de erro (ex.: "magia não encontrada") */
export const CONTENT_LABELS: Record<ContentType, string> = {
  skills: "perícia",
  spells: "magia",
  items: "item",
  conditions: "condição",
  attacks: "ataque",
};
