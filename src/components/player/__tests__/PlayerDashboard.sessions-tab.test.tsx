import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlayerDashboard } from "../PlayerDashboard";

const { socketMocks, feedProps } = vi.hoisted(() => ({
  socketMocks: {
    sendSessionApply: vi.fn(),
    subscribeSessionPublished: vi.fn(() => vi.fn()),
  },
  feedProps: [] as Array<{ currentUserId: string; onApplied: (c: string, s: string) => void }>,
}));

vi.mock("@/components/characters/CharacterCard", () => ({
  CharacterCard: () => <div data-testid="character-card" />,
}));
vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button data-testid="logout-button">Sair</button>,
}));
vi.mock("@/components/audio/JukeboxAudioBridge", () => ({
  JukeboxAudioBridge: () => null,
}));
vi.mock("@/components/sessions/PlayerCommunityHub", () => ({
  PlayerCommunityHub: ({ onToggleFullscreen }: { onToggleFullscreen?: () => void }) => (
    <div data-testid="mock-community-hub">
      {onToggleFullscreen && (
        <button type="button" data-testid="mock-fullscreen-toggle" onClick={onToggleFullscreen}>
          fullscreen
        </button>
      )}
    </div>
  ),
}));
vi.mock("@/components/sessions/SessionInviteFeed", () => ({
  SessionInviteFeed: (props: {
    currentUserId: string;
    onApplied: (campaignId: string, sessionId: string) => void;
  }) => {
    feedProps.push(props);
    return <div data-testid="mock-invite-feed" />;
  },
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false,
    presenceList: [],
    joinCampaign: vi.fn(),
    leaveCampaign: vi.fn(),
    sendSessionApply: socketMocks.sendSessionApply,
    subscribeSessionPublished: socketMocks.subscribeSessionPublished,
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

function stubFetch() {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    if (url === "/api/auth/me") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: "u-1", displayName: "Maria", email: "m@libmork.com", role: "player" },
          }),
      });
    }
    if (url === "/api/player/campaigns") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                id: "c-1",
                name: "Strahd",
                description: null,
                rulesEngine: "d20_mod",
                pvpEnabled: false,
                master: { id: "m-1", displayName: "João", email: "j@libmork.com" },
                characters: [],
              },
            ],
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });
  });
}

describe("PlayerDashboard — sub-aba Sessões (Issue #63)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedProps.length = 0;
    stubFetch();
  });

  it("mostra pills Campanhas/Sessões e renderiza o feed ao abrir Sessões", async () => {
    render(<PlayerDashboard />);
    fireEvent.click(await screen.findByLabelText("Campanhas"));

    await waitFor(() => expect(screen.getByTestId("campaigns-view-campanhas")).toBeInTheDocument());
    expect(screen.getByTestId("campaigns-view-sessions")).toBeInTheDocument();
    expect(screen.getByText("Strahd")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-invite-feed")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("campaigns-view-sessions"));
    expect(await screen.findByTestId("mock-invite-feed")).toBeInTheDocument();
    expect(screen.queryByText("Strahd")).not.toBeInTheDocument();
  });

  it("candidatura no feed emite sendSessionApply e mostra toast", async () => {
    render(<PlayerDashboard />);
    fireEvent.click(await screen.findByLabelText("Campanhas"));
    fireEvent.click(await screen.findByTestId("campaigns-view-sessions"));
    await screen.findByTestId("mock-invite-feed");

    const props = feedProps[feedProps.length - 1];
    expect(props.currentUserId).toBe("u-1");
    props.onApplied("c-1", "s-1");

    expect(socketMocks.sendSessionApply).toHaveBeenCalledWith({
      campaignId: "c-1",
      sessionId: "s-1",
    });
    expect(await screen.findByText("Candidatura enviada!")).toBeInTheDocument();
  });

  it("tela cheia na comunidade oculta navbar e bottom nav e volta ao normal", async () => {
    render(<PlayerDashboard />);
    fireEvent.click(await screen.findByLabelText("Comunidade"));
    fireEvent.click(await screen.findByTestId("mock-fullscreen-toggle"));

    expect(screen.queryByText("Gerencie seus heróis e campanhas")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Navegação principal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-fullscreen-toggle"));
    expect(screen.getByText("Gerencie seus heróis e campanhas")).toBeInTheDocument();
    expect(screen.getByLabelText("Navegação principal")).toBeInTheDocument();
  });
});
