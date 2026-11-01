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
  InfiniteCanvas: () => <div data-testid="infinite-canvas">Canvas</div>,
}));

vi.mock("@/components/campaigns/MapEditor", () => ({
  MapEditor: () => <div data-testid="map-editor">MapEditor</div>,
}));

vi.mock("@/components/campaigns/CharacterCarousel", () => ({
  CharacterCarousel: () => <div data-testid="character-carousel">CharacterCarousel</div>,
}));

describe("MasterRoster Carousel Resize Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/campaigns/c1/roster")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              players: [],
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

      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });
    }) as any;
  });

  it("renders the ResizeHandle on the character carousel when expanded", async () => {
    render(
      <MasterRoster
        campaignId="c1"
        selectedWorldId="w1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    });

    const handle = screen.getByTestId("resize-carousel-panel");
    expect(handle).toHaveAttribute("title", "Redimensionar carrossel de personagens");
    expect(handle).toHaveClass("cursor-ns-resize");
  });

  it("hides the ResizeHandle when the carousel is collapsed via toggle button", async () => {
    render(
      <MasterRoster
        campaignId="c1"
        selectedWorldId="w1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    });

    // Find and click the collapse button (exact match)
    const collapseBtn = screen.getByRole("button", { name: "Recolher" });
    fireEvent.click(collapseBtn);

    // After collapsing, the resize handle should not be in the document
    expect(screen.queryByTestId("resize-carousel-panel")).not.toBeInTheDocument();

    // Find and click expand button (exact match)
    const expandBtn = screen.getByRole("button", { name: "Expandir" });
    fireEvent.click(expandBtn);

    // After expanding, it should be rendered again
    expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
  });

  it("hides the ResizeHandle on mount if carousel was previously stored as collapsed in localStorage", async () => {
    localStorage.setItem("carousel-collapsed-c1", "true");

    render(
      <MasterRoster
        campaignId="c1"
        selectedWorldId="w1"
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId("resize-carousel-panel")).not.toBeInTheDocument();
    });
  });

  it("renders ResizeHandle directly on the central Mesa/Canvas container", async () => {
    render(<MasterRoster campaignId="c1" selectedWorldId="w1" />);

    await waitFor(() => {
      expect(screen.getByTestId("resize-canvas-panel")).toBeInTheDocument();
    });

    const handle = screen.getByTestId("resize-canvas-panel");
    expect(handle).toHaveAttribute("title", "Redimensionar área da mesa");
    expect(handle).toHaveClass("cursor-ns-resize");
  });
});
