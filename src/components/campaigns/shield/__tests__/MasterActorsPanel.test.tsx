import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterActorsPanel } from "../MasterActorsPanel";

const subscribeInviteCreated = vi.fn(() => vi.fn());
const subscribeInviteRevoked = vi.fn(() => vi.fn());

type InviteProps = {
  showCharactersNpcs: boolean;
  showPlayers: boolean;
  campaignId: string;
  [key: string]: unknown;
};

const invitesProps: InviteProps[] = [];
vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: (props: InviteProps) => {
    invitesProps.push(props);
    return (
      <div data-testid={`campaign-invites-${props.showCharactersNpcs ? "npcs" : "players"}`} />
    );
  },
}));
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    subscribeCampaignInviteCreated: subscribeInviteCreated,
    subscribeCampaignInviteRevoked: subscribeInviteRevoked,
  }),
}));

const baseProps = {
  campaignId: "camp-1",
  rosterVersion: 0,
  showCharactersNpcs: true,
  showPlayers: true,
};

describe("MasterActorsPanel (issue #89)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders tabs for Personagens/NPCs and Jogadores Conectados", () => {
    render(<MasterActorsPanel {...baseProps} />);

    expect(screen.getByTestId("shield-tab-charactersNpcs")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab-players")).toBeInTheDocument();
    expect(screen.getByTestId("campaign-invites-npcs")).toBeInTheDocument();
  });

  it("keeps both invites mounted when switching tabs", () => {
    render(<MasterActorsPanel {...baseProps} />);

    fireEvent.click(screen.getByTestId("shield-tab-players"));

    expect(screen.getByTestId("campaign-invites-npcs")).toBeInTheDocument();
    expect(screen.getByTestId("campaign-invites-players")).toBeInTheDocument();
  });

  it("renders the players instance with showPlayers (que registra as assinaturas WS — issue #75)", () => {
    render(<MasterActorsPanel {...baseProps} />);

    // A instância de Personagens/NPCs não ativa showPlayers; apenas a aba de
    // Jogadores registra subscribeCampaignInviteCreated/Revoked (gated em
    // CampaignInvites pela flag showPlayers).
    const npcsInstance = invitesProps.find((p) => p.showCharactersNpcs);
    const playersInstance = invitesProps.find((p) => p.showPlayers);
    expect(npcsInstance?.showPlayers).toBe(false);
    expect(playersInstance?.showPlayers).toBe(true);
    expect(playersInstance?.showCharactersNpcs).toBe(false);
  });

  it("hides disabled tabs and does not mount their content", () => {
    render(<MasterActorsPanel {...baseProps} showCharactersNpcs={false} />);

    expect(screen.queryByTestId("shield-tab-charactersNpcs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("campaign-invites-npcs")).not.toBeInTheDocument();
    expect(screen.getByTestId("campaign-invites-players")).toBeInTheDocument();
  });

  it("persists the preferred actors tab", async () => {
    const { unmount } = render(<MasterActorsPanel {...baseProps} />);

    fireEvent.click(screen.getByTestId("shield-tab-players"));
    expect(localStorage.getItem("libmork:shield-tab:actors")).toBe("players");

    unmount();
    render(<MasterActorsPanel {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-tab-players")).toHaveAttribute("aria-selected", "true");
    });
  });
});
