import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

describe("PlayerDashboard - Campaign Details Tabs (Resumo e Mundo)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const campaignMock = {
    id: "camp-123",
    name: "Crônicas de Eldoria",
    description: "Uma grande jornada.",
    rulesEngine: "d20_mod",
    pvpEnabled: false,
    coverImageUrl: "https://example.com/cover.jpg",
    worldMapUrl: null,
    master: {
      id: "master-1",
      displayName: "Mestre Mork",
      email: "master@mork.com",
    },
    characters: [
      {
        id: "char-1",
        name: "Valeros",
        imageUrl: null,
        level: 2,
        hitPointsCurrent: 15,
        hitPointsMax: 15,
        manaPointsCurrent: 5,
        manaPointsMax: 5,
      },
    ],
  };

  const setupMocks = (detailsResponse?: any) => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { id: "user-1", displayName: "Jogador Teste" } }),
        });
      }
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [campaignMock] }),
        });
      }
      if (url === "/api/player/wealth") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      }
      if (url === `/api/player/campaigns/${campaignMock.id}/details`) {
        if (detailsResponse && !detailsResponse.ok) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              detailsResponse ?? {
                success: true,
                data: {
                  worlds: [
                    {
                      id: "world-1",
                      name: "Reino de Prata",
                      description: "Terras gélidas",
                      coverUrl: "https://example.com/world.jpg",
                    },
                    {
                      id: "world-2",
                      name: "Deserto Sem Fim",
                      description: null,
                      coverUrl: null,
                    },
                  ],
                  establishments: [
                    {
                      id: "est-1",
                      name: "Taverna do Javali",
                      type: "Taverna",
                      worldId: "world-1",
                      reputationLevel: 3,
                    },
                  ],
                  npcs: [
                    {
                      id: "npc-1",
                      name: "Garrick",
                      npcType: "Ferreiro",
                      level: 5,
                      imageUrl: "https://example.com/npc.jpg",
                      worldId: "world-1",
                    },
                  ],
                },
              }
            ),
        });
      }
      return Promise.resolve({ ok: false });
    });
  };

  it("renderiza tabs Resumo e Mundo, carrega e exibe mundos unificados com estabelecimentos (círculos com 4 dots de reputação), NPCs e artwork", async () => {
    setupMocks();
    render(<PlayerDashboard />);

    // Navega para aba Campanhas
    const campanhasTab = await screen.findByRole("button", { name: "Campanhas" });
    fireEvent.click(campanhasTab);

    // Clica no card da campanha para abrir o modal
    const campaignCard = await screen.findByText("Crônicas de Eldoria");
    fireEvent.click(campaignCard);

    // Verifica que modal abriu e mostra tabs
    const tabResumo = await screen.findByRole("tab", { name: "Resumo" });
    const tabMundo = await screen.findByRole("tab", { name: "Mundo" });
    expect(tabResumo).toBeDefined();
    expect(tabMundo).toBeDefined();

    // Estado inicial na aba Resumo
    expect(screen.getByText("Detalhes da Campanha")).toBeDefined();

    // Alterna para aba Mundo
    fireEvent.click(tabMundo);

    // Aguarda carregamento dos dados do mundo e estabelecimentos unificados
    const establishmentCircle = await screen.findByLabelText(
      /Taverna do Javali, Taverna, Reputação nível 3 \(3 de 4 segmentos\)/i
    );
    expect(establishmentCircle).toBeDefined();

    // Verifica que NÃO existe seção standalone de estabelecimentos
    expect(screen.queryByText("🏬 Estabelecimentos")).toBeNull();

    // Verifica que existe apenas seção unificada de Mundos
    expect(screen.getByText("🌍 Mundos")).toBeDefined();

    // Verifica NPCs
    expect(screen.getByText("Garrick")).toBeDefined();
    expect(screen.getByText(/Ferreiro • Nível 5/)).toBeDefined();

    // Verifica Mundos e artwork
    const world1 = screen.getByText("Reino de Prata");
    expect(world1).toBeDefined();
    const world2 = screen.getByText("Deserto Sem Fim");
    expect(world2).toBeDefined();

    // Verifica estado compacto de mundo sem estabelecimentos (Deserto Sem Fim não tem estabelecimentos)
    expect(screen.getByText("Nenhum estabelecimento")).toBeDefined();

    // Verifica que o SVG do círculo possui 4 segmentos de perímetro contínuo e o círculo central
    const svgElement = establishmentCircle.querySelector("svg");
    expect(svgElement).toBeDefined();

    // Conta os elementos: 4 paths (segmentos) + 1 circle (central) = 5 elementos gráficos no total
    const paths = svgElement?.querySelectorAll("path");
    expect(paths?.length).toBe(4);

    const circles = svgElement?.querySelectorAll("circle");
    expect(circles?.length).toBe(1);

    // Valida os 4 segmentos de reputação (3 ativos para reputação 3, 1 inativo)
    const reputationSegments = svgElement?.querySelectorAll("[data-reputation-segment]");
    expect(reputationSegments?.length).toBe(4);

    const activeSegments = svgElement?.querySelectorAll('[data-active="true"]');
    expect(activeSegments?.length).toBe(3);

    const inactiveSegments = svgElement?.querySelectorAll('[data-active="false"]');
    expect(inactiveSegments?.length).toBe(1);

    // Valida inicial do estabelecimento dentro do círculo
    expect(svgElement?.querySelector("text")?.textContent).toBe("T");
  });

  it("exibe estado vazio quando não há estabelecimentos, NPCs ou mundos", async () => {
    const setupEmptyMocks = () => {
      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (url === "/api/auth/me") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { id: "user-1", displayName: "Jogador Teste" } }) });
        }
        if (url === "/api/characters") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
        }
        if (url === "/api/systems/missing/habitants") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
        }
        if (url === "/api/player/campaigns") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [campaignMock] }) });
        }
        if (url === "/api/player/wealth") {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
        }
        if (url === `/api/player/campaigns/${campaignMock.id}/details`) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: { worlds: [], establishments: [], npcs: [] } }),
          });
        }
        return Promise.resolve({ ok: false });
      });
    };

    setupEmptyMocks();
    render(<PlayerDashboard />);

    const campanhasTab = await screen.findByRole("button", { name: "Campanhas" });
    fireEvent.click(campanhasTab);

    const campaignCard = await screen.findByText("Crônicas de Eldoria");
    fireEvent.click(campaignCard);

    const tabMundo = await screen.findByRole("tab", { name: "Mundo" });
    fireEvent.click(tabMundo);

    await waitFor(() => {
      expect(screen.queryByText("Nenhum estabelecimento disponível")).toBeNull();
      expect(screen.getByText("Nenhum NPC disponível")).toBeDefined();
      expect(screen.getByText("Nenhum mundo disponível")).toBeDefined();
    });
  });

  it("exibe mensagem de erro caso ocorra falha na requisição dos detalhes do mundo", async () => {
    setupMocks({ ok: false });

    render(<PlayerDashboard />);

    const campanhasTab = await screen.findByRole("button", { name: "Campanhas" });
    fireEvent.click(campanhasTab);

    const campaignCard = await screen.findByText("Crônicas de Eldoria");
    fireEvent.click(campaignCard);

    const tabMundo = await screen.findByRole("tab", { name: "Mundo" });
    fireEvent.click(tabMundo);

    await waitFor(() => {
      expect(screen.getByText("Erro ao carregar dados do mundo")).toBeDefined();
    });
  });

  it("reseta a aba para Resumo ao fechar ou reabrir campanha", async () => {
    setupMocks();
    render(<PlayerDashboard />);

    const campanhasTab = await screen.findByRole("button", { name: "Campanhas" });
    fireEvent.click(campanhasTab);

    const campaignCard = await screen.findByText("Crônicas de Eldoria");
    fireEvent.click(campaignCard);

    const tabMundo = await screen.findByRole("tab", { name: "Mundo" });
    fireEvent.click(tabMundo);

    // Verifica que está na aba Mundo (seção unificada de Mundos deve existir)
    expect(await screen.findByText("🌍 Mundos")).toBeDefined();

    // Fecha modal
    const closeBtn = screen.getByLabelText("Fechar");
    fireEvent.click(closeBtn);

    // Reabre modal
    fireEvent.click(await screen.findByText("Crônicas de Eldoria"));

    // Aba ativa deve ser Resumo
    expect(await screen.findByText("Detalhes da Campanha")).toBeDefined();
  });
});
