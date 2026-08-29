// =============================================================================
// Libmork — Validators: Raças / Ancestralidades (Races & Ancestries)
// =============================================================================

import { z } from "zod";

export const raceTraitSchema = z.object({
  name: z.string().min(1, "Nome do traço é obrigatório"),
  description: z.string().max(5000).optional(),
});

export const raceHeritageSchema = z.object({
  name: z.string().min(1, "Nome da herança/linhagem é obrigatório"),
  description: z.string().max(5000).optional(),
});

export const raceAttributeBonusesSchema = z.object({
  forca: z.number().int().optional(),
  destreza: z.number().int().optional(),
  vigor: z.number().int().optional(),
  inteligencia: z.number().int().optional(),
  empatia: z.number().int().optional(),
});

/**
 * Schema de criação de raça / ancestralidade.
 */
export const createRaceSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  description: z.string().max(5000).optional().nullable(),
  speed: z.number().int().min(0, "Deslocamento não pode ser negativo").max(200).default(30),
  size: z.string().min(1).max(50).default("Médio"),
  hitPointsBonus: z.number().int().min(0, "Bônus de HP não pode ser negativo").default(0),
  attributeBonuses: raceAttributeBonusesSchema.default({}),
  languages: z.array(z.string()).default([]),
  traits: z.array(raceTraitSchema).default([]),
  heritages: z.array(raceHeritageSchema).default([]),
  imageUrl: z.string().max(500).optional().nullable(),
  sourceSystem: z.string().max(50).optional().nullable().default("custom"),
});

/**
 * Schema de atualização de raça / ancestralidade.
 */
export const updateRaceSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100).optional(),
  description: z.string().max(5000).optional().nullable(),
  speed: z.number().int().min(0).max(200).optional(),
  size: z.string().min(1).max(50).optional(),
  hitPointsBonus: z.number().int().min(0).optional(),
  attributeBonuses: raceAttributeBonusesSchema.optional(),
  languages: z.array(z.string()).optional(),
  traits: z.array(raceTraitSchema).optional(),
  heritages: z.array(raceHeritageSchema).optional(),
  imageUrl: z.string().max(500).optional().nullable(),
  sourceSystem: z.string().max(50).optional().nullable(),
});
