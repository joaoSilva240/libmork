// =============================================================================
// Libmork — CampaignInvites: sobreviventes Fallout no roster do escudo
// =============================================================================
// O roster passa o sobrevivente com system=fallout_2d20: ele deve aparecer na
// lista "Personagens e NPCs" como exibição, sem virar peça arrastável da mesa.
// =============================================================================

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignInvites } from "../CampaignInvites";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    subscribeCampaignInviteCreated: vi.fn(() => vi.fn()),
    subscribeCampaignInviteRevoked: vi.fn(() => vi.fn()),
    notifyCampaignInviteCreated: vi.fn(),
    notifyCampaignInviteRevoked: vi.fn(),
  }),
}));

const CAMPAIGN_ID = "camp-fallout";
const ROSTER_URL = `/api/campaigns/${CAMPAIGN_ID}/roster`;

describe("CampaignInvites — sobreviventes no roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === ROSTER_URL) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              players: [
                {
                  id: "survivor-1",
                  name: "Walter",
                  imageUrl: null,
                  level: 3,
                  xp: 1200,
                  hitPointsCurrent: 22,
                  hitPointsMax: 30,
                  manaPointsCurrent: 0,
                  manaPointsMax: 0,
                  conditions: [],
                  system: "fallout_2d20",
                  origin: "vault_dweller",
                },
              ],
              npcs: [],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    }) as unknown as typeof fetch;
  });

  it("mostra o sobrevivente com nível, HP e origem e bloqueia o arrasto para a mesa", async () => {
    render(<CampaignInvites campaignId={CAMPAIGN_ID} showCharactersNpcs={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Personagens e NPCs \(1\)/)).toBeInTheDocument();
    });

    expect(screen.getByText("Walter")).toBeInTheDocument();
    expect(screen.getByText(/Nível 3 · HP 22\/30 · vault dweller/)).toBeInTheDocument();
    expect(screen.getByText("Sobrevivente")).toBeInTheDocument();

    const card = screen.getByTitle(/mesa tática ainda não suporta o sistema 2d20/);
    expect(card.getAttribute("draggable")).toBe("false");
  });
});
