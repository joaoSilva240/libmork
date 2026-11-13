// =============================================================================
// Libmork — Validators: Campanhas e Mundos
// =============================================================================

import { z } from "zod";
import { RULES_ENGINES } from "@/lib/utils/constants";
import { initialAssetInputSchema } from "./campaign-asset";

/**
 * Schema de criação de campanha (RF-012, RF-019, RF-053).
 */
export const createCampaignSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(200),
  description: z.string().max(5000).optional().nullable(),
  rulesEngine: z.enum(RULES_ENGINES).default("d20_mod"),
  pvpEnabled: z.boolean().default(false),
  difficultyModifierShadowPoints: z.number().int().min(0).default(0),
  coverImageUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  worldMapUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  theme: z.string().max(50).optional().default("default-dark"),
  dice3dPlayersEnabled: z.boolean().optional().default(true),
  dice3dMasterEnabled: z.boolean().optional().default(true),
  initialNpcIds: z.array(z.string().uuid()).optional().default([]),
  initialWorldIds: z.array(z.string().uuid()).optional().default([]),
  initialAssets: z.array(initialAssetInputSchema).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * Schema de atualização de campanha (RF-012).
 */
export const updateCampaignSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  rulesEngine: z.enum(RULES_ENGINES).optional(),
  pvpEnabled: z.boolean().optional(),
  difficultyModifierShadowPoints: z.number().int().min(0).optional(),
  coverImageUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  worldMapUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  theme: z.string().max(50).optional(),
  dice3dPlayersEnabled: z.boolean().optional(),
  dice3dMasterEnabled: z.boolean().optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

/**
 * Schema de criação de mundo (RF-013).
 */
export const createWorldSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(200),
  description: z.string().max(5000).optional().nullable(),
  coverUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  mapUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
});

export type CreateWorldInput = z.infer<typeof createWorldSchema>;

/**
 * Schema de atualização de mundo (RF-013).
 */
export const updateWorldSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  coverUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
  mapUrl: z.string().url().or(z.string().startsWith("/")).optional().nullable(),
});

export type UpdateWorldInput = z.infer<typeof updateWorldSchema>;
