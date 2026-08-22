// =============================================================================
// Libmork — Utilitários de Upload de Imagens (D-33, RF-007, RF-063)
// =============================================================================
// Armazenamento em volume local (UPLOAD_DIR). Validação de tipo e tamanho.
// =============================================================================

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const MAX_IMAGE_SIZE_MB = Number(process.env.MAX_IMAGE_SIZE_MB || 5);
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * Diretório raiz de uploads (volume local, D-33).
 */
export function getUploadsDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
}

/**
 * Valida e salva um arquivo de imagem, retornando o nome do arquivo gerado.
 * @param file Arquivo web (File) do form-data
 * @param subdir Subdiretório dentro do volume de uploads
 */
export async function saveImage(file: File, subdir: string): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error("Tipo de imagem inválido. Use JPG, PNG ou WEBP.");
  }

  if (file.size <= 0) {
    throw new Error("Arquivo de imagem vazio.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Imagem excede o limite de ${MAX_IMAGE_SIZE_MB}MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = MIME_EXTENSIONS[file.type];
  const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;

  const dir = path.join(getUploadsDir(), subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);

  return filename;
}
