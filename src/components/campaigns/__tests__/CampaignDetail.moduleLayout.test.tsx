import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignDetail } from "../CampaignDetail";
import { masterScreenConfigKey } from "@/hooks/useMasterScreenConfig";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: () => <div data-testid="master-roster-mock" />,
}));
vi.mock("@/components/campaigns/ContentOverlay", () => ({ ContentOverlay: () => null }));
vi.mock("@/components/campaigns/WorldOverlay", () => ({ WorldOverlay: () => null }));
vi.mock("@/components/campaigns/shield/MasterMediaPanel", () => ({
  MasterMediaPanel: ({ isFallout }: any) => (
    <div data-testid="media-panel-mock" data-fallout={isFallout ? "true" : "false"}>
      <div data-testid="master-jukebox-mock" />
      <div data-testid="master-assets-mock" />
    </div>
  ),
}));
vi.mock("@/components/campaigns/shield/MasterActorsPanel", () => ({
  MasterActorsPanel: () => (
    <div data-testid="actors-panel-mock">
      <div data-testid="campaign-invites-npcs" />
      <div data-testid="campaign-invites-players" />
    </div>
  ),
}));
vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="session-log-mock" className="flex-1 min-h-0" />,
}));
vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: ({ showCharactersNpcs, showPlayers }: any) => (
    <div data-testid={`campaign-invites-${showCharactersNpcs ? "npcs" : "players"}`} />
  ),
}));
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    isConnected: true,
    subscribeCampaignLogCreated: vi.fn(() => vi.fn()),
    subscribeCampaignLogUpdated: vi.fn(() => vi.fn()),
    subscribeDiceRoll: vi.fn(() => vi.fn()),
    setCampaignDice3DSettings: vi.fn(),
    subscribeCombatState: vi.fn(() => vi.fn()),
    updateCombatState: vi.fn(),
  }),
}));

describe("CampaignDetail Dynamic Column Module Placement (Issue #75)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: { id: "camp-1", name: "Campanha Teste", rulesEngine: "d20_mod" },
        }),
      });
    }) as any;
  });

  it("renders Media and Actors blocks in the right column when configured in rightColumnOrder", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showJukebox: true,
        showAssets: true,
        showSessionLog: true,
        leftColumnOrder: ["actorsPanel"],
        rightColumnOrder: ["mediaPanel", "sessionLog"],
      }),
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-grid")).toBeInTheDocument();
    });

    const leftCol = screen.getByTestId("shield-left-column");
    const rightCol = screen.getByTestId("shield-right-column");

    expect(leftCol).not.toContainElement(screen.getByTestId("media-panel-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("media-panel-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("master-jukebox-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("master-assets-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("session-log-mock"));
  });

  it("hides the media panel content when all its tabs are disabled", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showAssets: false,
        showMap: false,
        showJukebox: false,
        leftColumnOrder: ["mediaPanel"],
        rightColumnOrder: ["sessionLog"],
      }),
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-grid")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("master-assets-mock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("media-panel-mock")).not.toBeInTheDocument();
  });

  it("mantém o painel de mídia na esquerda para a aba de recursos numa campanha Fallout 2d20", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: { id: "camp-1", name: "Refúgio 111", rulesEngine: "fallout_2d20" },
        }),
      });
    }) as any;

    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showAssets: false,
        showMap: false,
        showJukebox: false,
        leftColumnOrder: ["mediaPanel"],
        rightColumnOrder: ["sessionLog"],
      }),
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("media-panel-mock")).toBeInTheDocument();
    });

    expect(screen.getByTestId("media-panel-mock")).toHaveAttribute("data-fallout", "true");
    expect(screen.getByTestId("shield-left-column")).toContainElement(
      screen.getByTestId("media-panel-mock"),
    );
    // O AP e a radiação saíram do cabeçalho: agora vivem só no card da aba.
    expect(screen.queryByTestId("fallout-ap-tracker")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fallout-radiation-meter")).not.toBeInTheDocument();
  });

  it("maintains flex-1 and min-h-0 on SessionLog container when sharing column with other modules", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showJukebox: true,
        showSessionLog: true,
        leftColumnOrder: ["actorsPanel"],
        rightColumnOrder: ["mediaPanel", "sessionLog"],
      }),
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-right-column")).toBeInTheDocument();
    });

    const rightCol = screen.getByTestId("shield-right-column");
    expect(rightCol.className).toContain("overflow-y-auto");
    expect(rightCol.className).toContain("flex-col");
    expect(rightCol.className).toContain("min-h-0");
  });
});
