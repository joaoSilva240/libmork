// =============================================================================
// Libmork — Validators: Pins de NPC (RF-065)
// =============================================================================

import { z } from "zod";
import { NPC_DAMAGE_TYPES } from "@/lib/engine/npc-attack";

export const PIN_TYPES = ["skill", "spell", "attack"] as const;
export type PinType = (typeof PIN_TYPES)[number];

/** Expressão de rolagem aceita pelo motor (X d Y [± mod] ou com modificador). */
const diceExpression = z
  .string()
  .max(200)
  .regex(
    /^\s*[+-]?\s*\d*d\s*\d+\s*(?:[+-]\s*\d+)?\s*$/i,
    "Expressão inválida. Use o formato XdY±Z (ex.: 1d20+9 ou 3d6+5).",
  );

/**
 * Schema de criação de pin (RF-065). Campos de dano configurado: issue #90.
 */
export const createNpcPinSchema = z.object({
  pinType: z.enum(PIN_TYPES),
  contentId: z.string().uuid().optional().nullable(),
  label: z.string().min(1, "Nome do atalho é obrigatório").max(100),
  rollExpression: z.string().max(200).optional().nullable(),
  attackExpression: diceExpression.optional().nullable(),
  damageExpression: diceExpression.optional().nullable(),
  damageType: z.enum(NPC_DAMAGE_TYPES).optional().nullable(),
  criticalRange: z
    .number()
    .int()
    .min(1, "Faixa de crítico deve ser entre 1 e 20")
    .max(20, "Faixa de crítico deve ser entre 1 e 20")
    .optional()
    .nullable(),
  manaCost: z.number().int().min(0).optional().nullable(),
  circle: z.number().int().min(1).max(9).optional().nullable(),
});

export const updateNpcPinSchema = createNpcPinSchema.partial();
