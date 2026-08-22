// =============================================================================
// Libmork — Autenticação: Hash de Senha (RNF-007)
// =============================================================================
// Armazena senhas exclusivamente como hash adaptativo (bcrypt).
// =============================================================================

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Gera o hash de uma senha usando bcrypt (RNF-007).
 * @param password Senha em texto plano
 * @returns Hash bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifica se uma senha corresponde ao hash armazenado.
 * @param password Senha em texto plano
 * @param hash Hash armazenado
 * @returns true se a senha corresponde ao hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
