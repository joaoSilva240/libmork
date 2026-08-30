// =============================================================================
// Libmork — Validators: Personagens
// =============================================================================

import { z } from "zod";
import { ATTRIBUTES, ATTRIBUTE_BASE_VALUE, ATTRIBUTE_FREE_POINTS } from "@/lib/utils/constants";

/**
 * Schema de atributos do personagem.
 * Base: 8 pontos em cada atributo + 8 pontos livres (D-17)
 */
export const attributesSchema = z.object({
  forca: z.number().int().min(1).max(30),
  destreza: z.number().int().min(1).max(30),
  vigor: z.number().int().min(1).max(30),
  inteligencia: z.number().int().min(1).max(30),
  empatia: z.number().int().min(1).max(30),
});

/**
 * Schema de criação de personagem (RF-006).
 * Campos mínimos: nome, classe (opcional), atributos
 * Wizard de criação: raça, itens, magias, perícias, descrição, imagem
 */
export const createCharacterSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(500).optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  raceId: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  attributes: attributesSchema.optional(),
  skills: z.array(z.string().uuid()).optional().default([]),
  spells: z.array(z.string().uuid()).optional().default([]),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  })).optional().default([]),
}).refine(
  (data) => {
    // Validar soma de atributos na criação (se fornecidos)
    if (data.attributes) {
      const sum = Object.values(data.attributes).reduce((acc, val) => acc + val, 0);
      const expectedSum = ATTRIBUTES.length * ATTRIBUTE_BASE_VALUE + ATTRIBUTE_FREE_POINTS;
      return sum === expectedSum;
    }
    return true;
  },
  {
    message: `A soma dos atributos deve ser ${ATTRIBUTES.length * ATTRIBUTE_BASE_VALUE + ATTRIBUTE_FREE_POINTS}`,
  }
);

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

/**
 * Schema de atualização de personagem (RF-009).
 * Todos os campos são opcionais
 */
export const updateCharacterSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  classId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  attributes: attributesSchema.optional(),
  hitPointsCurrent: z.number().int().min(0).optional(),
  manaPointsCurrent: z.number().int().min(0).optional(),
  block: z.number().int().min(0).optional(),
  xp: z.number().int().min(0).optional(),
}).partial();

export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
