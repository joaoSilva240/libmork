import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CampaignDetail } from "../CampaignDetail";
import {
  SHIELD_CENTER_MIN,
  SHIELD_GRID_GAP,
  SHIELD_LEFT_MIN,
  getShieldGridTemplate,
} from "@/lib/layout/shieldColumns";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: () => <div data-testid="master-roster-mock" />,
}));
vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: () => <div data-testid="campaign-invites" />,
}));
vi.mock("@/components/campaigns/ContentOverlay", () => ({ ContentOverlay: () => null }));
vi.mock("@/components/campaigns/WorldOverlay", () => ({ WorldOverlay: () => null }));
vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="mock-master-jukebox" />,
}));
vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="session-log-mock" />,
}));
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    WindowPortal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
      isOpen ? <div data-testid="window-portal-mock">{children}</div> : null,
  };
});
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
    isConnected: true,
    // CampaignDetail assina combat-state para a confirmação de troca (Fase 2).
    subscribeCombatState: vi.fn(() => vi.fn()),
    updateCombatState: vi.fn(),
  }),
}));

const GRID_WIDTH = 1100;

function px(value: string): number {
  return parseFloat(value.replace("px", ""));
}

function drag(handle: HTMLElement, dx: number) {
  Object.assign(handle, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn().mockReturnValue(true),
  });
  fireEvent.pointerDown(handle, { pointerId: 1, clientX: 500, clientY: 0 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500 + dx, clientY: 0 });
  fireEvent.pointerUp(handle, { pointerId: 1, clientX: 500 + dx, clientY: 0 });
}

describe("CampaignDetail — contenção do grid do escudo", () => {
  let clientWidthSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    if (!globalThis.PointerEvent) {
      class TestPointerEvent extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      }
      Object.defineProperty(globalThis, "PointerEvent", { value: TestPointerEvent, configurable: true });
    }
    clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset?.testid === "shield-grid" ? GRID_WIDTH : 0;
      });
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: { id: "camp-1", name: "Test Campaign", rulesEngine: "d20_mod" } }),
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    clientWidthSpy.mockRestore();
  });

  async function renderGrid() {
    render(<CampaignDetail />);
    return waitFor(() => screen.getByTestId("shield-grid"));
  }

  function centerWidth(grid: HTMLElement) {
    const left = px(grid.style.getPropertyValue("--w-l"));
    const right = px(grid.style.getPropertyValue("--w-r"));
    return GRID_WIDTH - 2 * SHIELD_GRID_GAP - left - right;
  }

  it("usa coluna central elástica e laterais contidas no template do grid", async () => {
    const grid = await renderGrid();
    expect(grid.style.getPropertyValue("--libmork-columns")).toBe(getShieldGridTemplate(true));
    expect(grid.style.getPropertyValue("--w-l")).toBe("240px");
    expect(grid.style.getPropertyValue("--w-r")).toBe("260px");
    expect(grid.className).toContain("min-w-0");
  });

  it("trava o crescimento da coluna de gestão para preservar o mínimo da mesa", async () => {
    const grid = await renderGrid();
    drag(screen.getByTestId("resize-right-column"), -160);
    expect(grid.style.getPropertyValue("--w-r")).toBe("420px");

    drag(screen.getByTestId("resize-left-column"), 500);
    expect(centerWidth(grid)).toBeGreaterThanOrEqual(SHIELD_CENTER_MIN);
    expect(centerWidth(grid)).toBe(SHIELD_CENTER_MIN);
  });

  it("trava o crescimento da coluna de logs (via handle da mesa) para preservar o mínimo da mesa", async () => {
    const grid = await renderGrid();
    drag(screen.getByTestId("resize-left-column"), 140);
    expect(grid.style.getPropertyValue("--w-l")).toBe("380px");

    drag(screen.getByTestId("resize-center-column"), -500);
    expect(centerWidth(grid)).toBe(SHIELD_CENTER_MIN);
  });

  it("permite encolher as laterais apenas até o mínimo legível", async () => {
    const grid = await renderGrid();
    drag(screen.getByTestId("resize-left-column"), -500);
    expect(grid.style.getPropertyValue("--w-l")).toBe(`${SHIELD_LEFT_MIN}px`);
  });

  it("ajusta larguras persistidas grandes demais ao espaço disponível", async () => {
    localStorage.setItem("libmork:campaign-left-panel:camp-1-width", "380");
    localStorage.setItem("libmork:campaign-right-panel:camp-1-width", "420");
    const grid = await renderGrid();
    await waitFor(() => expect(centerWidth(grid)).toBeGreaterThanOrEqual(SHIELD_CENTER_MIN));
  });

  it("distribui a altura da coluna de gestão em flex, sem altura fixa no painel de mundos", async () => {
    const grid = await renderGrid();
    const leftColumn = grid.firstElementChild as HTMLElement;

    expect(leftColumn.className).toContain("flex-col");
    expect(leftColumn.className).toContain("gap-3");
    expect(leftColumn.className).toContain("min-h-0");

    const worldsHeading = await screen.findByRole("heading", { name: "Mundos" });
    const worldsPanel = worldsHeading.parentElement as HTMLElement;
    expect(worldsPanel.style.height).toBe("");
    expect(worldsPanel.style.flexBasis).toBe("320px");
    expect(worldsPanel.className).toContain("lg:flex-1");
    expect(worldsPanel.className).toContain("lg:min-h-[180px]");
  });
});
