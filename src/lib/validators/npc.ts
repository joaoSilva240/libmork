// =============================================================================
// Libmork — Validators: NPCs (RF-014, D-38)
// =============================================================================

import { z } from "zod";
import { NPC_TYPES } from "@/lib/utils/constants";

/**
 * Schema de criação de NPC (RF-014, D-38).
 * NPCs da Biblioteca (worldId NULL) possuem ficha completa estilo jogador.
 */
export const createNpcSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  npcType: z.enum(NPC_TYPES).default("common"),
  hitPoints: z.number().int().min(0).default(10),
  hitPointsMax: z.number().int().min(0).default(10),
  manaPoints: z.number().int().min(0).default(0),
  manaPointsMax: z.number().int().min(0).default(0),
  attributes: z
    .object({
      forca: z.number().int().min(1).max(30),
      destreza: z.number().int().min(1).max(30),
      vigor: z.number().int().min(1).max(30),
      inteligencia: z.number().int().min(1).max(30),
      empatia: z.number().int().min(1).max(30),
    })
    .default({
      forca: 10,
      destreza: 10,
      vigor: 10,
      inteligencia: 10,
      empatia: 10,
    }),
  level: z.number().int().min(1).max(20).default(1),
  xp: z.number().int().min(0).max(99).default(0),
  block: z.number().int().min(0).default(0),
  classId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  xpReward: z.number().int().min(0).default(0),
});

export const updateNpcSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100).optional(),
  npcType: z.enum(NPC_TYPES).optional(),
  hitPoints: z.number().int().min(0).optional(),
  hitPointsMax: z.number().int().min(0).optional(),
  manaPoints: z.number().int().min(0).optional(),
  manaPointsMax: z.number().int().min(0).optional(),
  attributes: z
    .object({
      forca: z.number().int().min(1).max(30),
      destreza: z.number().int().min(1).max(30),
      vigor: z.number().int().min(1).max(30),
      inteligencia: z.number().int().min(1).max(30),
      empatia: z.number().int().min(1).max(30),
    })
    .optional(),
  level: z.number().int().min(1).max(20).optional(),
  xp: z.number().int().min(0).max(99).optional(),
  block: z.number().int().min(0).optional(),
  classId: z.string().uuid().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  xpReward: z.number().int().min(0).optional(),
});

export type CreateNpcInput = z.infer<typeof createNpcSchema>;
