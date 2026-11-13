import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignInvites } from "../CampaignInvites";

const socketMocks = vi.hoisted(() => ({
  subscribeCampaignInviteCreated: vi.fn(),
  subscribeCampaignInviteRevoked: vi.fn(),
  notifyCampaignInviteCreated: vi.fn(),
  notifyCampaignInviteRevoked: vi.fn(),
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => socketMocks,
}));

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

const CAMPAIGN_ID = "camp-1";
const INVITES_URL = `/api/campaigns/${CAMPAIGN_ID}/invites`;
const ROSTER_URL = `/api/campaigns/${CAMPAIGN_ID}/roster`;

const fetchedUrls = () => fetchMock.mock.calls.map((call) => String(call[0]));

describe("CampaignInvites visibility-gated data loading (Issue #75)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketMocks.subscribeCampaignInviteCreated.mockReturnValue(vi.fn());
    socketMocks.subscribeCampaignInviteRevoked.mockReturnValue(vi.fn());
    fetchMock.mockImplementation((url: string) => {
      if (url === INVITES_URL) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                id: "user-1",
                displayName: "Jogador Um",
                email: "um@example.com",
                isInvited: false,
                inviteId: null,
                activeCharactersCount: 0,
              },
            ],
          }),
        });
      }
      if (url === ROSTER_URL) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              players: [
                {
                  id: "char-1",
                  name: "Herói",
                  level: 3,
                  hitPointsCurrent: 20,
                  hitPointsMax: 20,
                },
              ],
              npcs: [],
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
    });
  });

  it("fetches only /invites and subscribes to invite events when showPlayers=true, showCharactersNpcs=false", async () => {
    render(
      <CampaignInvites campaignId={CAMPAIGN_ID} showPlayers={true} showCharactersNpcs={false} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Jogadores \(0\/1\)/)).toBeInTheDocument();
    });

    expect(fetchedUrls()).toEqual([INVITES_URL]);
    expect(fetchedUrls()).not.toContain(ROSTER_URL);
    expect(socketMocks.subscribeCampaignInviteCreated).toHaveBeenCalledTimes(1);
    expect(socketMocks.subscribeCampaignInviteRevoked).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Personagens e NPCs/)).not.toBeInTheDocument();
  });

  it("fetches only /roster and does not subscribe to invite events when showCharactersNpcs=true, showPlayers=false", async () => {
    render(
      <CampaignInvites campaignId={CAMPAIGN_ID} showCharactersNpcs={true} showPlayers={false} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Personagens e NPCs \(1\)/)).toBeInTheDocument();
    });

    expect(fetchedUrls()).toEqual([ROSTER_URL]);
    expect(fetchedUrls()).not.toContain(INVITES_URL);
    expect(socketMocks.subscribeCampaignInviteCreated).not.toHaveBeenCalled();
    expect(socketMocks.subscribeCampaignInviteRevoked).not.toHaveBeenCalled();
    expect(screen.queryByText(/Jogadores \(/)).not.toBeInTheDocument();
  });

  it("fetches both /invites and /roster exactly once when both flags are true", async () => {
    render(
      <CampaignInvites campaignId={CAMPAIGN_ID} showCharactersNpcs={true} showPlayers={true} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Personagens e NPCs \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Jogadores \(0\/1\)/)).toBeInTheDocument();
    });

    expect(fetchedUrls().filter((url) => url === INVITES_URL)).toHaveLength(1);
    expect(fetchedUrls().filter((url) => url === ROSTER_URL)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(socketMocks.subscribeCampaignInviteCreated).toHaveBeenCalledTimes(1);
    expect(socketMocks.subscribeCampaignInviteRevoked).toHaveBeenCalledTimes(1);
  });

  it("is a clean no-op when both flags are false: no fetch, no subscriptions, nothing rendered", () => {
    const { container } = render(
      <CampaignInvites campaignId={CAMPAIGN_ID} showCharactersNpcs={false} showPlayers={false} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(socketMocks.subscribeCampaignInviteCreated).not.toHaveBeenCalled();
    expect(socketMocks.subscribeCampaignInviteRevoked).not.toHaveBeenCalled();
  });

  it("unsubscribes invite listeners on unmount only when they were registered", async () => {
    const unsubscribeCreated = vi.fn();
    const unsubscribeRevoked = vi.fn();
    socketMocks.subscribeCampaignInviteCreated.mockReturnValue(unsubscribeCreated);
    socketMocks.subscribeCampaignInviteRevoked.mockReturnValue(unsubscribeRevoked);

    const playersOnly = render(
      <CampaignInvites campaignId={CAMPAIGN_ID} showPlayers={true} showCharactersNpcs={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Jogadores \(0\/1\)/)).toBeInTheDocument();
    });
    playersOnly.unmount();
    expect(unsubscribeCreated).toHaveBeenCalledTimes(1);
    expect(unsubscribeRevoked).toHaveBeenCalledTimes(1);

    const npcsOnly = render(
      <CampaignInvites campaignId={CAMPAIGN_ID} showCharactersNpcs={true} showPlayers={false} />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Personagens e NPCs \(1\)/)).toBeInTheDocument();
    });
    npcsOnly.unmount();
    // No new subscriptions were created, so no extra unsubscribe calls.
    expect(unsubscribeCreated).toHaveBeenCalledTimes(1);
    expect(unsubscribeRevoked).toHaveBeenCalledTimes(1);
  });
});
