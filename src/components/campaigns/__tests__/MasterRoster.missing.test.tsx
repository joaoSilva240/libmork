import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterRoster } from "../MasterRoster";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    presenceList: [],
    joinCampaign: vi.fn(),
    subscribeActorStatus: vi.fn(() => vi.fn()),
    subscribeDiceRoll: vi.fn(() => vi.fn()),
    subscribeCombatState: vi.fn(() => vi.fn()),
    updateCombatState: vi.fn(),
  }),
}));

vi.mock("@/components/campaigns/InfiniteCanvas", () => ({
  InfiniteCanvas: () => <div data-testid="infinite-canvas">Canvas de Investigação</div>,
}));

vi.mock("@/components/campaigns/MapEditor", () => ({
  MapEditor: (props: { isMissing?: boolean }) => (
    <div data-testid="map-editor" data-missing={props.isMissing ? "true" : "false"}>
      Mapa de Campo
    </div>
  ),
}));

describe("MasterRoster Component (MISSING Rules Engine)", () => {
  const mockHabitant = {
    id: "h1",
    campaignId: "c1",
    ownerId: "u1",
    name: "Agente Silva",
    status: "active",
    lines: [
      {
        id: "l1",
        habitantId: "h1",
        lineNumber: 1,
        text: "Eu lembro do antigo farol costeiro",
        isErased: false,
        createdAt: new Date().toISOString(),
      },
    ],
    equipments: [
      { slot: 1, name: "Lanterna Antiga", notes: "Luz fraca", status: "normal" },
      { slot: 2, name: "Diário de Couro", notes: "Anotações", status: "normal" },
      { slot: 3, name: "Chave Enferrujada", notes: "Desconhecida", status: "normal" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/campaigns/c1/roster")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              players: [
                {
                  id: "h1",
                  name: "Agente Silva",
                  imageUrl: null,
                  level: 1,
                  hitPointsCurrent: 1,
                  hitPointsMax: 1,
                  manaPointsCurrent: 0,
                  manaPointsMax: 0,
                  conditions: [],
                  status: "active",
                },
              ],
              npcs: [],
            },
          }),
        });
      }

      if (url.includes("/api/campaigns/c1/worlds") || url.includes("/api/worlds")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: "w1", name: "Distrito Sombrio" }],
          }),
        });
      }

      if (url.includes("/api/campaigns/c1/worlds/w1/encounters")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
          }),
        });
      }

      if (url.includes("/api/systems/missing/campaigns/c1/habitants/h1")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: mockHabitant,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });
    }) as any;
  });

  it("renderiza cabeçalho de dossiê, vistas analógicas e oculta widgets medievais de combate", async () => {
    render(
      <MasterRoster
        campaignId="c1"
        selectedWorldId="w1"
        rulesEngine="missing_zero"
      />
    );

    // Header analógico
    await waitFor(() => {
      expect(screen.getByText(/Dossiê de Campo/)).toBeInTheDocument();
    });

    // Alternadores centrais
    expect(screen.getByText("Quadro de Pistas")).toBeInTheDocument();
    expect(screen.getByText("Mapa de Campo")).toBeInTheDocument();
    expect(screen.queryByText("Canva Infinito")).not.toBeInTheDocument();

    // Faixa sobre o carrossel (Registro civil, sem botão de iniciar combate d20)
    expect(screen.getByText("[ REGISTRO CIVIL // HABITANTES DA REGIÃO ]")).toBeInTheDocument();
    expect(screen.queryByText("⚔️ Iniciar Encontro (Combate)")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum combate ativo")).not.toBeInTheDocument();

    // Carrossel exibe o habitante com badge ATIVO
    expect(screen.getByText("Agente Silva")).toBeInTheDocument();
    expect(screen.getByText("ATIVO")).toBeInTheDocument();
  });

  it("abre a ficha completa MissingHabitantSheet ao selecionar o habitante no carrossel", async () => {
    render(
      <MasterRoster
        campaignId="c1"
        selectedWorldId="w1"
        rulesEngine="missing_zero"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Agente Silva")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Agente Silva"));

    await waitFor(() => {
      // Ficha aberta em tela cheia com dados detalhados do habitante
      expect(screen.getByRole("dialog", { name: "Ficha de Agente Silva" })).toBeInTheDocument();
      expect(screen.getByText("Eu lembro do antigo farol costeiro")).toBeInTheDocument();
    });
  });
});
