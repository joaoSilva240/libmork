// =============================================================================
// Libmork — Utilitários de Tokens (RNF-003)
// =============================================================================
// Tokens de alta entropia (>= 128 bits aleatórios) e não enumeráveis.
// Usa Web Crypto API global (globalThis.crypto) para compatibilidade
// com Edge Runtime (middleware) e Node 18+.
// =============================================================================

function randomBytes(bytes: number): Uint8Array {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Gera um token hexadecimal de alta entropia.
 * @param bytes Número de bytes aleatórios (padrão: 32 = 256 bits)
 */
export function generateToken(bytes: number = 32): string {
  return bytesToHex(randomBytes(bytes));
}

/**
 * Gera um token URL-safe em base64.
 * @param bytes Número de bytes aleatórios (padrão: 32 = 256 bits)
 */
export function generateUrlSafeToken(bytes: number = 32): string {
  return bytesToBase64Url(randomBytes(bytes));
}
