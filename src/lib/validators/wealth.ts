// =============================================================================
// Libmork — Validators: Gestão de Riquezas (Wealth)
// =============================================================================

import { z } from "zod";

export const transferWealthSchema = z.object({
  sourceCharacterId: z.string().uuid("ID do personagem de origem inválido"),
  targetCharacterId: z.string().uuid("ID do personagem de destino inválido"),
  coinType: z.enum(["bronze", "prata", "ouro", "platina", "diamante"]),
  amount: z.number().int().positive("A quantidade deve ser maior que zero"),
}).refine((data) => data.sourceCharacterId !== data.targetCharacterId, {
  message: "O personagem de origem e destino devem ser diferentes",
  path: ["targetCharacterId"],
});

export type TransferWealthInput = z.infer<typeof transferWealthSchema>;
