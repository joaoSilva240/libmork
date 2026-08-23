// =============================================================================
// Libmork — Validators: Sessão do Escudo do Mestre (RF-041, RF-049, RF-050)
// =============================================================================
// Mutações do mestre sobre personagens/NPCs da campanha, rolagens e logs.
// =============================================================================

import { z } from "zod";

/**
 * Delta de HP/Mana/XP aplicado pelo mestre (RF-049).
 * Deltas negativos representam dano/custo; positivos, cura/ganho.
 */
export const updateActorSchema = z
  .object({
    hpDelta: z.number().int().optional(),
    manaDelta: z.number().int().optional(),
    hitPointsCurrent: z.number().int().min(0).optional(),
    manaPointsCurrent: z.number().int().min(0).optional(),
    xpDelta: z.number().int().optional(),
    level: z.number().int().min(1).optional(),
    conditionsAdd: z.array(z.string().uuid()).optional(),
    conditionsRemove: z.array(z.string().uuid()).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (data) =>
      data.hpDelta !== undefined ||
      data.manaDelta !== undefined ||
      data.hitPointsCurrent !== undefined ||
      data.manaPointsCurrent !== undefined ||
      data.xpDelta !== undefined ||
      data.level !== undefined ||
      data.conditionsAdd !== undefined ||
      data.conditionsRemove !== undefined,
    { message: "Nenhuma alteração fornecida" }
  );

/**
 * Requisição de rolagem pelo mestre (RF-041).
 */
export const createRollSchema = z.object({
  actorType: z.enum(["character", "npc"]),
  actorId: z.string().uuid(),
  actorName: z.string().min(1).max(100),
  rollExpression: z.string().min(1, "Informe a expressão de rolagem").max(200),
  reason: z.string().max(500).optional(),
});

/**
 * Preenchimento do resultado da rolagem (RF-041 — rolagem assistida).
 */
export const rollResultSchema = z.object({
  result: z.number().int(),
  description: z.string().max(500).optional(),
});
