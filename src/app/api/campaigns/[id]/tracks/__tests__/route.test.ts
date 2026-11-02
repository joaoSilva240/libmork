import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "../route";
import { DELETE } from "../[trackId]/route";

// Mocks
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockSelect(),
    insert: () => mockInsert(),
    delete: () => mockDelete(),
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

describe("/api/campaigns/[id]/tracks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("deve retornar 401 se usuário não estiver autenticado", async () => {
      vi.mocked(requireAuth).mockResolvedValue(null as any);

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks");
      const response = await GET(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it("deve retornar lista de faixas formatadas com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);

      // canAccessCampaign -> select campaign
      const mockWhereCampaign = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ masterId: "user-1" }]),
      });
      // query tracks
      const mockOrderBy = vi.fn().mockResolvedValue([
        {
          id: "uuid-1",
          campaignId: "c1",
          videoId: "dQw4w9WgXcQ",
          title: "Rick Astley",
          addedBy: "user-1",
          addedAt: new Date("2026-11-01T00:00:00Z"),
          position: 0,
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
      expect(json.data).toHaveLength(1);
      expect(json.data[0].id).toBe("dQw4w9WgXcQ");
      expect(json.data[0].title).toBe("Rick Astley");
    });
  });

  describe("POST", () => {
    it("deve rejeitar se não for o mestre da campanha", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-player", name: "Player" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "POST",
        body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(403);
    });

    it("deve rejeitar URL inválida do YouTube", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "user-1" } as any);

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "POST",
        body: JSON.stringify({ url: "https://vimeo.com/12345" }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("inválido");
    });

    it("deve inserir e retornar faixa criada com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "user-1" } as any);

      // check duplicate -> empty
      mockSelect.mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // insert
      mockInsert.mockReturnValueOnce({
        values: () => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: "new-uuid",
              campaignId: "c1",
              videoId: "dQw4w9WgXcQ",
              title: "dQw4w9WgXcQ",
              addedBy: "user-1",
              addedAt: new Date("2026-11-01T00:00:00Z"),
              position: 0,
            },
          ]),
        }),
      });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "POST",
        body: JSON.stringify({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("dQw4w9WgXcQ");
    });
  });

  describe("DELETE", () => {
    it("deve remover faixa com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "user-1" } as any);

      mockDelete.mockReturnValueOnce({
        where: () => ({
          returning: vi.fn().mockResolvedValue([{ id: "deleted-id" }]),
        }),
      });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks/dQw4w9WgXcQ", {
        method: "DELETE",
      });
      const response = await DELETE(request, {
        params: Promise.resolve({ id: "c1", trackId: "dQw4w9WgXcQ" }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });

  describe("PATCH", () => {
    it("deve atualizar playlist das faixas com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "user-1" } as any);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      mockUpdate.mockReturnValueOnce({ set: mockSet });

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "PATCH",
        body: JSON.stringify({
          trackIds: ["track-1", "track-2"],
          playlistId: "playlist-1",
          playlistName: "Batalha",
        }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "c1" }) });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.playlistId).toBe("playlist-1");
      expect(mockSet).toHaveBeenCalledWith({
        playlistId: "playlist-1",
        playlistName: "Batalha",
      });
    });

    it("deve rejeitar se trackIds for vazio", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        user: { id: "user-1", name: "Master" },
        session: { id: "s1" },
      } as any);
      vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1", masterId: "user-1" } as any);

      const request = new NextRequest("http://localhost/api/campaigns/c1/tracks", {
        method: "PATCH",
        body: JSON.stringify({
          trackIds: [],
          playlistId: "playlist-1",
        }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "c1" }) });
      expect(response.status).toBe(400);
    });
  });
});
