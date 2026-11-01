import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    broadcastCampaignLogUpdate: vi.fn(),
  }),
}));

describe("Master Screen Elements Individual Resize Handles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders ResizeHandle directly on SessionLog", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    } as any);

    render(<SessionLog campaignId="camp-1" />);

    expect(screen.getByTestId("resize-session-log")).toBeInTheDocument();
    expect(screen.getByTestId("resize-session-log")).toHaveAttribute(
      "title",
      "Redimensionar log da sessão"
    );
  });

  it("renders ResizeHandle directly on MissingSessionLog (Boletim de Ocorrências)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as any);

    render(<MissingSessionLog campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("resize-missing-session-log")).toBeInTheDocument();
    });

    expect(screen.getByTestId("resize-missing-session-log")).toHaveAttribute(
      "title",
      "Redimensionar boletim de ocorrências"
    );
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

  it("hides resize-center-column when Mesa is popped out", async () => {
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

    const popOutButton = screen.getByText("Abrir Mesa");
    fireEvent.click(popOutButton);

    await waitFor(() => {
      expect(screen.queryByTestId("resize-center-column")).not.toBeInTheDocument();
    });
  });
});
