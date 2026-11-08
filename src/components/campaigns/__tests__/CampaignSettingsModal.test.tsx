import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignSettingsModal } from "../CampaignSettingsModal";
import type { Campaign } from "@/types";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    broadcastCampaignDice3DSettings: vi.fn(),
    setCampaignDice3DSettings: vi.fn(),
  }),
}));

describe("CampaignSettingsModal Component", () => {
  const mockCampaign: Campaign = {
    id: "camp-123",
    name: "A Maldição de Strahd",
    description: "Aventura gótica em Barovia",
    rulesEngine: "d20_mod",
    pvpEnabled: false,
    difficultyModifierShadowPoints: 2,
    coverImageUrl: "https://example.com/cover.jpg",
    worldMapUrl: null,
    theme: "crimson-dark",
    masterId: "master-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders with current campaign values", () => {
    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText("Configurações da Campanha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A Maldição de Strahd")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Aventura gótica em Barovia")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/cover.jpg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Campanha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Alterações" })).toBeInTheDocument();
  });

  it("saves updated campaign fields via PATCH /api/campaigns/:id", async () => {
    const handleSaved = vi.fn();
    const handleClose = vi.fn();

    const updatedCampaign = {
      ...mockCampaign,
      name: "Strahd Redux",
      pvpEnabled: true,
      difficultyModifierShadowPoints: 4,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: updatedCampaign }),
    } as Response);

    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={handleClose}
        onSaved={handleSaved}
        onDelete={vi.fn()}
      />
    );

    const nameInput = screen.getByDisplayValue("A Maldição de Strahd");
    fireEvent.change(nameInput, { target: { value: "Strahd Redux" } });

    const pvpCheckbox = screen.getByRole("checkbox", { name: /Combate entre Jogadores/i });
    fireEvent.click(pvpCheckbox);

    const submitBtn = screen.getByRole("button", { name: "Salvar Alterações" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/camp-123",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"name":"Strahd Redux"'),
        })
      );
      expect(handleSaved).toHaveBeenCalledWith(updatedCampaign);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("shows confirmation and calls onDelete when confirmed in danger zone", async () => {
    const handleDelete = vi.fn();

    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDelete={handleDelete}
      />
    );

    // Clica no primeiro botão de exclusão
    const deleteBtn = screen.getByRole("button", { name: "Excluir Campanha" });
    fireEvent.click(deleteBtn);

    // Diálogo de confirmação deve aparecer
    expect(
      screen.getByText(/Tem certeza absoluta que deseja excluir a campanha "A Maldição de Strahd"\?/i)
    ).toBeInTheDocument();

    // Confirma a exclusão
    const confirmBtn = screen.getByRole("button", { name: "Sim, Excluir Definitivamente" });
    fireEvent.click(confirmBtn);

    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
