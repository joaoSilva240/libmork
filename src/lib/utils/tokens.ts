// =============================================================================
// Libmork — Utilitários de Tokens (RNF-003)
// =============================================================================
// Tokens de alta entropia (>= 128 bits aleatórios) e não enumeráveis.
// =============================================================================

import { randomBytes } from "crypto";

/**
 * Gera um token hexadecimal de alta entropia.
 * @param bytes Número de bytes aleatórios (padrão: 32 = 256 bits)
 */
export function generateToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Gera um token URL-safe em base64.
 * @param bytes Número de bytes aleatórios (padrão: 32 = 256 bits)
 */
export function generateUrlSafeToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("base64url");
}
