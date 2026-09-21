import { describe, it, expect } from "vitest";
import {
  createLibraryDocumentSchema,
  updateLibraryDocumentSchema,
} from "../library-document";

describe("LibraryDocument Validators", () => {
  describe("createLibraryDocumentSchema", () => {
    it("valida criação com dados válidos completos", () => {
      const input = {
        title: "D&D 5e - Livro do Jogador",
        description: "Regras básicas de Dungeons & Dragons 5ª Edição",
        coverUrl: "https://example.com/cover.jpg",
        externalUrl: "https://example.com/player-handbook.pdf",
        provider: "external",
        category: "livro-base",
        tags: ["dnd", "5e", "regras"],
        isPublic: true,
        campaignId: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = createLibraryDocumentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("D&D 5e - Livro do Jogador");
        expect(result.data.provider).toBe("external");
      }
    });

    it("valida caminhos relativos e smb:// em externalUrl", () => {
      const validCases = [
        "smb://100.122.171.83/D&D/livro.pdf",
        "dnd5e/livros/suplemento.pdf",
        "manual_monstros.pdf",
        "http://intranet.local/manual.pdf",
        "https://cdn.site.com/docs/regras.pdf",
      ];

      for (const externalUrl of validCases) {
        const result = createLibraryDocumentSchema.safeParse({
          title: "Doc Teste",
          externalUrl,
          provider: "smb",
          category: "suplemento",
        });
        expect(result.success).toBe(true);
      }

      // Provedor kavita
      const kavitaResult = createLibraryDocumentSchema.safeParse({
        title: "Doc Kavita",
        externalUrl: "/api/library/kavita/proxy?url=http://100.122.171.83:5150/livro.pdf",
        provider: "kavita",
        category: "livro-base",
      });
      expect(kavitaResult.success).toBe(true);
    });

    it("rejeita path traversal em externalUrl", () => {
      const invalidCases = [
        "../secrets.txt",
        "subfolder/../../etc/passwd",
        "folder/../livro.pdf",
      ];

      for (const externalUrl of invalidCases) {
        const result = createLibraryDocumentSchema.safeParse({
          title: "Doc Teste",
          externalUrl,
          provider: "smb",
          category: "outro",
        });
        expect(result.success).toBe(false);
      }
    });

    it("rejeita título vazio e provedor/categoria inválidos", () => {
      const result = createLibraryDocumentSchema.safeParse({
        title: "",
        externalUrl: "https://example.com/doc.pdf",
        provider: "unsupported-provider",
        category: "invalid-cat",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path[0]);
        expect(fields).toContain("title");
        expect(fields).toContain("provider");
        expect(fields).toContain("category");
      }
    });
  });

  describe("updateLibraryDocumentSchema", () => {
    it("permite atualização parcial", () => {
      const result = updateLibraryDocumentSchema.safeParse({
        title: "Novo Título Atualizado",
      });
      expect(result.success).toBe(true);
    });

    it("rejeita campo inválido em atualização", () => {
      const result = updateLibraryDocumentSchema.safeParse({
        provider: "unknown",
      });
      expect(result.success).toBe(false);
    });
  });
});
