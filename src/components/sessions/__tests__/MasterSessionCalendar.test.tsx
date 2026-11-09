import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CalendarEvent } from "@/components/calendar/CalendarGrid";
import type { SessionSummary } from "@/lib/server/session-service";

const { socketMocks, gridProps, launchedFixture } = vi.hoisted(() => ({
  socketMocks: {
    sendSessionPublish: vi.fn(),
    sendSessionConfirm: vi.fn(),
    sendSessionCancel: vi.fn(),
    subscribeSessionApplied: vi.fn(() => vi.fn()),
    subscribeSessionConfirmed: vi.fn(() => vi.fn()),
    subscribeSessionCancelled: vi.fn(() => vi.fn()),
  },
  gridProps: { current: null as null | { events: CalendarEvent[] } },
  launchedFixture: {
    current: {
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
    } as SessionSummary,
  },
}));

vi.mock("@/context/SocketContext", () => ({ useSocket: () => socketMocks }));

vi.mock("@/components/calendar/CalendarGrid", () => ({
  CalendarGrid: (props: {
    events: CalendarEvent[];
    onEventClick: (event: CalendarEvent) => void;
  }) => {
    gridProps.current = { events: props.events };
    return (
      <div data-testid="mock-calendar-grid">
        {props.events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            data-testid={`cal-event-${ev.id}`}
            onClick={() => props.onEventClick(ev)}
          >
            {ev.title}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("../SessionLaunchModal", () => ({
  SessionLaunchModal: ({
    isOpen,
    onLaunched,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onLaunched: (session: SessionSummary) => void;
  }) =>
    isOpen ? (
      <button
        type="button"
        data-testid="mock-launch-fired"
        onClick={() => onLaunched(launchedFixture.current)}
      >
        lançar
      </button>
    ) : null,
}));

vi.mock("../SessionDetailDrawer", () => ({
  SessionDetailDrawer: ({
    session,
    onConfirmed,
    onCancelled,
  }: {
    session: SessionSummary;
    isMaster: boolean;
    onClose: () => void;
    onConfirmed: (session: SessionSummary) => void;
    onCancelled: (sessionId: string) => void;
  }) => (
    <div data-testid="mock-drawer">
      <button
        type="button"
        data-testid="mock-confirm-fired"
        onClick={() => onConfirmed({ ...session, status: "confirmed" })}
      >
        confirmar
      </button>
      <button type="button" data-testid="mock-cancel-fired" onClick={() => onCancelled(session.id)}>
        cancelar
      </button>
    </div>
  ),
}));

let masterCalls = 0;

function stubFetch() {
  masterCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/sessions/master")) {
        masterCalls += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [launchedFixture.current] }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }),
  );
}

async function renderCalendar() {
  const { MasterSessionCalendar } = await import("../MasterSessionCalendar");
  render(<MasterSessionCalendar />);
  await screen.findByTestId("mock-calendar-grid");
}

describe("MasterSessionCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gridProps.current = null;
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renderiza grid com 1 evento (accent) e botão de lançar", async () => {
    await renderCalendar();
    expect(screen.getByTestId("launch-session-button")).toBeInTheDocument();
    const events = gridProps.current!.events;
    expect(events).toHaveLength(1);
    expect(events[0].tone).toBe("accent");
    expect(events[0].date).toBe("2026-12-01");
    expect(events[0].title).toBe("Strahd");
  });

  it("lançar sessão emite sendSessionPublish e refaz a busca", async () => {
    await renderCalendar();
    fireEvent.click(screen.getByTestId("launch-session-button"));
    fireEvent.click(await screen.findByTestId("mock-launch-fired"));

    await waitFor(() =>
      expect(socketMocks.sendSessionPublish).toHaveBeenCalledWith({
        campaignId: "c-1",
        session: launchedFixture.current,
      }),
    );
    await waitFor(() => expect(masterCalls).toBeGreaterThanOrEqual(2));
  });

  it("confirmar pelo drawer emite sendSessionConfirm e refaz a busca", async () => {
    await renderCalendar();
    fireEvent.click(screen.getByTestId("cal-event-s-1"));
    fireEvent.click(await screen.findByTestId("mock-confirm-fired"));

    await waitFor(() => expect(socketMocks.sendSessionConfirm).toHaveBeenCalled());
    expect(socketMocks.sendSessionConfirm.mock.calls[0][0]).toMatchObject({ campaignId: "c-1" });
    await waitFor(() => expect(masterCalls).toBeGreaterThanOrEqual(2));
  });

  it("cancelar pelo drawer emite sendSessionCancel e refaz a busca", async () => {
    await renderCalendar();
    fireEvent.click(screen.getByTestId("cal-event-s-1"));
    fireEvent.click(await screen.findByTestId("mock-cancel-fired"));

    await waitFor(() =>
      expect(socketMocks.sendSessionCancel).toHaveBeenCalledWith({
        campaignId: "c-1",
        sessionId: "s-1",
      }),
    );
    await waitFor(() => expect(masterCalls).toBeGreaterThanOrEqual(2));
  });
});
