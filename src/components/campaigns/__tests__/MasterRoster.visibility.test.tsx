import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterRoster } from "../MasterRoster";

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

describe("MasterRoster Visibility Props & Config Toggles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    }) as any;
  });

  it("renders canvas and carousel by default (all true)", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        showRoster={true}
        showCanvas={true}
        showMap={true}
        onTogglePopOut={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mock-character-carousel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Destacar/i })).toBeInTheDocument();
  });

  it("hides carousel and action bar when showRoster=false, and hides popout button", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        showRoster={false}
        showCanvas={true}
        showMap={true}
        onTogglePopOut={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    // Carousel must NOT be rendered
    expect(screen.queryByTestId("mock-character-carousel")).not.toBeInTheDocument();
    // Combat action bar must NOT be rendered
    expect(screen.queryByText(/Nenhum combate ativo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Iniciar Encontro/i)).not.toBeInTheDocument();
    // Popout button must NOT be rendered when showRoster is false and not popped out
    expect(screen.queryByRole("button", { name: /Destacar/i })).not.toBeInTheDocument();
  });

  it("allows re-docking (Reencaixar) even if showRoster=false when isPoppedOut=true", async () => {
    const handleTogglePopOut = vi.fn();
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        showRoster={false}
        showCanvas={true}
        showMap={true}
        isPoppedOut={true}
        onTogglePopOut={handleTogglePopOut}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reencaixar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Reencaixar/i }));
    expect(handleTogglePopOut).toHaveBeenCalledTimes(1);
  });

  it("switches to map when canvas is hidden (showCanvas=false, showMap=true)", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        showRoster={true}
        showCanvas={false}
        showMap={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-dynamic-map")).toBeInTheDocument();
    });

    // Canvas should not be visible
    expect(screen.queryByTestId("mock-infinite-canvas")).not.toBeInTheDocument();
    // Canvas tab button should not be rendered
    expect(screen.queryByTitle("Canva Infinito")).not.toBeInTheDocument();
    // Map tab button should be rendered
    expect(screen.getByTitle("Mapa do Mundo")).toBeInTheDocument();
  });

  it("switches to canvas when map is hidden (showCanvas=true, showMap=false)", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        showRoster={true}
        showCanvas={true}
        showMap={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("mock-dynamic-map")).not.toBeInTheDocument();
    expect(screen.getByTitle("Canva Infinito")).toBeInTheDocument();
    expect(screen.queryByTitle("Mapa do Mundo")).not.toBeInTheDocument();
  });

  it("shows empty state when both canvas and map are hidden, with restoration action", async () => {
    const handleReset = vi.fn();
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        showRoster={true}
        showCanvas={false}
        showMap={false}
        onResetConfig={handleReset}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Canvas e mapa estão ocultos nas configurações.")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("mock-infinite-canvas")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-dynamic-map")).not.toBeInTheDocument();

    const restoreBtn = screen.getByRole("button", { name: "Restaurar módulos" });
    expect(restoreBtn).toBeInTheDocument();
    fireEvent.click(restoreBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
