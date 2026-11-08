import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplySessionModal } from "../ApplySessionModal";
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
  proposedStart: "2026-12-01T12:00:00.000Z",
  proposedEnd: "2026-12-03T12:00:00.000Z",
  scheduledAt: null,
  durationMinutes: 240,
  xpReward: null,
  sessionType: "one_shot",
  maxSlots: 5,
  acceptedCount: 1,
  interestedCount: 0,
  remainingSlots: 4,
  status: "proposed",
  userApplication: null,
  createdAt: new Date().toISOString(),
};

let postSpy = vi.fn();

function stubFetch() {
  postSpy = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/characters")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [{ id: "ch-1", name: "Artemis" }] }),
        });
      }
      if (url.includes("/candidates") && init?.method === "POST") {
        postSpy(url, init);
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }),
  );
}

function renderModal(onApplied = vi.fn()) {
  render(
    <ApplySessionModal session={mockSession} isOpen onClose={vi.fn()} onApplied={onApplied} />,
  );
  return onApplied;
}

describe("ApplySessionModal", () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it("envia candidatura com dias, horário e personagem", async () => {
    const onApplied = renderModal();
    await screen.findByTestId("apply-day-2026-12-01");
    expect(screen.getByTestId("apply-day-2026-12-02")).toBeInTheDocument();
    expect(screen.getByTestId("apply-day-2026-12-03")).toBeInTheDocument();
    expect((screen.getByTestId("apply-all-day") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByTestId("apply-day-2026-12-01"));
    fireEvent.click(screen.getByTestId("apply-day-2026-12-02"));
    fireEvent.click(screen.getByTestId("apply-all-day"));
    fireEvent.change(screen.getByTestId("apply-time-start"), { target: { value: "19:00" } });
    fireEvent.change(screen.getByTestId("apply-time-end"), { target: { value: "23:00" } });
    fireEvent.change(screen.getByTestId("apply-character-select"), {
      target: { value: "ch-1" },
    });
    fireEvent.click(screen.getByTestId("apply-submit"));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, init] = postSpy.mock.calls[0];
    expect(url).toBe("/api/sessions/s-1/candidates");
    expect(JSON.parse(init.body as string)).toEqual({
      characterId: "ch-1",
      availableDays: ["2026-12-01", "2026-12-02"],
      preferredStart: "19:00",
      preferredEnd: "23:00",
    });
    expect(onApplied).toHaveBeenCalledWith("c-1", "s-1");
  });

  it("com allDay ligado não envia horários", async () => {
    renderModal();
    await screen.findByTestId("apply-day-2026-12-01");
    fireEvent.click(screen.getByTestId("apply-day-2026-12-01"));
    fireEvent.change(screen.getByTestId("apply-character-select"), {
      target: { value: "ch-1" },
    });
    fireEvent.click(screen.getByTestId("apply-submit"));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const body = JSON.parse(postSpy.mock.calls[0][1].body as string);
    expect(body.availableDays).toEqual(["2026-12-01"]);
    expect(body.preferredStart).toBeUndefined();
    expect(body.preferredEnd).toBeUndefined();
  });

  it("sem dia selecionado mostra erro e não faz POST", async () => {
    renderModal();
    await screen.findByTestId("apply-day-2026-12-01");
    fireEvent.click(screen.getByTestId("apply-submit"));
    await waitFor(() =>
      expect(screen.getByText(/ao menos um dia/i)).toBeInTheDocument(),
    );
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("candidatar-se sem ficha envia characterId null", async () => {
    renderModal();
    await screen.findByTestId("apply-day-2026-12-01");
    fireEvent.click(screen.getByTestId("apply-day-2026-12-01"));
    fireEvent.click(screen.getByTestId("apply-submit"));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    expect(JSON.parse(postSpy.mock.calls[0][1].body as string).characterId).toBeNull();
  });
});
