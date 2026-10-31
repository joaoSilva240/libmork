import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionLog } from "../SessionLog";
import { MissingSessionLog } from "@/components/systems/missing/MissingSessionLog";

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
});
