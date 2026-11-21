// =============================================================================
// Libmork — PlayerDashboard: sobreviventes vinculados em campanha Fallout
// =============================================================================
// Regressão: o vínculo do sobrevivente é fallout_characters.campaign_id, e a
// listagem do jogador só mostrava personagens da junção d20.
// =============================================================================

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";

const CAMPAIGN_ID = "660e8400-e29b-41d4-a716-446655440001";
const SURVIVOR_ID = "770e8400-e29b-41d4-a716-446655440002";

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => <div>{character.name}</div>,
}));

vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => null }));

vi.mock("@/components/audio/JukeboxAudioBridge", () => ({ JukeboxAudioBridge: () => null }));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: false,
    presenceList: [],
    joinCampaign: vi.fn(),
    leaveCampaign: vi.fn(),
    sendSessionApply: vi.fn(),
    subscribeSessionPublished: vi.fn(() => vi.fn()),
    setCampaignDice3DSettings: vi.fn(),
  }),
}));

const survivorSheet = {
  id: SURVIVOR_ID,
  campaignId: CAMPAIGN_ID,
  ownerId: "user-1",
  name: "Walter",
  origin: "vault_dweller",
  level: 3,
  xp: 1200,
  caps: 40,
  hpCurrent: 22,
  hpMax: 30,
  radiation: 0,
  luckPointsCurrent: 5,
  defense: 12,
  initiative: 8,
  meleeDamageBonus: 0,
  carryWeightMax: 200,
  attributes: {},
  skills: {},
  tagSkills: [],
  bodyParts: {},
  items: [],
  perks: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const falloutCampaign = {
  id: CAMPAIGN_ID,
  name: "Wasteland",
  description: null,
  rulesEngine: "fallout_2d20",
  pvpEnabled: false,
  coverImageUrl: null,
  worldMapUrl: null,
  theme: null,
  dice3dPlayersEnabled: true,
  dice3dMasterEnabled: true,
  master: { id: "user-9", displayName: "Gina", email: "gina@example.com" },
  characters: [
    {
      id: SURVIVOR_ID,
      name: "Walter",
      imageUrl: null,
      level: 3,
      hitPointsCurrent: 22,
      hitPointsMax: 30,
      manaPointsCurrent: 0,
      manaPointsMax: 0,
    },
  ],
  roster: [{ id: SURVIVOR_ID, name: "Walter", imageUrl: null, isMine: true }],
};

function stubFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    const data =
      url === "/api/player/campaigns"
        ? [falloutCampaign]
        : url === "/api/systems/fallout/characters"
          ? [survivorSheet]
          : [];

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data }),
    } as Response);
  });
}

describe("PlayerDashboard — sobreviventes na campanha Fallout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubFetch();
  });

  it("lista o sobrevivente vinculado e abre o Pip-Boy em vez da ficha d20", async () => {
    render(<PlayerDashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Campanhas" }));

    fireEvent.click(
      await screen.findByRole("button", { name: /Ver detalhes da campanha Wasteland/i }),
    );

    expect(await screen.findByText("Meus Sobreviventes nesta campanha")).toBeInTheDocument();
    expect(screen.getByText("Walter")).toBeInTheDocument();
    expect(screen.getByText("HP 22/30")).toBeInTheDocument();

    const pipBoy = screen.getByRole("button", { name: "Abrir Pip-Boy" });
    expect(pipBoy).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir Ficha" })).not.toBeInTheDocument();
  });
});
