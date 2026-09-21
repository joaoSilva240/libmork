import { z } from "zod";

export const LIBRARY_PROVIDERS = [
  "external",
  "gdrive",
  "smb",
  "kavita",
  "notion",
  "gitbook",
] as const;
export type LibraryProvider = (typeof LIBRARY_PROVIDERS)[number];

export const LIBRARY_CATEGORIES = [
  "livro-base",
  "suplemento",
  "errata",
  "aventura",
  "outro",
] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

/**
 * Validação de externalUrl:
 * Deve ser ou uma URL válida (http:// ou https://) ou um subcaminho relativo/SMB (ex: smb://... ou subpasta/livro.pdf).
 */
export const externalUrlSchema = z
  .string()
  .min(1, "URL ou caminho externo é obrigatório")
  .max(1000, "URL ou caminho externo excede o tamanho máximo")
  .refine(
    (val) => {
      const trimmed = val.trim();
      if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("smb://")
      ) {
        return true;
      }
      // Caminho relativo ou arquivo (ex: 'subpasta/livro.pdf', 'regras.pdf')
      // Rejeita caminhos maliciosos contendo traversal explícito
      if (trimmed.includes("..")) {
        return false;
      }
      return true;
    },
    {
      message:
        "externalUrl deve ser uma URL válida (http/https), smb:// ou caminho relativo válido",
    },
  );

/**
 * Schema de criação de LibraryDocument
 */
export const createLibraryDocumentSchema = z.object({
  title: z
    .string()
    .min(1, "Título é obrigatório")
    .max(255, "Título deve ter no máximo 255 caracteres"),
  description: z.string().optional().nullable(),
  coverUrl: z
    .string()
    .url("coverUrl deve ser uma URL válida")
    .or(z.string().startsWith("/"))
    .optional()
    .nullable(),
  externalUrl: externalUrlSchema,
  provider: z.enum(LIBRARY_PROVIDERS, {
    message: "Provedor inválido",
  }),
  category: z.enum(LIBRARY_CATEGORIES, {
    message: "Categoria inválida",
  }),
  tags: z.array(z.string()).optional().nullable(),
  isPublic: z.boolean().optional().default(true),
  campaignId: z
    .string()
    .uuid("campaignId deve ser um UUID válido")
    .optional()
    .nullable(),
});

export type CreateLibraryDocumentInput = z.infer<
  typeof createLibraryDocumentSchema
>;

/**
 * Schema de atualização de LibraryDocument
 */
export const updateLibraryDocumentSchema = createLibraryDocumentSchema.partial();

export type UpdateLibraryDocumentInput = z.infer<
  typeof updateLibraryDocumentSchema
>;
