import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignDetail } from "../CampaignDetail";
import { masterScreenConfigKey } from "@/hooks/useMasterScreenConfig";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-test-123" }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock SocketContext
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

// Mock child components that make network/socket calls
vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: (props: any) => (
    <div
      data-testid="mock-master-roster"
      data-show-roster={props.showRoster ? "true" : "false"}
      data-show-canvas={props.showCanvas ? "true" : "false"}
      data-show-map={props.showMap ? "true" : "false"}
    >
      MasterRoster Content
    </div>
  ),
}));

vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="mock-session-log">SessionLog Content</div>,
}));

vi.mock("@/components/systems/missing/MissingSessionLog", () => ({
  MissingSessionLog: () => <div data-testid="mock-missing-session-log">MissingSessionLog Content</div>,
}));

vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: () => <div data-testid="mock-campaign-invites">Invites Content</div>,
}));

global.fetch = vi.fn();

describe("CampaignDetail - MasterScreenConfig Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.endsWith("/worlds")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ id: "world-1", name: "Mundo Primário", description: "Desc", mapUrl: null }],
            }),
        });
      }

      if (url.includes("/establishments")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        });
      }

      if (url.includes("/api/campaigns/camp-test-123")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "camp-test-123",
                name: "Campanha dos Bravos",
                rulesEngine: "d20",
                coverImageUrl: null,
                worldMapUrl: null,
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });
  });

  it("does not render the visibility panel inside CampaignDetail", async () => {
    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-master-roster")).toBeInTheDocument();
    });

    expect(screen.queryByText("Visibilidade do Escudo")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-session-log")).toBeInTheDocument();
  });

  it("loads stored global configuration and propagates flags to MasterRoster and SessionLog", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showRoster: false,
        showSessionLog: false,
        showCanvas: false,
        showMap: true,
      })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-master-roster")).toBeInTheDocument();
    });

    const roster = screen.getByTestId("mock-master-roster");
    expect(roster.getAttribute("data-show-roster")).toBe("false");
    expect(roster.getAttribute("data-show-canvas")).toBe("false");
    expect(roster.getAttribute("data-show-map")).toBe("true");

    // Session log should NOT be rendered when showSessionLog is false
    expect(screen.queryByTestId("mock-session-log")).not.toBeInTheDocument();
  });

  it("does not render MISSING config panel inside CampaignDetail but still applies global preferences", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showRoster: false,
        showSessionLog: true,
        showCanvas: true,
        showMap: true,
      })
    );

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.endsWith("/worlds")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ id: "scene-1", name: "Cena 1", description: "Desc", mapUrl: null }],
            }),
        });
      }

      if (url.includes("/api/campaigns/camp-test-123")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: "camp-test-123",
                name: "Arquivo Confidencial",
                rulesEngine: "missing_zero",
                coverImageUrl: null,
                worldMapUrl: null,
              },
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    });

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-missing-session-log")).toBeInTheDocument();
    });

    const roster = screen.getByTestId("mock-master-roster");
    expect(roster.getAttribute("data-show-roster")).toBe("false");

    expect(screen.queryByText("Painel de Controle")).not.toBeInTheDocument();
    expect(screen.queryByText("Registro de Habitantes")).not.toBeInTheDocument();
    expect(screen.queryByText("Boletim de Ocorrências")).not.toBeInTheDocument();
  });
});
