import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { PATCH } from "../[trackId]/route";

// Mocks do DB
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    insert: () => mockInsert(),
    update: () => mockUpdate(),
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
    info: vi.fn(),
  },
}));

const { requireAuth } = await import("@/lib/auth/session");
const { getCampaignAsMaster } = await import("@/lib/auth/campaign-access");

describe("API tracks: campo scene (GET / POST / PATCH [trackId])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/campaigns/[id]/tracks", () => {
    it("deve incluir o campo scene (valor ou null) no retorno de cada faixa", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);

      const mockWhereCampaign = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ masterId: "user-1" }]),
      });
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: "uuid-1",
          campaignId: "c1",
          videoId: "vid-1",
          title: "Track 1",
          addedBy: "user-1",
          addedAt: new Date("2026-11-01T00:00:00Z"),
          position: 0,
          scene: "combat",
        },
        {
          id: "uuid-2",
          campaignId: "c1",
          videoId: "vid-2",
          title: "Track 2",
          addedBy: "user-1",
          addedAt: new Date("2026-11-01T00:00:00Z"),
          position: 1,
          scene: null,
        },
      ]);
      const mockWhereTracks = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

      mockSelect
        .mockReturnValueOnce({ from: () => ({ where: mockWhereCampaign }) })
        .mockReturnValueOnce({ from: () => ({ where: mockWhereTracks }) });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks");
      const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(2);
      expect(json.data[0].scene).toBe("combat");
      expect(json.data[1].scene).toBeNull();
    });
  });

  describe("POST /api/campaigns/[id]/tracks", () => {
    it("deve persistir e retornar a cena informada quando válida", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      // Checagem de duplicata (não existe)
      const mockWhereExisting = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      });
      mockSelect.mockReturnValueOnce({ from: () => ({ where: mockWhereExisting }) });

      const insertedTrack = {
        id: "uuid-new",
        campaignId: "c1",
        videoId: "dQw4w9WgXcQ",
        title: "Combat Music",
        addedBy: "master-1",
        addedAt: new Date("2026-11-08T00:00:00Z"),
        scene: "combat",
      };

      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([insertedTrack]),
      });
      mockInsert.mockReturnValueOnce({ values: mockValues });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "POST",
        body: JSON.stringify({
          videoId: "dQw4w9WgXcQ",
          title: "Combat Music",
          scene: "combat",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.scene).toBe("combat");
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          scene: "combat",
        }),
      );
    });

    it("deve persistir scene como null quando não fornecida", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const mockWhereExisting = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      });
      mockSelect.mockReturnValueOnce({ from: () => ({ where: mockWhereExisting }) });

      const insertedTrack = {
        id: "uuid-new-2",
        campaignId: "c1",
        videoId: "dQw4w9WgXcQ",
        title: "Generic Music",
        addedBy: "master-1",
        addedAt: new Date("2026-11-08T00:00:00Z"),
        scene: null,
      };

      const mockValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([insertedTrack]),
      });
      mockInsert.mockReturnValueOnce({ values: mockValues });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "POST",
        body: JSON.stringify({
          videoId: "dQw4w9WgXcQ",
          title: "Generic Music",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.scene).toBeNull();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          scene: null,
        }),
      );
    });

    it("deve rejeitar com 400 se cena for inválida e não realizar insert", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "POST",
        body: JSON.stringify({
          videoId: "dQw4w9WgXcQ",
          title: "Bad Scene",
          scene: "invalid-scene-value",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Cena inválida");
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /api/campaigns/[id]/tracks/[trackId]", () => {
    it("deve atualizar a cena da faixa com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "uuid-1", videoId: "vid-1", scene: "stealth" },
          ]),
        }),
      });
      mockUpdate.mockReturnValueOnce({ set: mockSet });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks/vid-1", {
        method: "PATCH",
        body: JSON.stringify({ scene: "stealth" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "c1", trackId: "vid-1" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.trackId).toBe("vid-1");
      expect(json.data.scene).toBe("stealth");
      expect(mockSet).toHaveBeenCalledWith({ scene: "stealth" });
    });

    it("deve rejeitar com 400 se cena for inválida no PATCH", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks/vid-1", {
        method: "PATCH",
        body: JSON.stringify({ scene: "invalid_scene" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "c1", trackId: "vid-1" }),
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Cena inválida");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("deve retornar 404 se a faixa não for encontrada na campanha", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "master-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "master-1" } as any);

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      });
      mockUpdate.mockReturnValueOnce({ set: mockSet });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks/non-existent", {
        method: "PATCH",
        body: JSON.stringify({ scene: "combat" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "c1", trackId: "non-existent" }),
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Faixa não encontrada na campanha");
    });
  });
});
