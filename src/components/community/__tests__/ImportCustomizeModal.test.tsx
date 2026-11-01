import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ImportCustomizeModal from "../ImportCustomizeModal";

describe("ImportCustomizeModal", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renderiza aviso amigável quando o contentType for campaign", () => {
    const onClose = vi.fn();
    render(
      <ImportCustomizeModal
        contentType="campaign"
        payload={{ name: "Minha Campanha" }}
        postId="camp-1"
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Importação não suportada/i)).toBeInTheDocument();
    expect(screen.getByText(/A importação de campanhas ainda não é suportada pelo sistema/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /Fechar/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("renderiza campos de edição específicos para spell e permite importar original", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "Conteúdo importado com sucesso", newEntityId: "spell-123" }),
    });

    render(
      <ImportCustomizeModal
        contentType="spell"
        payload={{
          name: "Míssil Mágico",
          description: "Dispara dardos de energia.",
          level: 1,
          school: "Evocação",
        }}
        postId="post-spell-1"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText(/Personalizar antes de importar/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Míssil Mágico")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dispara dardos de energia.")).toBeInTheDocument();

    const importOriginalBtn = screen.getByRole("button", { name: /Importar Original/i });
    fireEvent.click(importOriginalBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/community/posts/post-spell-1/clone",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        })
      );
    });
  });

  it("permite alterar campos e envia modifiedPayload ao clicar em 'Salvar e Importar'", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "Conteúdo adaptado importado com sucesso", newEntityId: "spell-mod-123" }),
    });

    render(
      <ImportCustomizeModal
        contentType="spell"
        payload={{
          name: "Míssil Mágico",
          description: "Dispara dardos de energia.",
          level: 1,
        }}
        postId="post-spell-1"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const nameInput = screen.getByDisplayValue("Míssil Mágico");
    fireEvent.change(nameInput, { target: { value: "Míssil Arcano Supremo" } });

    const saveAndImportBtn = screen.getByRole("button", { name: /Salvar e Importar/i });
    fireEvent.click(saveAndImportBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/community/posts/post-spell-1/clone",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Míssil Arcano Supremo"),
        })
      );
    });
  });
});
