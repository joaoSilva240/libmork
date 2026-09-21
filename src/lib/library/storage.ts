import path from "path";
import fs from "fs";

/**
 * Obtém a pasta raiz configurada para documentos SMB/rede.
 */
export function getLibrarySmbPath(): string | null {
  const envPath = process.env.LIBRARY_SMB_PATH?.trim();
  if (!envPath) return null;
  return envPath;
}

/**
 * Resolve e valida de forma segura um caminho de arquivo dentro de LIBRARY_SMB_PATH.
 * Proteção contra Path Traversal:
 * - Rejeita caracteres nulos (%00, \0)
 * - Remove prefixos de protocolo (ex: smb://)
 * - Rejeita referências de caminho relativo que saiam da pasta raiz
 * - Garante que o caminho normalizado resolva dentro do root configurado
 */
export function resolveSafeLibraryPath(filePathInput: string): {
  success: boolean;
  resolvedPath?: string;
  error?: string;
} {
  const rootPath = getLibrarySmbPath();
  if (!rootPath) {
    return {
      success: false,
      error: "LIBRARY_SMB_PATH não está configurado no servidor",
    };
  }

  if (!filePathInput || typeof filePathInput !== "string") {
    return { success: false, error: "Caminho do arquivo não fornecido" };
  }

  // Sanitização de caracteres nulos
  if (filePathInput.includes("\0") || filePathInput.includes("%00")) {
    return { success: false, error: "Caminho inválido detectado" };
  }

  // Remove smb:// ou smb:\\ se houver
  let cleanInput = filePathInput.replace(/^smb:\/+/i, "").replace(/^smb:\\+/i, "");

  // Normaliza barras para o padrão do SO
  cleanInput = cleanInput.replace(/\\/g, "/");

  // Rejeita tentativas de sair do diretório ("..")
  const segments = cleanInput.split("/").filter(Boolean);
  if (segments.some((seg) => seg === "..")) {
    return { success: false, error: "Tentativa de Path Traversal bloqueada" };
  }

  // Normaliza root e target path
  const normalizedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(rootPath, ...segments);

  // Verificação estrita de limite de diretório
  // Deve iniciar com o diretório raiz + separador ou ser exatamente igual
  const relative = path.relative(normalizedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return { success: false, error: "Acesso negado: fora do diretório permitido" };
  }

  return {
    success: true,
    resolvedPath: resolvedTarget,
  };
}
