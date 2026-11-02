// =============================================================================
// Libmork — PlayerDashboard: Navbar Redesign, Fixed Header & Floating Action Button
// =============================================================================

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => (
    <div data-testid="character-card">{character.name}</div>
  ),
}));

vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button data-testid="logout-button">Sair</button>,
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

vi.mock("@/components/audio/JukeboxAudioBridge", () => ({
  JukeboxAudioBridge: () => null,
}));

describe("PlayerDashboard - Navbar Redesign & Floating Action Button", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupDefaultMocks = (authResponse?: { ok: boolean; status?: number; data?: any }) => {
    globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/auth/me") {
        if (!authResponse || authResponse.ok) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve(
                authResponse?.data ?? {
                  success: true,
                  data: {
                    id: "u-1",
                    email: "artemis@libmork.com",
                    displayName: "Artemis Shadowalker",
                    role: "player",
                  },
                }
              ),
          });
        }
        return Promise.resolve({
          ok: false,
          status: authResponse.status || 500,
          json: () => Promise.resolve({ error: "Erro interno" }),
        });
      }

      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "char-1",
                  name: "Artemis",
                  level: 3,
                  hitPointsCurrent: 20,
                  hitPointsMax: 20,
                },
              ],
            }),
        });
      }

      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }

      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }

      if (url === "/api/player/wealth") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: null }),
        });
      }

      return Promise.resolve({ ok: false });
    });
  };

  it("busca o nome do jogador via /api/auth/me com credentials: 'include' e renderiza displayName na navbar", async () => {
    setupDefaultMocks();

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Artemis Shadowalker");
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/me", {
      credentials: "include",
    });
    expect(screen.queryByText("Libmork — Jogador")).not.toBeInTheDocument();
  });

  it("utiliza fallback seguro 'Jogador' quando a chamada a /api/auth/me falhar", async () => {
    setupDefaultMocks({ ok: false, status: 500 });

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jogador");
    });
  });

  it("utiliza fallback seguro 'Jogador' quando ocorrer erro de rede", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jogador");
    });
  });

  it("renderiza a navbar fixa no topo, full-width, sem margens laterais/superiores e com safe area", async () => {
    setupDefaultMocks();

    const { container } = render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Artemis Shadowalker");
    });

    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    // Classes de fixação e largura total
    expect(header?.className).toContain("fixed");
    expect(header?.className).toContain("inset-x-0");
    expect(header?.className).toContain("top-0");
    // Sem margens/bordas externas no topo ou laterais
    expect(header?.className).toContain("border-x-0");
    expect(header?.className).toContain("border-t-0");
    // Respeito à safe area superior
    expect(header?.className).toContain("safe-area-inset-top");
  });

  it("possui espaçamento superior no container de conteúdo para não ser ocultado pela navbar", async () => {
    setupDefaultMocks();

    const { container } = render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Artemis Shadowalker");
    });

    // O container principal deve ter padding top suficiente para compensar a navbar fixa
    const outerContainer = container.firstElementChild;
    expect(outerContainer?.className).toMatch(/pt-\[calc\([^\]]+safe-area-inset-top/);
  });

  it("renderiza o CTA flutuante fixo 'Novo Personagem' com acessibilidade, safe area e link para /player/characters/new", async () => {
    setupDefaultMocks();

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Artemis")).toBeInTheDocument();
    });

    // Não deve existir botão inline "+ Novo Personagem" dentro do cabeçalho da seção
    const sectionHeading = screen.getByRole("heading", { level: 2, name: "Meus Personagens" });
    const sectionContainer = sectionHeading.parentElement;
    expect(sectionContainer?.querySelector("a[href='/player/characters/new']")).toBeNull();

    // Deve existir o botão flutuante acessível
    const floatingButton = screen.getByRole("link", { name: /novo personagem/i });
    expect(floatingButton).toBeInTheDocument();
    expect(floatingButton).toHaveAttribute("href", "/player/characters/new");

    // Validações de estilo do botão flutuante: fixo, posicionado na parte inferior direita, safe area, z-index
    expect(floatingButton.className).toContain("fixed");
    expect(floatingButton.className).toContain("right-4");
    expect(floatingButton.className).toContain("z-30");
    expect(floatingButton.className).toContain("safe-area-inset-bottom");
  });
});
