// =============================================================================
// Libmork — Validators: Pins de NPC (RF-065)
// =============================================================================

import { z } from "zod";

export const PIN_TYPES = ["skill", "spell", "attack"] as const;
export type PinType = (typeof PIN_TYPES)[number];

/**
 * Schema de criação de pin (RF-065).
 */
export const createNpcPinSchema = z.object({
  pinType: z.enum(PIN_TYPES),
  contentId: z.string().uuid().optional().nullable(),
  label: z.string().min(1, "Nome do atalho é obrigatório").max(100),
  rollExpression: z.string().max(200).optional().nullable(),
  manaCost: z.number().int().min(0).optional().nullable(),
  circle: z.number().int().min(1).max(9).optional().nullable(),
});

export const updateNpcPinSchema = createNpcPinSchema.partial();
