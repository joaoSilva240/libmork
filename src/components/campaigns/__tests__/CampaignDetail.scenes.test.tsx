import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignDetail } from "../CampaignDetail";

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
// Mock autorizado (ruling do controller): o caso missing_zero renderizaria o
// MissingSessionLog real, que faz fetch de /ledger não coberto pelo mock e
// gera warning act(...) no output do teste.
vi.mock("@/components/systems/missing/MissingSessionLog", () => ({
  MissingSessionLog: () => <div data-testid="missing-session-log-mock" />,
}));
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
    isConnected: true,
    // CampaignDetail assina combat-state para a confirmação de troca (Fase 2).
    subscribeCombatState: vi.fn(() => vi.fn()),
    updateCombatState: vi.fn(),
  }),
}));

let campaignPayload: Record<string, unknown> = {};

describe("CampaignDetail — barra de cenas (issue #86, Fase 1)", () => {
  beforeEach(() => {
    localStorage.clear();
    campaignPayload = {
      id: "camp-1",
      name: "Campanha Teste",
      rulesEngine: "d20_mod",
      masterId: "m1",
      activeScene: "combat",
    };
    global.fetch = vi.fn((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({ ok: true, json: async () => ({ data: [] }) });
      }
      if (url.endsWith("/scene")) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ data: campaignPayload }) });
    }) as unknown as typeof fetch;
  });

  it("renderiza a SceneBar pré-selecionada com a cena do banco", async () => {
    render(<CampaignDetail />);
    await waitFor(() => screen.getByTestId("scene-bar"));
    expect(screen.getByTestId("scene-btn-combat")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Combate");
  });

  it("clique em outra cena dispara PATCH /scene", async () => {
    render(<CampaignDetail />);
    await waitFor(() => screen.getByTestId("scene-bar"));
    fireEvent.click(screen.getByTestId("scene-btn-stealth"));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/camp-1/scene",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("header recebe accent ring quando há cena ativa", async () => {
    render(<CampaignDetail />);
    const header = await waitFor(() => screen.getByTestId("shield-header"));
    expect(header.className).toContain("ring-1");
    expect(header.className).toContain("border-red-500/70");
  });

  it("campanha missing_zero não renderiza a SceneBar", async () => {
    campaignPayload = { ...campaignPayload, rulesEngine: "missing_zero" };
    render(<CampaignDetail />);
    await waitFor(() => screen.getByTestId("shield-header"));
    expect(screen.queryByTestId("scene-bar")).not.toBeInTheDocument();
  });
});
