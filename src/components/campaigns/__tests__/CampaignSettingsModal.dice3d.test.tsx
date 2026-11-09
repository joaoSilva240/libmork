import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignSettingsModal } from "../CampaignSettingsModal";
import type { Campaign } from "@/types";

const mockBroadcast = vi.fn();
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    broadcastCampaignDice3DSettings: mockBroadcast,
    setCampaignDice3DSettings: vi.fn(),
  }),
}));

describe("CampaignSettingsModal 3D Dice Toggles (Issue #74)", () => {
  const mockCampaign: Campaign = {
    id: "camp-123",
    name: "Maldição de Strahd",
    masterId: "user-1",
    description: "Aventura gótica",
    rulesEngine: "d20_mod",
    pvpEnabled: false,
    difficultyModifierShadowPoints: 0,
    coverImageUrl: null,
    worldMapUrl: null,
    dice3dPlayersEnabled: true,
    dice3dMasterEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both 3D dice toggles with exact labels from issue #74", () => {
    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Dados 3d nas rolagens dos jogadores")).toBeInTheDocument();
    expect(screen.getByText("Dados 3d nas rolagens do mestre")).toBeInTheDocument();

    const playersToggle = screen.getByTestId("toggle-dice3d-players") as HTMLInputElement;
    const masterToggle = screen.getByTestId("toggle-dice3d-master") as HTMLInputElement;

    expect(playersToggle.checked).toBe(true);
    expect(masterToggle.checked).toBe(true);
  });

  it("saves toggled values to PATCH and broadcasts via socket", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockCampaign,
          dice3dPlayersEnabled: false,
          dice3dMasterEnabled: true,
        },
      }),
    } as any);

    const handleSaved = vi.fn();

    render(
      <CampaignSettingsModal
        campaign={mockCampaign}
        onClose={vi.fn()}
        onSaved={handleSaved}
        onDelete={vi.fn()}
      />,
    );

    const playersToggle = screen.getByTestId("toggle-dice3d-players");
    fireEvent.click(playersToggle);

    const saveButton = screen.getByRole("button", { name: /Salvar Alterações/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/camp-123",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"dice3dPlayersEnabled":false'),
        }),
      );
    });

    expect(mockBroadcast).toHaveBeenCalledWith({
      campaignId: "camp-123",
      dice3dPlayersEnabled: false,
      dice3dMasterEnabled: true,
    });
  });
});
