import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionInviteFeed } from "../SessionInviteFeed";

const baseSession = {
  id: "s-1",
  campaignId: "c-1",
  campaignName: "Strahd",
  coverImageUrl: null,
  masterId: "m-1",
  masterName: "João",
  masterAvatar: null,
  description: "Sessão de abertura em Barovia, onde a névoa engole os incautos.",
  proposedStart: "2026-12-01T12:00:00.000Z",
  proposedEnd: "2026-12-03T12:00:00.000Z",
  scheduledAt: null,
  durationMinutes: 240,
  xpReward: 500,
  sessionType: "one_shot",
  maxSlots: 5,
  acceptedCount: 1,
  interestedCount: 2,
  remainingSlots: 4,
  status: "proposed",
  userApplication: null,
  createdAt: new Date().toISOString(),
};

let feedResponses: unknown[] = [];
let feedCalls: string[] = [];

function stubFetch() {
  feedCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/sessions")) {
        feedCalls.push(url);
        const body = feedResponses.shift() ?? {
          success: true,
          data: { items: [], page: 1, hasMore: false },
        };
        return Promise.resolve({ ok: true, json: async () => body });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) });
    }),
  );
}

function renderFeed(onApplied = vi.fn()) {
  render(<SessionInviteFeed currentUserId="u-9" onApplied={onApplied} />);
  return onApplied;
}

describe("SessionInviteFeed", () => {
  beforeEach(() => {
    feedResponses = [];
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renderiza card com campanha, mestre, sinopse e badges", async () => {
    feedResponses = [
      { success: true, data: { items: [baseSession], page: 1, hasMore: false } },
    ];
    renderFeed();

    expect(await screen.findByTestId("session-invite-s-1")).toBeInTheDocument();
    expect(screen.getByText("Strahd")).toBeInTheDocument();
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText(/Sessão de abertura em Barovia/)).toBeInTheDocument();
    expect(screen.getByText("One-shot")).toBeInTheDocument();
    expect(screen.getByText("4 vagas")).toBeInTheDocument();
    expect(screen.getByText("XP 500")).toBeInTheDocument();
  });

  it("clique no card abre detalhe com botão de interesse", async () => {
    feedResponses = [
      { success: true, data: { items: [baseSession], page: 1, hasMore: false } },
    ];
    renderFeed();

    fireEvent.click(await screen.findByTestId("session-invite-s-1"));
    expect(await screen.findByTestId("apply-interest-button")).toBeInTheDocument();
  });

  it("com userApplication mostra 'Candidatura enviada' sem botão de interesse", async () => {
    feedResponses = [
      {
        success: true,
        data: {
          items: [
            {
              ...baseSession,
              userApplication: {
                status: "interested",
                availableDays: ["2026-12-01"],
                allDay: true,
                preferredStart: null,
                preferredEnd: null,
                characterId: null,
              },
            },
          ],
          page: 1,
          hasMore: false,
        },
      },
    ];
    renderFeed();

    fireEvent.click(await screen.findByTestId("session-invite-s-1"));
    expect(await screen.findByText(/Candidatura enviada/i)).toBeInTheDocument();
    expect(screen.queryByTestId("apply-interest-button")).not.toBeInTheDocument();
  });

  it("feed vazio mostra estado próprio", async () => {
    feedResponses = [{ success: true, data: { items: [], page: 1, hasMore: false } }];
    renderFeed();
    expect(
      await screen.findByText("Nenhum convite de sessão no momento."),
    ).toBeInTheDocument();
  });

  it("load-more-invites busca página 2 e anexa itens", async () => {
    feedResponses = [
      { success: true, data: { items: [baseSession], page: 1, hasMore: true } },
      {
        success: true,
        data: { items: [{ ...baseSession, id: "s-2" }], page: 2, hasMore: false },
      },
    ];
    renderFeed();

    await screen.findByTestId("session-invite-s-1");
    fireEvent.click(screen.getByTestId("load-more-invites"));

    await waitFor(() => expect(screen.getByTestId("session-invite-s-2")).toBeInTheDocument());
    expect(screen.getByTestId("session-invite-s-1")).toBeInTheDocument();
    expect(feedCalls[1]).toContain("page=2");
    expect(screen.queryByTestId("load-more-invites")).not.toBeInTheDocument();
  });
});
