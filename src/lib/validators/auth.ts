// =============================================================================
// Libmork — Validators: Autenticação
// =============================================================================

import { z } from "zod";

/**
 * Schema de registro de usuário (RF-001).
 */
export const registerSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  displayName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Schema de login (RF-002).
 */
export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export type LoginInput = z.infer<typeof loginSchema>;
