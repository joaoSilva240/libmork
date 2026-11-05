import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterAssetsPanel } from "../MasterAssetsPanel";
import { useSocket } from "@/context/SocketContext";

vi.mock("@/context/SocketContext", () => ({
  useSocket: vi.fn(),
}));

const mockActivateCampaignAsset = vi.fn();
const mockDeactivateCampaignAsset = vi.fn();
const mockSubscribeCampaignAssetActivated = vi.fn(() => vi.fn());
const mockSubscribeCampaignAssetDeactivated = vi.fn(() => vi.fn());

const mockAssets = [
  {
    id: "asset-1",
    campaignId: "c1",
    name: "Mapa do Reino",
    description: "Visão geográfica das terras sombrias.",
    imageUrl: "https://example.com/map.jpg",
    category: "map",
    position: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "asset-2",
    campaignId: "c1",
    name: "Emblema do Culto",
    description: null,
    imageUrl: "https://example.com/symbol.png",
    category: "handout",
    position: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("MasterAssetsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useSocket).mockReturnValue({
      activeAsset: null,
      activateCampaignAsset: mockActivateCampaignAsset,
      deactivateCampaignAsset: mockDeactivateCampaignAsset,
      subscribeCampaignAssetActivated: mockSubscribeCampaignAssetActivated,
      subscribeCampaignAssetDeactivated: mockSubscribeCampaignAssetDeactivated,
    } as any);

    global.fetch = vi.fn().mockImplementation(async (url: string, options?: any) => {
      if (url.includes("/api/campaigns/c1/assets") && (!options || !options.method || options.method === "GET")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockAssets }),
        };
      }
      if (url.includes("/activate")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockAssets[0] }),
        };
      }
      if (url.includes("/deactivate")) {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      if (options?.method === "DELETE") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    }) as any;
  });

  it("renderiza lista de assets com nomes e categorias", async () => {
    render(<MasterAssetsPanel campaignId="c1" />);

    expect(screen.getByText("Assets & Handouts")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Mapa do Reino")).toBeInTheDocument();
      expect(screen.getByText("Emblema do Culto")).toBeInTheDocument();
    });

    expect(screen.getByText("Visão geográfica das terras sombrias.")).toBeInTheDocument();
  });

  it("dispara ativação de asset chamando API e emitindo evento no socket", async () => {
    render(<MasterAssetsPanel campaignId="c1" />);

    await waitFor(() => {
      expect(screen.getByText("Mapa do Reino")).toBeInTheDocument();
    });

    const activateBtns = screen.getAllByRole("button", { name: /apresentar aos jogadores/i });
    expect(activateBtns.length).toBeGreaterThan(0);

    fireEvent.click(activateBtns[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/c1/assets/asset-1/activate",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockActivateCampaignAsset).toHaveBeenCalledWith({
        campaignId: "c1",
        asset: mockAssets[0],
      });
    });

    // Badge "ATIVO NA MESA" e botão "Ocultar da Mesa" aparecem
    expect(await screen.findByText("ATIVO NA MESA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ocultar da mesa/i })).toBeInTheDocument();
  });

  it("dispara desativação de asset chamando API e emitindo evento no socket", async () => {
    // Começa com asset-1 como ativo
    render(<MasterAssetsPanel campaignId="c1" initialActiveAssetId="asset-1" />);

    await waitFor(() => {
      expect(screen.getByText("Mapa do Reino")).toBeInTheDocument();
    });

    const deactivateBtn = await screen.findByRole("button", { name: /ocultar da mesa/i });
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/c1/assets/deactivate",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mockDeactivateCampaignAsset).toHaveBeenCalledWith({
        campaignId: "c1",
      });
    });

    // Asset não está mais ativo
    expect(screen.queryByText("ATIVO NA MESA")).not.toBeInTheDocument();
  });

  it("permite exclusão de asset com confirmação", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MasterAssetsPanel campaignId="c1" />);

    await waitFor(() => {
      expect(screen.getByText("Mapa do Reino")).toBeInTheDocument();
      expect(screen.getByText("Emblema do Culto")).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByRole("button", { name: /excluir asset/i });
    fireEvent.click(deleteBtns[1]); // Exclui o segundo asset (Emblema do Culto)

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/campaigns/c1/assets/asset-2",
        expect.objectContaining({ method: "DELETE" }),
      );
      expect(screen.queryByText("Emblema do Culto")).not.toBeInTheDocument();
    });
  });
});
