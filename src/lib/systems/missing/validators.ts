// =============================================================================
// Libmork — Sistema MISSING — Edição ZERO: Validadores Zod
// Horror Analógico e Investigação Minimalista
// =============================================================================

import { z } from "zod";

/**
 * Schema de entrada para equipamento inicial do Habitante.
 */
export const habitantEquipmentInputSchema = z.object({
  name: z.string().trim().min(1, "Nome do equipamento é obrigatório").max(100),
  notes: z.string().trim().max(500).optional(),
});

export type HabitantEquipmentInput = z.infer<typeof habitantEquipmentInputSchema>;

/**
 * Schema de criação de Habitante.
 * - Nome: 2 a 100 caracteres.
 * - Linhas do Registro: min 5, max 30 (limite de folha A4 pautada).
 * - Equipamentos: exatamente 3 equipamentos com nome e observações opcionais.
 */
export const createHabitantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  lines: z
    .array(z.string().trim().min(1, "Linha do registro não pode ser vazia"))
    .min(5, "O Registro de Habitante deve conter no mínimo 5 linhas")
    .max(30, "O Registro de Habitante não pode exceder o limite da folha A4 (máximo 30 linhas)"),
  equipments: z
    .array(habitantEquipmentInputSchema)
    .length(3, "O Habitante deve iniciar exatamente com 3 equipamentos"),
});

export type CreateHabitantInput = z.infer<typeof createHabitantSchema>;

/**
 * Schema para rasurar uma linha do Registro de Habitante.
 */
export const eraseLineSchema = z.object({
  lineId: z.string().min(1, "ID da linha é obrigatório"),
  reason: z.string().trim().max(500).optional(),
});

export type EraseLineInput = z.infer<typeof eraseLineSchema>;

/**
 * Schema para ameaça individual em cena.
 */
export const threatSchema = z.object({
  name: z.string().trim().min(1, "Nome da ameaça é obrigatório").max(100),
  description: z.string().trim().max(500).optional(),
  dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    errorMap: () => ({ message: "Nível de perigo deve ser 1, 2 ou 3" }),
  }),
});

export type ThreatInput = z.infer<typeof threatSchema>;

/**
 * Schema para conjunto de ameaças da cena com garantia de soma do perigo <= 3.
 */
export const sceneThreatsSchema = z
  .array(threatSchema)
  .refine((threats) => threats.reduce((sum, t) => sum + t.dangerLevel, 0) <= 3, {
    message: "A soma dos níveis de perigo das ameaças na cena não pode ultrapassar 3.",
  });

export type SceneThreatsInput = z.infer<typeof sceneThreatsSchema>;

/**
 * Schema de criação de pista de investigação.
 */
export const createClueSchema = z.object({
  title: z.string().trim().min(1, "Título da pista é obrigatório").max(100),
  description: z.string().trim().min(1, "Descrição da pista é obrigatória"),
  isFalseClue: z.boolean().default(false),
  deliveredToHabitantId: z.string().nullable().optional(),
});

export type CreateClueInput = z.infer<typeof createClueSchema>;

/**
 * Schema de criação de conexão entre pistas na Teia de Investigação.
 */
export const createConnectionSchema = z.object({
  sourceClueId: z.string().min(1, "ID da pista de origem é obrigatório"),
  targetClueId: z.string().min(1, "ID da pista de destino é obrigatório"),
  type: z.enum(["cause", "origin", "perspective"], {
    errorMap: () => ({
      message: "Tipo de conexão inválido. Use cause, origin ou perspective.",
    }),
  }),
  explanation: z.string().trim().max(500).optional(),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

/**
 * Schema para declaração de Epifania.
 */
export const declareEpiphanySchema = z.object({
  chosenEffect: z.enum(["tear_false_clue", "answer_question", "deliver_new_clue"], {
    errorMap: () => ({ message: "Efeito de epifania inválido." }),
  }),
  notes: z.string().trim().max(500).optional(),
});

export type DeclareEpiphanyInput = z.infer<typeof declareEpiphanySchema>;

/**
 * Schema para entrega de pista a um habitante (ou devolução ao banco com null).
 */
export const deliverClueSchema = z.object({
  targetHabitantId: z.string().nullable().optional(),
});

export type DeliverClueInput = z.infer<typeof deliverClueSchema>;

/**
 * Schema para atualização de cena ativa e suas ameaças.
 */
export const updateSceneSchema = z.object({
  sceneTitle: z.string().trim().min(1).max(100).optional().default("Cena"),
  threats: sceneThreatsSchema,
});

export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;

/**
 * Schema para execução de rolagem de teste.
 */
export const testRollSchema = z.object({
  habitantId: z.string().min(1, "ID do habitante é obrigatório"),
  type: z.enum(["common", "probable", "improbable"], {
    errorMap: () => ({ message: "Tipo de teste inválido (common, probable ou improbable)" }),
  }),
  supportGains: z.number().int().min(0).optional().default(0),
  forced: z.boolean().optional().default(false),
  equipmentId: z.string().optional(),
  forcedDie: z.number().int().min(1).max(6).optional(),
  dice: z.array(z.number().int().min(1).max(6)).optional(),
});

export type TestRollInput = z.infer<typeof testRollSchema>;

/**
 * Schema para atualização de dados do Habitante (PATCH).
 */
export const updateHabitantSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(100).optional(),
  status: z.enum(["active", "missing"]).optional(),
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        index: z.number(),
        text: z.string().trim().min(1),
        isErased: z.boolean(),
        erasedAt: z.string().optional(),
        erasedReason: z.string().optional(),
      })
    )
    .min(5)
    .max(30)
    .optional(),
  equipments: z
    .array(
      z.object({
        id: z.string().min(1),
        slot: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        name: z.string().trim().min(1).max(100),
        notes: z.string().trim().max(500).optional(),
        status: z.enum(["active", "lost"]),
        lostReason: z.string().trim().max(500).optional(),
      })
    )
    .length(3)
    .optional(),
});

export type UpdateHabitantInput = z.infer<typeof updateHabitantSchema>;
