import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CampaignForm } from "../CampaignForm";
import { CampaignList } from "../CampaignList";
import { CampaignDetail } from "../CampaignDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({
    id: "camp-1",
  }),
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false,
    presenceList: [],
    joinCampaign: vi.fn(),
    leaveCampaign: vi.fn(),
    updateActorStatus: vi.fn(),
    rollDice: vi.fn(),
    updateCombatState: vi.fn(),
    requestInitiativeRoll: vi.fn(),
    requestInitiativeRollDelayed: vi.fn(),
    requestDefenseReaction: vi.fn(),
    respondDefenseReaction: vi.fn(),
    requestDuelInvite: vi.fn(),
    respondDuelInvite: vi.fn(),
    updateDuelState: vi.fn(),
    finishDuel: vi.fn(),
    subscribeActorStatus: vi.fn(() => () => {}),
    subscribeDiceRoll: vi.fn(() => () => {}),
    subscribeCombatState: vi.fn(() => () => {}),
    subscribeInitiativeRequest: vi.fn(() => () => {}),
    subscribeDefenseRequest: vi.fn(() => () => {}),
    subscribeDefenseResponse: vi.fn(() => () => {}),
    subscribeDuelInvite: vi.fn(() => () => {}),
    subscribeDuelResponse: vi.fn(() => () => {}),
    subscribeDuelState: vi.fn(() => () => {}),
    subscribeDuelFinish: vi.fn(() => () => {}),
    broadcastCampaignLog: vi.fn(),
    broadcastCampaignLogUpdate: vi.fn(),
    subscribeCampaignLogCreated: vi.fn(() => () => {}),
    subscribeCampaignLogUpdated: vi.fn(() => () => {}),
    notifyCharacterInventoryChange: vi.fn(),
    subscribeCharacterInventoryChange: vi.fn(() => () => {}),
    notifyCampaignInviteCreated: vi.fn(),
    notifyCampaignInviteRevoked: vi.fn(),
    subscribeCampaignInviteCreated: vi.fn(() => () => {}),
    subscribeCampaignInviteRevoked: vi.fn(() => () => {}),
    emitAudioTrackAdd: vi.fn(),
    emitAudioTrackPlay: vi.fn(),
    emitAudioTrackPause: vi.fn(),
    emitAudioTrackLoop: vi.fn(),
    emitAudioTrackRemove: vi.fn(),
    subscribeAudioTrackAdd: vi.fn(() => () => {}),
    subscribeAudioTrackPlay: vi.fn(() => () => {}),
    subscribeAudioTrackPause: vi.fn(() => () => {}),
    subscribeAudioTrackLoop: vi.fn(() => () => {}),
    subscribeAudioTrackRemove: vi.fn(() => () => {}),
    subscribeAudioTrackState: vi.fn(() => () => {}),
  }),
}));

vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: () => <div data-testid="campaign-invites" />,
}));
vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: () => <div data-testid="master-roster" />,
}));
vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="session-log" />,
}));

describe("CampaignRulesEngine UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CampaignForm", () => {
    it("exibe o card de MISSING — Edição ZERO e oculta PvP e Sombra quando selecionado", () => {
      render(<CampaignForm />);

      // Verifica presença do card de MISSING
      expect(screen.getByText("MISSING — Edição ZERO")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Horror analógico com dados d6, registro pautado e ameaças de cena.",
        ),
      ).toBeInTheDocument();

      // Inicialmente, com d20_mod, PvP e Modificador de Sombra estão visíveis
      expect(screen.getByText(/Combate entre Jogadores \(PvP\)/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Modificador de Dificuldade por Pontos de Sombra/i),
      ).toBeInTheDocument();

      // Clica no card de MISSING — Edição ZERO
      fireEvent.click(screen.getByText("MISSING — Edição ZERO"));

      // Agora PvP e Sombra devem ser ocultados
      expect(
        screen.queryByText(/Combate entre Jogadores \(PvP\)/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Modificador de Dificuldade por Pontos de Sombra/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("CampaignList", () => {
    it("renderiza o badge 'MISSING — Edição ZERO' quando rulesEngine === 'missing_zero'", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "camp-1",
              name: "Campanha Horror 0",
              rulesEngine: "missing_zero",
              pvpEnabled: false,
              difficultyModifierShadowPoints: 0,
            },
          ],
        }),
      } as any);

      render(<CampaignList />);

      await waitFor(() => {
        expect(screen.getByText("Campanha Horror 0")).toBeInTheDocument();
        expect(screen.getByText("MISSING — Edição ZERO")).toBeInTheDocument();
      });
    });
  });

  describe("CampaignDetail", () => {
    it("renderiza o badge 'MISSING — Edição ZERO' quando rulesEngine === 'missing_zero'", async () => {
      const mockCampaign = {
        id: "camp-1",
        masterId: "user-1",
        name: "Mistério em Carlton",
        description: "Campanha de horror",
        rulesEngine: "missing_zero" as const,
        pvpEnabled: false,
        difficultyModifierShadowPoints: 0,
        initialNpcIds: [],
        initialWorldIds: [],
        createdAt: new Date().toISOString(),
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/worlds")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockCampaign }),
        });
      });

      render(<CampaignDetail />);

      await waitFor(() => {
        expect(screen.getByText("Mistério em Carlton")).toBeInTheDocument();
        expect(screen.getByText("MISSING — Edição ZERO")).toBeInTheDocument();
      });
    });
  });
});
