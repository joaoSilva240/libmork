import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionDetailDrawer } from "../SessionDetailDrawer";
import type { SessionSummary } from "@/lib/server/session-service";

const mockSession: SessionSummary = {
  id: "s-1",
  campaignId: "c-1",
  campaignName: "Strahd",
  coverImageUrl: null,
  masterId: "m-1",
  masterName: "João",
  masterAvatar: null,
  description: "Sessão de abertura em Barovia",
  proposedStart: "2026-12-01T03:00:00.000Z",
  proposedEnd: "2026-12-04T02:59:59.000Z",
  scheduledAt: null,
  durationMinutes: 240,
  xpReward: 500,
  sessionType: "one_shot",
  maxSlots: 5,
  acceptedCount: 1,
  interestedCount: 1,
  remainingSlots: 4,
  status: "proposed",
  userApplication: null,
  createdAt: new Date().toISOString(),
};

const mockCandidate = {
  userId: "u-2",
  displayName: "Maria",
  avatarUrl: null,
  characterId: "ch-1",
  characterName: "Artemis",
  availableDays: ["2026-12-01", "2026-12-02"],
  preferredStart: "19:00",
  preferredEnd: "23:00",
  allDay: false,
  status: "interested",
  appliedAt: new Date().toISOString(),
};

let patchSpy = vi.fn();
let candidatesResponse: unknown = { success: true, data: [mockCandidate] };

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/candidates/") && init?.method === "PATCH") {
        patchSpy(url, init);
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: { ...mockCandidate, status: "accepted" } }),
        });
      }
      if (url.includes("/candidates")) {
        return Promise.resolve({ ok: true, json: async () => candidatesResponse });
      }
      if (url.includes("/api/sessions/") && init?.method === "PATCH") {
        patchSpy(url, init);
        const body = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data:
              body.action === "confirm"
                ? { ...mockSession, status: "confirmed", scheduledAt: "2026-12-02T23:00:00.000Z" }
                : { ...mockSession, status: "cancelled" },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }),
  );
}

function renderDrawer(overrides: Partial<Parameters<typeof SessionDetailDrawer>[0]> = {}) {
  const props = {
    session: mockSession,
    isMaster: true,
    onClose: vi.fn(),
    onConfirmed: vi.fn(),
    onCancelled: vi.fn(),
    ...overrides,
  };
  render(<SessionDetailDrawer {...props} />);
  return props;
}

describe("SessionDetailDrawer", () => {
  beforeEach(() => {
    patchSpy = vi.fn();
    candidatesResponse = { success: true, data: [mockCandidate] };
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("mestre vê panorama de candidaturas e aceita candidato", async () => {
    renderDrawer();
    expect(await screen.findByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("Artemis")).toBeInTheDocument();
    expect(screen.getByText("19:00 – 23:00")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("candidate-accept-u-2"));
    await waitFor(() => expect(patchSpy).toHaveBeenCalled());
    const [url, init] = patchSpy.mock.calls[0];
    expect(url).toBe("/api/sessions/s-1/candidates/u-2");
    expect(JSON.parse(init.body as string)).toEqual({ decision: "accepted" });
  });

  it("candidato com allDay exibe 'Livre o dia todo'", async () => {
    candidatesResponse = { success: true, data: [{ ...mockCandidate, allDay: true }] };
    renderDrawer();
    expect(await screen.findByText("Livre o dia todo")).toBeInTheDocument();
  });

  it("confirma sessão com data e duração via modal", async () => {
    const { onConfirmed } = renderDrawer();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByTestId("confirm-session-button"));
    fireEvent.change(screen.getByTestId("confirm-datetime"), {
      target: { value: "2026-12-02T20:00" },
    });
    fireEvent.change(screen.getByTestId("confirm-duration"), { target: { value: "180" } });
    fireEvent.click(screen.getByTestId("confirm-session-submit"));

    await waitFor(() => expect(onConfirmed).toHaveBeenCalled());
    const confirmCall = patchSpy.mock.calls.find(([url]) => url === "/api/sessions/s-1");
    expect(confirmCall).toBeDefined();
    const body = JSON.parse(confirmCall![1].body as string);
    expect(body.action).toBe("confirm");
    expect(body.scheduledAt).toBe(new Date("2026-12-02T20:00").toISOString());
    expect(body.durationMinutes).toBe(180);
    expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({ status: "confirmed" }));
  });

  it("cancela sessão em dois passos", async () => {
    const { onCancelled } = renderDrawer();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByTestId("cancel-session-button"));
    fireEvent.click(screen.getByTestId("confirm-cancel-session"));

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith("s-1"));
    const cancelCall = patchSpy.mock.calls.find(([url]) => url === "/api/sessions/s-1");
    expect(JSON.parse(cancelCall![1].body as string)).toEqual({ action: "cancel" });
  });

  it("não-mestre não vê botões de gestão e vê própria candidatura", async () => {
    const sessionWithApplication = {
      ...mockSession,
      userApplication: {
        status: "interested" as const,
        availableDays: ["2026-12-01"],
        allDay: true,
        preferredStart: null,
        preferredEnd: null,
        characterId: null,
      },
    };
    renderDrawer({ session: sessionWithApplication, isMaster: false });

    await waitFor(() => expect(screen.getByText(/Candidatura enviada/i)).toBeInTheDocument());
    expect(screen.queryByTestId("confirm-session-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-session-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("candidate-accept-u-2")).not.toBeInTheDocument();
  });
});
