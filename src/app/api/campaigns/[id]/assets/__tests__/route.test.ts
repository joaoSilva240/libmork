import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { POST as activatePOST } from "../[assetId]/activate/route";
import { POST as deactivatePOST } from "../deactivate/route";

// Mocks
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/campaign-access", () => ({
  getCampaignAsMaster: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const { requireAuth } = await import("@/lib/auth/session");
const { getCampaignAsMaster } = await import("@/lib/auth/campaign-access");

describe("/api/campaigns/[id]/assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/campaigns/[id]/assets", () => {
    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      vi.mocked(requireAuth).mockResolvedValue(null as any);

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets");
      const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Não autenticado");
    });

    it("deve retornar 404 se usuário não tiver acesso à campanha", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-unknown", name: "Invasor" },
        session: { id: "s1" },
      } as any);

      // Select campaign returns empty (or masterId not matching)
      const mockLimitCamp = vi.fn().mockResolvedValue([]);
      const mockWhereCamp = vi.fn().mockReturnValue({ limit: mockLimitCamp });

      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: mockWhereCamp,
        }),
      });

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets");
      const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Campanha não encontrada ou acesso negado");
    });

    it("deve retornar 200 com array ordenado de assets quando autorizado", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Mestre" },
        session: { id: "s1" },
      } as any);

      // Check campaign access: user is master
      const mockLimitCamp = vi.fn().mockResolvedValue([{ masterId: "master-1" }]);
      const mockWhereCamp = vi.fn().mockReturnValue({ limit: mockLimitCamp });

      // Query assets
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: "asset-1",
          campaignId: "c1",
          name: "Mapa da Masmorra",
          description: "Mapa do primeiro andar",
          imageUrl: "/uploads/map1.png",
          category: "map",
          position: 0,
          createdAt: new Date("2026-11-01T00:00:00Z"),
          updatedAt: new Date("2026-11-01T00:00:00Z"),
        },
        {
          id: "asset-2",
          campaignId: "c1",
          name: "Carta do Rei",
          description: "Documento selado",
          imageUrl: "/uploads/letter.png",
          category: "handout",
          position: 1,
          createdAt: new Date("2026-11-02T00:00:00Z"),
          updatedAt: new Date("2026-11-02T00:00:00Z"),
        },
      ]);
      const mockWhereAssets = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

      mockSelect
        .mockReturnValueOnce({ from: () => ({ where: mockWhereCamp }) })
        .mockReturnValueOnce({ from: () => ({ where: mockWhereAssets }) });

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets");
      const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].name).toBe("Mapa da Masmorra");
      expect(json.data[1].category).toBe("handout");
    });
  });

  describe("POST /api/campaigns/[id]/assets", () => {
    it("deve retornar 403 se o usuário não for o mestre", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "player-1", name: "Jogador" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Asset Proibido",
          imageUrl: "https://example.com/asset.png",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Apenas o mestre pode adicionar assets à campanha");
    });

    it("deve retornar 400 se o payload for inválido", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Mestre" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      // Payload sem name nem imageUrl
      const request = new NextRequest("http://localhost/api/campaigns/c1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "invalid-category",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Dados inválidos");
      expect(json.errors).toBeDefined();
    });

    it("deve criar asset com sucesso (201) quando mestre enviar payload json válido", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Mestre" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const createdAsset = {
        id: "new-asset-id",
        campaignId: "c1",
        name: "Retrato do Vilão",
        description: "Lorde das Sombras",
        imageUrl: "https://example.com/villain.png",
        category: "illustration",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReturning = vi.fn().mockResolvedValue([createdAsset]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockInsert.mockReturnValue({ values: mockValues });

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Retrato do Vilão",
          description: "Lorde das Sombras",
          imageUrl: "https://example.com/villain.png",
          category: "illustration",
          position: 0,
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("new-asset-id");
      expect(json.data.name).toBe("Retrato do Vilão");
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "c1",
          name: "Retrato do Vilão",
          imageUrl: "https://example.com/villain.png",
          category: "illustration",
        }),
      );
    });
  });

  describe("POST /api/campaigns/[id]/assets/[assetId]/activate", () => {
    it("deve rejeitar com 403 se o usuário não for o mestre", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "player-1", name: "Jogador" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets/a1/activate", {
        method: "POST",
      });

      const response = await activatePOST(request, {
        params: Promise.resolve({ id: "c1", assetId: "a1" }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Apenas o mestre pode ativar assets na campanha");
    });

    it("deve retornar 404 se o asset não for encontrado", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Mestre" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      // Asset select returns empty
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      mockSelect.mockReturnValueOnce({ from: () => ({ where: mockWhere }) });

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets/a-unknown/activate", {
        method: "POST",
      });

      const response = await activatePOST(request, {
        params: Promise.resolve({ id: "c1", assetId: "a-unknown" }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe("Asset não encontrado");
    });

    it("deve ativar o asset com sucesso (200) e atualizar a campanha", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Mestre" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const targetAsset = {
        id: "a1",
        campaignId: "c1",
        name: "Mapa Central",
        imageUrl: "https://example.com/map.jpg",
        category: "map",
      };

      // Asset query
      const mockLimit = vi.fn().mockResolvedValue([targetAsset]);
      const mockWhereAsset = vi.fn().mockReturnValue({ limit: mockLimit });
      mockSelect.mockReturnValueOnce({ from: () => ({ where: mockWhereAsset }) });

      // Update campaign
      const mockWhereUpdate = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      mockUpdate.mockReturnValueOnce({ set: mockSet });

      // Insert log
      const mockValuesLog = vi.fn().mockResolvedValue({});
      mockInsert.mockReturnValueOnce({ values: mockValuesLog });

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets/a1/activate", {
        method: "POST",
      });

      const response = await activatePOST(request, {
        params: Promise.resolve({ id: "c1", assetId: "a1" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("a1");
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activeAssetId: "a1",
        }),
      );
    });
  });

  describe("POST /api/campaigns/[id]/assets/deactivate", () => {
    it("deve rejeitar com 403 se o usuário não for o mestre", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "player-1", name: "Jogador" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets/deactivate", {
        method: "POST",
      });

      const response = await deactivatePOST(request, {
        params: Promise.resolve({ id: "c1" }),
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe("Apenas o mestre pode desativar assets na campanha");
    });

    it("deve desativar o asset ativo com sucesso (200)", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Mestre" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      // Update campaign activeAssetId to null
      const mockWhereUpdate = vi.fn().mockResolvedValue({});
      const mockSet = vi.fn().mockReturnValue({ where: mockWhereUpdate });
      mockUpdate.mockReturnValueOnce({ set: mockSet });

      // Insert log
      const mockValuesLog = vi.fn().mockResolvedValue({});
      mockInsert.mockReturnValueOnce({ values: mockValuesLog });

      const request = new NextRequest("http://localhost/api/campaigns/c1/assets/deactivate", {
        method: "POST",
      });

      const response = await deactivatePOST(request, {
        params: Promise.resolve({ id: "c1" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          activeAssetId: null,
        }),
      );
    });
  });
});
