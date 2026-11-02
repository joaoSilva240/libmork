// =============================================================================
// Libmork — PlayerDashboard: Exibição e Abertura de Ficha de Habitantes de MISSING
// =============================================================================

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";
import type { MissingHabitant } from "@/lib/systems/missing/types";

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: ({ character }: { character: { name: string } }) => (
    <div data-testid="character-card">{character.name}</div>
  ),
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

describe("PlayerDashboard - MISSING Habitants Integration", () => {
  const mockHabitants: MissingHabitant[] = [
    {
      id: "hab-1",
      campaignId: null,
      ownerId: "user-1",
      name: "Detetive John Doe",
      status: "active",
      lines: [
        { id: "l-1", index: 1, text: "Memória 1: Chegada na cidade", isErased: false },
        { id: "l-2", index: 2, text: "Memória 2: O quarto do hotel", isErased: false },
        { id: "l-3", index: 3, text: "Memória 3: A foto antiga", isErased: false },
        { id: "l-4", index: 4, text: "Memória 4: O bilhete anônimo", isErased: false },
        { id: "l-5", index: 5, text: "Memória 5: A chave do carro", isErased: false },
      ],
      equipments: [
        { id: "eq-1", slot: 1, name: "Lanterna Antiga", notes: "Luz amarelada", status: "active" },
        { id: "eq-2", slot: 2, name: "Gravador de Rolo", notes: "Sem fita", status: "active" },
        { id: "eq-3", slot: 3, name: "Caderno Pautado", notes: "Anotações ilegíveis", status: "lost" },
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
        { id: "l-6", index: 1, text: "Memória rasurada", isErased: true },
        { id: "l-7", index: 2, text: "Outra memória apagada", isErased: true },
      ],
      equipments: [
        { id: "eq-4", slot: 1, name: "Distintivo", notes: "", status: "active" },
        { id: "eq-5", slot: 2, name: "Revólver", notes: "", status: "lost" },
        { id: "eq-6", slot: 3, name: "", notes: "", status: "active" },
      ],
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza os cards de Habitantes de MISSING com badge, nome, avatar, contadores e botão", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockHabitants }),
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

    render(<PlayerDashboard />);

    // Não deve exibir o estado vazio "Você ainda não tem personagens"
    await waitFor(() => {
      expect(screen.queryByText("Você ainda não tem personagens.")).not.toBeInTheDocument();
    });

    // Deve exibir os nomes dos habitantes
    expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    expect(screen.getByText("Agente Sarah Miller")).toBeInTheDocument();

    // Deve exibir o badge "MISSING — Edição ZERO"
    const badges = screen.getAllByText("MISSING — Edição ZERO");
    expect(badges.length).toBeGreaterThanOrEqual(2);

    // Deve exibir os status "Ativo" e "Desaparecido"
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Desaparecido")).toBeInTheDocument();

    // Deve exibir os contadores de memórias
    expect(screen.getByText("5 / 5 linhas de memórias legíveis")).toBeInTheDocument();
    expect(screen.getByText("0 / 2 linhas de memórias legíveis")).toBeInTheDocument();

    // Deve exibir os contadores de equipamentos
    expect(screen.getByText("2 / 3 itens disponíveis")).toBeInTheDocument();
    expect(screen.getByText("1 / 3 itens disponíveis")).toBeInTheDocument();

    // Deve exibir a indicação "Abrir Ficha →"
    const openButtons = screen.getAllByText("Abrir Ficha →");
    expect(openButtons.length).toBe(2);
  });

  it("abre a ficha do Habitante ao clicar no card e permite fechá-la", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [mockHabitants[0]] }),
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

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    });

    // Ficha ainda não está aberta
    expect(screen.queryByTestId("missing-habitant-sheet")).not.toBeInTheDocument();

    // Clica no card do habitante
    const card = screen.getByTestId("missing-habitant-card-hab-1");
    fireEvent.click(card);

    // Modal/overlay com a ficha deve ser aberto
    await waitFor(() => {
      expect(screen.getByTestId("missing-habitant-sheet")).toBeInTheDocument();
    });

    // Deve exibir elementos da ficha do habitante (ex: as linhas de memória e os 3 post-its)
    expect(screen.getByText("Memória 1: Chegada na cidade")).toBeInTheDocument();
    expect(screen.getByText("Equipamentos (3 Post-its)")).toBeInTheDocument();

    // Fecha a ficha clicando no botão de fechar
    const closeBtn = screen.getByRole("button", { name: "Fechar ficha" });
    fireEvent.click(closeBtn);

    // Ficha deve sumir
    await waitFor(() => {
      expect(screen.queryByTestId("missing-habitant-sheet")).not.toBeInTheDocument();
    });
  });

  it("chama a API de rasura e atualiza o estado da ficha ao rasurar linha", async () => {
    let currentHabitant = { ...mockHabitants[0] };

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [currentHabitant] }) });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/player/wealth") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      }
      if (url === `/api/systems/missing/habitants/${mockHabitants[0].id}/erase` && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        currentHabitant = {
          ...currentHabitant,
          lines: currentHabitant.lines.map((l) =>
            l.id === body.lineId ? { ...l, isErased: true, erasedReason: body.reason } : l,
          ),
        };
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: currentHabitant }) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    });

    // Abre a ficha
    fireEvent.click(screen.getByTestId("missing-habitant-card-hab-1"));

    await waitFor(() => {
      expect(screen.getByTestId("missing-habitant-sheet")).toBeInTheDocument();
    });

    // Clica no botão de rasurar da primeira linha
    const rasurarBtn = screen.getByTestId("btn-rasurar-1");
    fireEvent.click(rasurarBtn);

    // Confirma a rasura
    const confirmarBtn = screen.getByRole("button", { name: "Rasurar" });
    fireEvent.click(confirmarBtn);

    // Espera atualizar a linha para rasurada
    await waitFor(() => {
      expect(screen.getByTestId("erased-line-1")).toBeInTheDocument();
    });
  });

  it("chama a API de PATCH e atualiza o estado da ficha ao adicionar linha", async () => {
    let currentHabitant = { ...mockHabitants[0] };

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/characters") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/systems/missing/habitants") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [currentHabitant] }) });
      }
      if (url === "/api/player/campaigns") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
      }
      if (url === "/api/player/wealth") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: null }) });
      }
      if (url === `/api/systems/missing/habitants/${mockHabitants[0].id}` && init?.method === "PATCH") {
        const body = JSON.parse(init.body as string);
        if (body.addLine) {
          currentHabitant = {
            ...currentHabitant,
            lines: [
              ...currentHabitant.lines,
              {
                id: "l-new",
                index: currentHabitant.lines.length + 1,
                text: body.addLine,
                isErased: false,
              },
            ],
          };
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: currentHabitant }) });
      }
      return Promise.resolve({ ok: false });
    });

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Detetive John Doe")).toBeInTheDocument();
    });

    // Abre a ficha
    fireEvent.click(screen.getByTestId("missing-habitant-card-hab-1"));

    await waitFor(() => {
      expect(screen.getByTestId("missing-habitant-sheet")).toBeInTheDocument();
    });

    // Clica em "Adicionar Linha"
    const addBtn = screen.getByTestId("btn-adicionar-linha");
    fireEvent.click(addBtn);

    // Digita nova linha
    const input = screen.getByPlaceholderText("Escreva uma nova linha do registro...");
    fireEvent.change(input, { target: { value: "Memória 6: Encontrou um medalhão" } });

    // Salva
    const saveBtn = screen.getByTestId("btn-confirmar-add-linha");
    fireEvent.click(saveBtn);

    // Espera atualizar e exibir a nova memória
    await waitFor(() => {
      expect(screen.getByText("Memória 6: Encontrou um medalhão")).toBeInTheDocument();
    });
  });

  it("exibe estado vazio se tanto characters quanto missingHabitants forem vazios", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
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

    render(<PlayerDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Você ainda não tem personagens.")).toBeInTheDocument();
    });
  });
});
