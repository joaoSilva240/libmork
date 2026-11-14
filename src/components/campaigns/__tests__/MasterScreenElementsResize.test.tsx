import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionLog } from "../SessionLog";
import { MissingSessionLog } from "@/components/systems/missing/MissingSessionLog";
import { CampaignDetail } from "../CampaignDetail";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: ({ onTogglePopOut }: { onTogglePopOut?: () => void }) => (
    <div data-testid="master-roster-mock">
      {onTogglePopOut && <button onClick={onTogglePopOut}>Abrir Mesa</button>}
    </div>
  ),
}));

vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: () => <div data-testid="campaign-invites" />,
}));

vi.mock("@/components/campaigns/ContentOverlay", () => ({
  ContentOverlay: () => null,
}));

vi.mock("@/components/campaigns/WorldOverlay", () => ({
  WorldOverlay: () => null,
}));

vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="mock-master-jukebox" />,
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
    isConnected: true,
    subscribeCampaignLogCreated: vi.fn(() => vi.fn()),
    subscribeCampaignLogUpdated: vi.fn(() => vi.fn()),
    subscribeDiceRoll: vi.fn(() => vi.fn()),
    // CampaignDetail assina combat-state para a confirmação de troca (Fase 2).
    subscribeCombatState: vi.fn(() => vi.fn()),
    updateCombatState: vi.fn(),
    broadcastCampaignLogUpdate: vi.fn(),
  }),
}));

describe("Master Screen Elements Individual Resize Handles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("faz o card do SessionLog preencher a coluna, sem altura fixa nem teto de scroll", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    render(<SessionLog campaignId="camp-1" />);

    const card = screen.getByTestId("session-log");
    expect(card.className).toContain("h-full");
    expect(card.className).toContain("flex-1");
    expect(card.style.height).toBe("");

    const scroll = card.querySelector(".overflow-y-auto") as HTMLElement;
    expect(scroll.className).toContain("lg:flex-1");
    expect(scroll.className).toContain("lg:max-h-none");
    expect(screen.queryByTestId("resize-session-log")).not.toBeInTheDocument();
  });

  it("faz o MissingSessionLog preencher a coluna, sem altura fixa (Boletim de Ocorrências)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as any);

    render(<MissingSessionLog campaignId="camp-1" />);

    const card = await screen.findByTestId("missing-session-log");
    expect(card.className).toContain("h-full");
    expect(card.className).toContain("flex-1");
    expect(card.style.height).toBe("");
    expect(screen.queryByTestId("resize-missing-session-log")).not.toBeInTheDocument();
  });

  it("renders ResizeHandle for the central Mesa column (resize-center-column)", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/worlds") || url.includes("/logs")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            id: "camp-1",
            name: "Test Campaign",
            rulesEngine: "d20_mod",
          },
        }),
      });
    }) as any;

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("resize-center-column")).toBeInTheDocument();
    });

    const handle = screen.getByTestId("resize-center-column");
    expect(handle).toHaveAttribute("title", "Redimensionar coluna da mesa");
  });
});
