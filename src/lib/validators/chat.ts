// =============================================================================
// Libmork — Validators: Chat de Campanha e Enquetes (Issue #62)
// =============================================================================

import { z } from "zod";
import { contentTypeSchema } from "@/lib/validators/content";

export const pollOptionInputSchema = z
  .string()
  .trim()
  .min(1, "A opção não pode ficar vazia")
  .max(255, "A opção pode ter no máximo 255 caracteres");

export const createPollInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "A pergunta da enquete deve ter no mínimo 2 caracteres")
    .max(500, "A pergunta da enquete pode ter no máximo 500 caracteres"),
  options: z
    .array(pollOptionInputSchema)
    .min(2, "A enquete deve conter pelo menos 2 opções")
    .max(10, "A enquete pode conter no máximo 10 opções"),
  isMultipleChoice: z.boolean().default(false),
});

export const shareInputSchema = z
  .object({
    kind: z.enum(["library_item", "profile", "post", "campaign"]),
    id: z.string().uuid("ID inválido"),
    contentType: contentTypeSchema.optional(),
  })
  .refine((v) => v.kind !== "library_item" || Boolean(v.contentType), {
    message: "contentType é obrigatório para itens da biblioteca",
    path: ["contentType"],
  });

export const createChatMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "A mensagem não pode ficar vazia")
    .max(5000, "A mensagem pode ter no máximo 5000 caracteres"),
  type: z.enum(["text", "poll", "system", "share"]).default("text"),
  poll: createPollInputSchema.optional(),
  share: shareInputSchema.optional(),
});

export const votePollSchema = z.object({
  optionIds: z
    .array(z.string().uuid("ID de opção inválido"))
    .min(1, "Selecione pelo menos uma opção para votar"),
});

export const createDmSchema = z.object({
  userId: z.string().uuid("Usuário inválido"),
});

export const updateMemberPermissionsSchema = z
  .object({
    canRead: z.boolean().optional(),
    canWrite: z.boolean().optional(),
    canShare: z.boolean().optional(),
  })
  .refine((v) => v.canRead !== undefined || v.canWrite !== undefined || v.canShare !== undefined, {
    message: "Informe ao menos uma permissão",
  });

export const removeCampaignMemberSchema = z.object({
  userId: z.string().uuid("Usuário inválido"),
});

export type CreatePollInput = z.infer<typeof createPollInputSchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
export type VotePollInput = z.infer<typeof votePollSchema>;
export type ShareInput = z.infer<typeof shareInputSchema>;
export type CreateDmInput = z.infer<typeof createDmSchema>;
export type UpdateMemberPermissionsInput = z.infer<typeof updateMemberPermissionsSchema>;
export type RemoveCampaignMemberInput = z.infer<typeof removeCampaignMemberSchema>;
