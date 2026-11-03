import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionLog } from "../SessionLog";
import { MissingSessionLog } from "@/components/systems/missing/MissingSessionLog";
import { CampaignDetail } from "../CampaignDetail";
import { masterScreenConfigKey } from "@/hooks/useMasterScreenConfig";

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

  it("renderiza o grid de colunas com tracks minmax e vars --w-l/--w-c/--w-r (auto-correção de largura)", async () => {
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

    const grid = document.querySelector(".libmork-master-grid");
    expect(grid).not.toBeNull();

    const gridClass = (grid as HTMLElement).className;
    expect(gridClass).toContain("libmork-master-grid");
    expect(gridClass).not.toContain("libmork-master-grid-slim");
    expect(gridClass).not.toContain("libmork-master-grid-popped");
    expect(gridClass).toContain("grid-cols-1");
    expect(gridClass).not.toContain("--libmork-columns");
    expect(gridClass).not.toContain("minmax");

    const style = (grid as HTMLElement).style;
    expect(style.getPropertyValue("--w-l")).toBe("240px");
    expect(style.getPropertyValue("--w-c")).toBe("640px");
    expect(style.getPropertyValue("--w-r")).toBe("260px");
  });

  it("renderiza o grid slim quando showSessionLog=false e mantém --w-r inutilizada sem regra", async () => {
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

    localStorage.setItem(
      masterScreenConfigKey,
      JSON.stringify({ showSessionLog: false })
    );

    render(<CampaignDetail />);

    await waitFor(() => {
      expect(screen.getByTestId("resize-center-column")).toBeInTheDocument();
    });

    const grid = document.querySelector(".libmork-master-grid-slim");
    expect(grid).not.toBeNull();
    expect(document.querySelector(".libmork-master-grid")).toBeNull();

    const gridClass = (grid as HTMLElement).className;
    expect(gridClass).toContain("libmork-master-grid-slim");
    expect(gridClass).not.toContain("libmork-master-grid-popped");

    // --w-r inutilizada é inofensiva: não existe regra CSS que a consuma no slim
    const style = (grid as HTMLElement).style;
    expect(style.getPropertyValue("--w-r")).toBe("260px");
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

    const poppedGrid = document.querySelector(".libmork-master-grid-popped");
    expect(poppedGrid).not.toBeNull();

    const poppedClass = (poppedGrid as HTMLElement).className;
    expect(poppedClass).not.toContain("libmork-master-grid-slim");
    expect((poppedGrid as HTMLElement).classList.contains("libmork-master-grid")).toBe(false);

    // isMesaPopped=true → style é undefined (sem vars --w-*)
    expect((poppedGrid as HTMLElement).style.getPropertyValue("--w-l")).toBe("");
    expect((poppedGrid as HTMLElement).style.getPropertyValue("--w-c")).toBe("");
    expect((poppedGrid as HTMLElement).style.getPropertyValue("--w-r")).toBe("");
  });
});
