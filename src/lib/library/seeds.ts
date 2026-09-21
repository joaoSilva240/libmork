import { LibraryDocument } from "@/types";

/**
 * Documentos oficiais padrão fornecidos com o sistema Libmork.
 */
export const OFFICIAL_LIBRARY_DOCUMENTS: LibraryDocument[] = [
  {
    id: "official-libmork-core-rules",
    title: "Libmork — Livro de Regras Base & Guia do Jogador",
    description: "Manual central de regras do sistema Libmork, ficha de personagem e mecânicas de d20.",
    coverUrl: null,
    externalUrl: "https://libmork.example.com/docs/core-rules.pdf",
    provider: "external",
    category: "livro-base",
    tags: ["oficial", "regras", "d20", "sistema"],
    isOfficial: true,
    isPublic: true,
    campaignId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "official-libmork-master-guide",
    title: "Libmork — Guia do Mestre & Criação de Cenários",
    description: "Diretrizes para mestres, criação de encontros, mundos e customização de regras.",
    coverUrl: null,
    externalUrl: "https://libmork.example.com/docs/master-guide.pdf",
    provider: "external",
    category: "suplemento",
    tags: ["oficial", "mestre", "campanhas"],
    isOfficial: true,
    isPublic: true,
    campaignId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];
