import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSafeLibraryPath } from "../storage";
import path from "path";
import os from "os";

describe("Library Storage Path Resolver", () => {
  const originalEnv = process.env.LIBRARY_SMB_PATH;
  const mockBaseDir = path.resolve(os.tmpdir(), "libmork-test-smb");

  beforeEach(() => {
    process.env.LIBRARY_SMB_PATH = mockBaseDir;
  });

  afterEach(() => {
    process.env.LIBRARY_SMB_PATH = originalEnv;
  });

  it("retorna erro quando LIBRARY_SMB_PATH não está definido", () => {
    delete process.env.LIBRARY_SMB_PATH;
    const result = resolveSafeLibraryPath("rules.pdf");
    expect(result.success).toBe(false);
    expect(result.error).toContain("LIBRARY_SMB_PATH não está configurado");
  });

  it("resolve caminho seguro para arquivo na raiz", () => {
    const result = resolveSafeLibraryPath("regras.pdf");
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe(path.join(mockBaseDir, "regras.pdf"));
  });

  it("resolve caminho seguro para subpastas", () => {
    const result = resolveSafeLibraryPath("dnd5e/livros/jogador.pdf");
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe(
      path.join(mockBaseDir, "dnd5e", "livros", "jogador.pdf")
    );
  });

  it("remove prefixo smb:// corretamente", () => {
    const result = resolveSafeLibraryPath("smb://compartilhamento/livro.pdf");
    expect(result.success).toBe(true);
    expect(result.resolvedPath).toBe(
      path.join(mockBaseDir, "compartilhamento", "livro.pdf")
    );
  });

  it("bloqueia tentativas com .. (Path Traversal)", () => {
    const invalidInputs = [
      "../secreto.pdf",
      "dnd/../../etc/passwd",
      "pasta/..",
      "..\\windows\\system32",
    ];

    for (const input of invalidInputs) {
      const result = resolveSafeLibraryPath(input);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }
  });

  it("bloqueia caracteres nulos", () => {
    const result = resolveSafeLibraryPath("livro.pdf\0.png");
    expect(result.success).toBe(false);
    expect(result.error).toContain("inválido");
  });
});
