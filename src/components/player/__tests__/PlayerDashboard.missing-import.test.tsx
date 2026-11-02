// =============================================================================
// Libmork — PlayerDashboard: Import Habitants into MISSING — Edição ZERO Tests
// =============================================================================

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";
import type { MissingHabitant } from "@/lib/systems/missing/types";

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => <div>{character.name}</div>,
}));

vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => null }));

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

describe("PlayerDashboard - MISSING Campaign Import and Sheet Integration", () => {
  const mockHabitants: MissingHabitant[] = [
    {
      id: "hab-1",
      campaignId: null,
      ownerId: "user-1",
      name: "Detetive John Doe",
      status: "active",
      lines: [
        { id: "l-1", index: 1, text: "Memória 1", isErased: false },
        { id: "l-2", index: 2, text: "Memória 2", isErased: false },
      ],
      equipments: [
        { id: "eq-1", slot: 1, name: "Lanterna", notes: "", status: "active" },
        { id: "eq-2", slot: 2, name: "", notes: "", status: "active" },
        { id: "eq-3", slot: 3, name: "", notes: "", status: "active" },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "hab-2",
      campaignId: null,
      ownerId: "user-1",
      name: "Agente Sarah Miller",
      status: "missing",
      lines: [
        { id: "l-3", index: 1, text: "Memória apagada", isErased: true },
      ],
      equipments: [
        { id: "eq-4", slot: 1, name: "Distintivo", notes: "", status: "active" },
        { id: "eq-5", slot: 2, name: "", notes: "", status: "active" },
        { id: "eq-6", slot: 3, name: "", notes: "", status: "active" },
      ],
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza o badge 'MISSING — Edição ZERO' na lista e no modal de detalhes", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: mockHabitants }) });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-missing-1",
                  name: "Névoa sobre Innsmouth",
                  description: "Uma investigação sombria.",
                  rulesEngine: "missing_zero",
                  pvpEnabled: false,
                  master: { displayName: "A Voz Misteriosa" },
                  characters: [],
                  habitants: [],
                },
              ],
            }),
        });
      }
      if (url === "/api/player/wealth") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    // Alternar para aba de Campanhas
    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Névoa sobre Innsmouth")).toBeInTheDocument();
    });

    // Badge na listagem de campanhas
    expect(screen.getAllByText("MISSING — Edição ZERO").length).toBeGreaterThanOrEqual(1);

    // Abrir o modal da campanha
    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha Névoa sobre Innsmouth/i });
    fireEvent.click(campaignCard);

    // Verificar detalhes da campanha
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Névoa sobre Innsmouth", level: 2 })).toBeInTheDocument();
    });

    // Badge no topo do modal detalhado
    expect(screen.getAllByText("MISSING — Edição ZERO").length).toBeGreaterThanOrEqual(2);

    // Botões de ação para MISSING (nenhum habitante vinculado, logo hasAliveCharacter === false)
    const createBtn = screen.getByText("+ Criar Habitante nesta Campanha");
    expect(createBtn.closest("a")).toHaveAttribute(
      "href",
      "/player/characters/new?campaignId=camp-missing-1&system=missing_zero"
    );

    expect(screen.getByText("↩ Importar Habitante Existente")).toBeInTheDocument();
  });

  it("abre o modal de importação com estilo analógico de MISSING e lista habitantes disponíveis", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: mockHabitants }) });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-missing-1",
                  name: "Névoa sobre Innsmouth",
                  rulesEngine: "missing_zero",
                  pvpEnabled: false,
                  master: { displayName: "A Voz" },
                  characters: [],
                  habitants: [],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Névoa sobre Innsmouth")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);

    const importButton = await screen.findByText("↩ Importar Habitante Existente");
    fireEvent.click(importButton);

    // Título do modal deve ser "Importar Habitante"
    await waitFor(() => {
      expect(screen.getByText("Importar Habitante")).toBeInTheDocument();
    });

    // Habitantes devem ser listados com nome, status e contagem de memórias
    expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    expect(screen.getByText("Agente Sarah Miller")).toBeInTheDocument();
    expect(screen.getByText("2 linhas")).toBeInTheDocument();
    expect(screen.getByText("0 linhas")).toBeInTheDocument();

    // Filtro por nome
    const searchInput = screen.getByPlaceholderText("Buscar por nome...");
    fireEvent.change(searchInput, { target: { value: "Sarah" } });

    expect(screen.queryByText("Detetive John Doe")).not.toBeInTheDocument();
    expect(screen.getByText("Agente Sarah Miller")).toBeInTheDocument();
  });

  it("importa o habitante com sucesso e recarrega campanhas e habitantes", async () => {
    let imported = false;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: imported
                ? [{ ...mockHabitants[0], campaignId: "camp-missing-1" }]
                : mockHabitants,
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-missing-1",
                  name: "Névoa sobre Innsmouth",
                  rulesEngine: "missing_zero",
                  pvpEnabled: false,
                  master: { displayName: "A Voz" },
                  characters: imported
                    ? [
                        {
                          id: "hab-1",
                          name: "Detetive John Doe",
                          imageUrl: null,
                          level: 1,
                          hitPointsCurrent: 1,
                          hitPointsMax: 1,
                          manaPointsCurrent: 0,
                          manaPointsMax: 0,
                        },
                      ]
                    : [],
                  habitants: imported
                    ? [{ ...mockHabitants[0], campaignId: "camp-missing-1" }]
                    : [],
                },
              ],
            }),
        });
      }
      if (url === "/api/campaigns/camp-missing-1/import-character" && init?.method === "POST") {
        imported = true;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              success: true,
              data: { habitantId: "hab-1", campaignId: "camp-missing-1" },
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Névoa sobre Innsmouth")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);

    const importButton = await screen.findByText("↩ Importar Habitante Existente");
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText("Importar Habitante")).toBeInTheDocument();
    });

    // Clicar em vincular o primeiro habitante
    const vincularButtons = screen.getAllByRole("button", { name: "Vincular" });
    fireEvent.click(vincularButtons[0]);

    // Toast de sucesso
    await waitFor(() => {
      expect(screen.getByText("Habitante vinculado com sucesso!")).toBeInTheDocument();
    });

    // Modal de importação fecha
    expect(screen.queryByText("Importar Habitante")).not.toBeInTheDocument();
  });

  it("exibe toast info quando o usuário não possui habitantes para importar", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        // Usuário tem apenas um habitante desaparecido nesta campanha e nenhum outro fora
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  ...mockHabitants[1],
                  id: "hab-dead-in-camp",
                  campaignId: "camp-missing-1",
                  status: "missing",
                },
              ],
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-missing-1",
                  name: "Névoa sobre Innsmouth",
                  rulesEngine: "missing_zero",
                  pvpEnabled: false,
                  master: { displayName: "A Voz" },
                  characters: [
                    {
                      id: "hab-dead-in-camp",
                      name: "Agente Sarah Miller",
                      imageUrl: null,
                      level: 1,
                      hitPointsCurrent: 0,
                      hitPointsMax: 1,
                      manaPointsCurrent: 0,
                      manaPointsMax: 0,
                    },
                  ],
                  habitants: [
                    {
                      ...mockHabitants[1],
                      id: "hab-dead-in-camp",
                      campaignId: "camp-missing-1",
                      status: "missing",
                    },
                  ],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Névoa sobre Innsmouth")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);

    const importButton = await screen.findByText("↩ Importar Habitante Existente");
    fireEvent.click(importButton);

    // Toast específico para habitantes
    await waitFor(() => {
      expect(screen.getByText("Você não tem habitantes para importar")).toBeInTheDocument();
    });

    expect(screen.queryByText("Importar Habitante")).not.toBeInTheDocument();
  });

  it("abre a ficha do Habitante ao clicar em 'Abrir Ficha' dentro da campanha de MISSING", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ ...mockHabitants[0], campaignId: "camp-missing-1" }],
            }),
        });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: "camp-missing-1",
                  name: "Névoa sobre Innsmouth",
                  rulesEngine: "missing_zero",
                  pvpEnabled: false,
                  master: { displayName: "A Voz" },
                  characters: [
                    {
                      id: "hab-1",
                      name: "Detetive John Doe",
                      imageUrl: null,
                      level: 1,
                      hitPointsCurrent: 1,
                      hitPointsMax: 1,
                      manaPointsCurrent: 0,
                      manaPointsMax: 0,
                    },
                  ],
                  habitants: [{ ...mockHabitants[0], campaignId: "camp-missing-1" }],
                },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    const campaignsTab = screen.getByRole("button", { name: "Campanhas" });
    fireEvent.click(campaignsTab);

    await waitFor(() => {
      expect(screen.getByText("Névoa sobre Innsmouth")).toBeInTheDocument();
    });

    const campaignCard = screen.getByRole("button", { name: /Ver detalhes da campanha/i });
    fireEvent.click(campaignCard);

    // Deve exibir o card analógico do habitante
    await waitFor(() => {
      expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
      expect(screen.getByText("2 / 2 linhas de memórias legíveis")).toBeInTheDocument();
    });

    // Clicar em Abrir Ficha
    const abrirFichaBtn = screen.getByRole("button", { name: "Abrir Ficha" });
    fireEvent.click(abrirFichaBtn);

    // Modal da ficha de Habitante (MissingHabitantSheet) deve ser aberto no painel
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Ficha de Detetive John Doe" })).toBeInTheDocument();
    });

    // Fechar a ficha
    const fecharFichaBtn = screen.getByRole("button", { name: "Fechar ficha" });
    fireEvent.click(fecharFichaBtn);

    expect(screen.queryByRole("dialog", { name: "Ficha de Detetive John Doe" })).not.toBeInTheDocument();
  });
});
