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
vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="master-jukebox-mock" />,
}));
vi.mock("@/components/campaigns/MasterAssetsPanel", () => ({
  MasterAssetsPanel: () => <div data-testid="master-assets-mock" />,
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

  it("renders Jukebox and Assets in the right column when configured in rightColumnOrder", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showJukebox: true,
        showAssets: true,
        showSessionLog: true,
        leftColumnOrder: ["worlds", "charactersNpcs", "players"],
        rightColumnOrder: ["jukebox", "assets", "sessionLog"],
      })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-grid")).toBeInTheDocument();
    });

    const leftCol = screen.getByTestId("shield-left-column");
    const rightCol = screen.getByTestId("shield-right-column");

    expect(leftCol).not.toContainElement(screen.getByTestId("master-jukebox-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("master-jukebox-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("master-assets-mock"));
    expect(rightCol).toContainElement(screen.getByTestId("session-log-mock"));
  });

  it("hides MasterAssetsPanel when showAssets is false", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showAssets: false,
        leftColumnOrder: ["assets", "worlds"],
        rightColumnOrder: ["sessionLog"],
      })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-grid")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("master-assets-mock")).not.toBeInTheDocument();
  });

  it("maintains flex-1 and min-h-0 on SessionLog container when sharing column with other modules", async () => {
    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({
        showJukebox: true,
        showSessionLog: true,
        leftColumnOrder: ["worlds"],
        rightColumnOrder: ["jukebox", "sessionLog"],
      })
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