// =============================================================================
// Libmork — Validators: Sessões Agendadas e Candidaturas (Issue #63)
// =============================================================================

import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const launchSessionSchema = z
  .object({
    campaignId: z.string().uuid("Campanha inválida"),
    description: z
      .string()
      .trim()
      .min(10, "A descrição deve ter no mínimo 10 caracteres")
      .max(2000, "A descrição pode ter no máximo 2000 caracteres"),
    proposedStart: z.string().datetime({ offset: true, message: "Data inicial inválida" }),
    proposedEnd: z.string().datetime({ offset: true, message: "Data final inválida" }),
    xpReward: z.number().int().min(0).max(100000).optional(),
    sessionType: z.enum(["one_shot", "continuing"]).optional(),
    maxSlots: z.number().int().min(1, "Mínimo de 1 vaga").max(20, "Máximo de 20 vagas").optional(),
  })
  .refine((v) => new Date(v.proposedEnd) > new Date(v.proposedStart), {
    message: "O fim do período deve ser depois do início",
    path: ["proposedEnd"],
  });

export const applySessionSchema = z
  .object({
    characterId: z.string().uuid().optional().nullable(),
    availableDays: z
      .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dia inválido (use yyyy-MM-dd)"))
      .min(1, "Selecione ao menos um dia disponível")
      .max(62),
    preferredStart: z.string().regex(HHMM, "Horário inválido").optional(),
    preferredEnd: z.string().regex(HHMM, "Horário inválido").optional(),
  })
  .refine((v) => Boolean(v.preferredStart) === Boolean(v.preferredEnd), {
    message: "Informe início e fim do horário preferido",
    path: ["preferredEnd"],
  })
  .refine((v) => !v.preferredStart || !v.preferredEnd || v.preferredEnd > v.preferredStart, {
    message: "O fim do horário deve ser depois do início",
    path: ["preferredEnd"],
  });

export const updateSessionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm"),
    scheduledAt: z.string().datetime({ offset: true, message: "Data final inválida" }),
    durationMinutes: z.number().int().min(30).max(1440).default(240),
  }),
  z.object({ action: z.literal("cancel") }),
]);

export const decideCandidateSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
});

export type LaunchSessionInput = z.infer<typeof launchSessionSchema>;
export type ApplySessionInput = z.infer<typeof applySessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type DecideCandidateInput = z.infer<typeof decideCandidateSchema>;
