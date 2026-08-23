// =============================================================================
// Libmork — Validators: Classes (RF-033, D-21)
// =============================================================================

import { z } from "zod";

/**
 * Item inicial da classe (schema JSONB initial_items).
 */
const initialItemSchema = z.object({
  item_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, "Nome do item é obrigatório"),
  quantity: z.number().int().min(1).default(1),
  description: z.string().max(5000).optional(),
});

/**
 * Proficiências da classe (schema JSONB proficiencies).
 */
const proficienciesSchema = z.object({
  weapons: z.array(z.string()).optional(),
  armor: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
});

/**
 * Schema de criação de classe (RF-033, D-21).
 */
export const createClassSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  initialItems: z.array(initialItemSchema).default([]),
  proficiencies: proficienciesSchema.default({}),
});

export const updateClassSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  initialItems: z.array(initialItemSchema).optional(),
  proficiencies: proficienciesSchema.optional(),
});

/**
 * Benefícios por nível da classe (schema JSONB benefits, D-21).
 */
export const createClassBenefitSchema = z.object({
  level: z.number().int().min(1).max(20),
  benefits: z
    .object({
      attribute_bonuses: z
        .object({
          forca: z.number().int().optional(),
          destreza: z.number().int().optional(),
          vigor: z.number().int().optional(),
          inteligencia: z.number().int().optional(),
          empatia: z.number().int().optional(),
        })
        .optional(),
      hp_bonus: z.number().int().optional(),
      mana_bonus: z.number().int().optional(),
      skills_granted: z.array(z.string()).optional(),
      spells_granted: z.array(z.string()).optional(),
      extra_trained_skills: z.number().int().optional(),
      advantages: z.array(z.string()).optional(),
      description: z.string().max(5000).optional(),
    })
    .default({}),
});

export const updateClassBenefitSchema = z.object({
  level: z.number().int().min(1).max(20).optional(),
  benefits: z
    .object({
      attribute_bonuses: z
        .object({
          forca: z.number().int().optional(),
          destreza: z.number().int().optional(),
          vigor: z.number().int().optional(),
          inteligencia: z.number().int().optional(),
          empatia: z.number().int().optional(),
        })
        .optional(),
      hp_bonus: z.number().int().optional(),
      mana_bonus: z.number().int().optional(),
      skills_granted: z.array(z.string()).optional(),
      spells_granted: z.array(z.string()).optional(),
      extra_trained_skills: z.number().int().optional(),
      advantages: z.array(z.string()).optional(),
      description: z.string().max(5000).optional(),
    })
    .optional(),
});
