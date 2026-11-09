import { z } from "zod";

export const CAMPAIGN_ASSET_CATEGORIES = [
  "handout",
  "map",
  "scene",
  "token",
  "illustration",
] as const;

export type CampaignAssetCategory = (typeof CAMPAIGN_ASSET_CATEGORIES)[number];

/**
 * Schema de criação de asset da campanha (Issue #61).
 */
export const createCampaignAssetSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  description: z.string().max(5000).optional().nullable(),
  imageUrl: z
    .string()
    .min(1, "URL da imagem é obrigatória")
    .max(500, "URL da imagem deve ter no máximo 500 caracteres"),
  category: z.enum(CAMPAIGN_ASSET_CATEGORIES).default("handout"),
  position: z.number().int().min(0).default(0),
});

export type CreateCampaignAssetInput = z.infer<typeof createCampaignAssetSchema>;

/**
 * Schema de atualização de asset da campanha (Issue #61).
 */
export const updateCampaignAssetSchema = z.object({
  name: z
    .string()
    .min(1, "Nome não pode ser vazio")
    .max(200, "Nome deve ter no máximo 200 caracteres")
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  imageUrl: z
    .string()
    .min(1, "URL da imagem não pode ser vazia")
    .max(500, "URL da imagem deve ter no máximo 500 caracteres")
    .optional(),
  category: z.enum(CAMPAIGN_ASSET_CATEGORIES).optional(),
  position: z.number().int().min(0).optional(),
});

export type UpdateCampaignAssetInput = z.infer<typeof updateCampaignAssetSchema>;

/**
 * Schema para asset inicial na criação conjunta com a campanha.
 */
export const initialAssetInputSchema = createCampaignAssetSchema;

export type InitialAssetInput = z.infer<typeof initialAssetInputSchema>;
