import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { socketMocks } = vi.hoisted(() => ({
  socketMocks: {
    joinCampaign: vi.fn(),
    leaveCampaign: vi.fn(),
    subscribeSessionPublished: vi.fn(() => vi.fn()),
    subscribeSessionConfirmed: vi.fn(() => vi.fn()),
    subscribeSessionCancelled: vi.fn(() => vi.fn()),
  },
}));

vi.mock("@/context/SocketContext", () => ({ useSocket: () => socketMocks }));
vi.mock("@/components/chat/CampaignChat", () => ({
  CampaignChat: () => <div data-testid="mock-campaign-chat" />,
}));
vi.mock("../PlayerSessionCalendar", () => ({
  PlayerSessionCalendar: () => <div data-testid="mock-player-calendar" />,
}));

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/player/campaigns")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [{ id: "c-1" }] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }),
  );
}

const currentUser = { id: "u-1", displayName: "Maria", avatarUrl: null };

async function renderHub(extra: { isFullscreen?: boolean; onToggleFullscreen?: () => void } = {}) {
  const { PlayerCommunityHub } = await import("../PlayerCommunityHub");
  const utils = render(<PlayerCommunityHub currentUser={currentUser} {...extra} />);
  await waitFor(() => expect(socketMocks.joinCampaign).toHaveBeenCalled());
  return utils;
}

describe("PlayerCommunityHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renderiza 2 sub-abas com Groups ativo por padrão", async () => {
    await renderHub();
    expect(screen.getByTestId("hub-tab-groups")).toBeInTheDocument();
    expect(screen.getByTestId("hub-tab-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("hub-tab-invites")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-campaign-chat")).toBeInTheDocument();
  });

  it("alterna para calendário, persiste no localStorage e restaura na remontagem", async () => {
    await renderHub();
    fireEvent.click(screen.getByTestId("hub-tab-calendar"));
    expect(screen.getByTestId("mock-player-calendar")).toBeInTheDocument();
    expect(window.localStorage.getItem("libmork.communityHubTab")).toBe("calendar");

    const { PlayerCommunityHub } = await import("../PlayerCommunityHub");
    render(<PlayerCommunityHub currentUser={currentUser} />);
    expect(await screen.findAllByTestId("mock-player-calendar")).toBeTruthy();
  });

  it("entra na sala da campanha no mount e sai no unmount", async () => {
    const { unmount } = await renderHub();
    expect(socketMocks.joinCampaign).toHaveBeenCalledWith({
      campaignId: "c-1",
      role: "player",
    });
    unmount();
    expect(socketMocks.leaveCampaign).toHaveBeenCalledWith("c-1");
  });

  it("botão de tela cheia alterna isFullscreen via onToggleFullscreen", async () => {
    const onToggleFullscreen = vi.fn();
    await renderHub({ onToggleFullscreen });
    const toggle = screen.getByTestId("hub-fullscreen-toggle");
    expect(toggle).toHaveAttribute("aria-label", "Tela cheia");
    fireEvent.click(toggle);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("em tela cheia o botão vira 'Sair da tela cheia'", async () => {
    await renderHub({ isFullscreen: true, onToggleFullscreen: vi.fn() });
    expect(screen.getByTestId("hub-fullscreen-toggle")).toHaveAttribute(
      "aria-label",
      "Sair da tela cheia",
    );
  });
});
