import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditMasterProfileModal from "../EditMasterProfileModal";

describe("EditMasterProfileModal Component", () => {
  const mockProfile = {
    masterName: "Gandalf Antigo",
    masterAvatar: "https://example.com/old-avatar.jpg",
    masterBio: "Bio antiga",
    masterBannerUrl: "https://example.com/old-banner.jpg",
  };

  it("renderiza campos preenchidos com os dados atuais", () => {
    render(
      <EditMasterProfileModal
        profile={mockProfile}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Gandalf Antigo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/old-avatar.jpg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/old-banner.jpg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bio antiga")).toBeInTheDocument();
  });

  it("permite atualizar campos e submeter com sucesso", async () => {
    const onSavedMock = vi.fn();
    const onCloseMock = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        profile: {
          masterName: "Gandalf, o Branco",
          masterAvatar: "https://example.com/new-avatar.jpg",
          masterBio: "Retornei no ápice da maré.",
          masterBannerUrl: "https://example.com/new-banner.jpg",
        },
      }),
    });

    render(
      <EditMasterProfileModal
        profile={mockProfile}
        onClose={onCloseMock}
        onSaved={onSavedMock}
      />
    );

    // Altera o nome
    const nameInput = screen.getByDisplayValue("Gandalf Antigo");
    fireEvent.change(nameInput, { target: { value: "Gandalf, o Branco" } });

    // Clica em Salvar
    const saveBtn = screen.getByRole("button", { name: /salvar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/community/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterName: "Gandalf, o Branco",
          masterAvatar: "https://example.com/old-avatar.jpg",
          masterBio: "Bio antiga",
          masterBannerUrl: "https://example.com/old-banner.jpg",
        }),
      });
    });

    await waitFor(() => {
      expect(onSavedMock).toHaveBeenCalledWith({
        masterName: "Gandalf, o Branco",
        masterAvatar: "https://example.com/new-avatar.jpg",
        masterBio: "Retornei no ápice da maré.",
        masterBannerUrl: "https://example.com/new-banner.jpg",
      });
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  it("exibe mensagem de erro quando a API falha", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "URL do avatar inválida",
      }),
    });

    render(
      <EditMasterProfileModal
        profile={mockProfile}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const saveBtn = screen.getByRole("button", { name: /salvar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("URL do avatar inválida")).toBeInTheDocument();
    });
  });

  it("fecha o modal ao clicar em Cancelar", () => {
    const onCloseMock = vi.fn();

    render(
      <EditMasterProfileModal
        profile={mockProfile}
        onClose={onCloseMock}
        onSaved={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelBtn);

    expect(onCloseMock).toHaveBeenCalled();
  });
});
