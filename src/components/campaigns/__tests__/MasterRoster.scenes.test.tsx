import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterRoster } from "../MasterRoster";

// Harness espelhado de MasterRoster.visibility.test.tsx (mocks de socket,
// fetch e filhos pesados), estendido com updateCombatState e limpeza de
// localStorage entre casos.

// Mock dependencies
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
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
  InfiniteCanvas: () => <div data-testid="mock-infinite-canvas">Canvas Active</div>,
}));

vi.mock("@/components/campaigns/CharacterCarousel", () => ({
  CharacterCarousel: () => <div data-testid="mock-character-carousel">Carousel Active</div>,
}));

vi.mock("@/components/campaigns/MapEditor", () => ({
  MapEditor: () => <div data-testid="mock-map-editor">Map Active</div>,
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicComponent = () => <div data-testid="mock-dynamic-map">Map Component</div>;
    DynamicComponent.displayName = "DynamicComponent";
    return DynamicComponent;
  },
}));

global.fetch = vi.fn();

describe("MasterRoster — matriz de visibilidade por cena (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/roster")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                players: [],
                npcs: [],
              },
            }),
        });
      }
      if (url.includes("/worlds") && !url.includes("/encounters")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [{ id: "world-1", name: "Mundo Central", mapUrl: "http://example.com/map.jpg" }],
            }),
        });
      }
      if (url.includes("/encounters")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      });
    });
  });

  it("caso 1: activeScene=interlude esconde a barra de combate e o carrossel", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="interlude"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    // Barra de combate ausente (nem o botão nem o título de encontro ativo)
    expect(screen.queryByText(/Iniciar Encontro/)).toBeNull();
    expect(screen.queryByText(/COMBATE ATIVO/)).toBeNull();
    expect(screen.queryByText(/Nenhum combate ativo/)).toBeNull();
    // Carrossel ausente, sem sobrescrever preferências
    expect(screen.queryByTestId("resize-carousel-panel")).toBeNull();
    expect(screen.queryByTestId("mock-character-carousel")).toBeNull();
  });

  it("caso 2: activeScene=combat força o carrossel visível mesmo colapsado, sem sobrescrever localStorage", async () => {
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mock-character-carousel")).toBeInTheDocument();
    // A preferência salva permanece intacta ("visible" não reescreve o colapso)
    expect(localStorage.getItem("carousel-collapsed-test-camp")).toBe("true");
  });

  it("caso 3: activeScene=null (Livre) preserva o comportamento atual (colapso esconde)", async () => {
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("resize-carousel-panel")).toBeNull();
    // A barra neutra continua renderizada como hoje
    expect(screen.getByText(/Nenhum combate ativo/)).toBeInTheDocument();
  });

  it("caso 4: activeScene=combat sem mundo selecionado mostra o hint de mundo na barra", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId=""
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("scene-combat-world-hint")).toBeInTheDocument();
    });
  });

  it("caso 5: missing_zero ignora a matriz (tudo como hoje com activeScene=combat)", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        rulesEngine="missing_zero"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("[ REGISTRO CIVIL // HABITANTES DA REGIÃO ]")).toBeInTheDocument();
    });

    // Barra do Missing no lugar da barra de combate d20, carrossel visível (neutro)
    expect(screen.queryByText(/Iniciar Encontro/)).toBeNull();
    expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    expect(screen.getByTestId("mock-character-carousel")).toBeInTheDocument();
  });
});
