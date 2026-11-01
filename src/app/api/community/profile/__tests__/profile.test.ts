import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getProfile } from "../[userId]/route";
import { PUT as updateProfile } from "../route";
import { GET as getPosts } from "../[userId]/posts/route";
import { GET as getCloned } from "../[userId]/cloned/route";
import { GET as getLiked } from "../[userId]/liked/route";

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  users: {
    id: "users.id",
    displayName: "users.displayName",
    masterName: "users.masterName",
    masterAvatar: "users.masterAvatar",
    masterBio: "users.masterBio",
    masterBannerUrl: "users.masterBannerUrl",
  },
  campaigns: {
    id: "campaigns.id",
    masterId: "campaigns.masterId",
  },
  communityPosts: {
    id: "communityPosts.id",
    authorId: "communityPosts.authorId",
    contentType: "communityPosts.contentType",
    createdAt: "communityPosts.createdAt",
  },
  communityLikes: {
    postId: "communityLikes.postId",
    userId: "communityLikes.userId",
    createdAt: "communityLikes.createdAt",
  },
  communityComments: {
    id: "communityComments.id",
    postId: "communityComments.postId",
  },
  communityClones: {
    id: "communityClones.id",
    postId: "communityClones.postId",
    userId: "communityClones.userId",
    clonedAt: "communityClones.clonedAt",
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, op: "eq" })),
  and: vi.fn((...args) => ({ op: "and", args })),
  desc: vi.fn((field) => ({ field, op: "desc" })),
  sql: vi.fn((strings, ...values) => ({ strings, values, op: "sql" })),
}));

describe("Master Profile API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/community/profile/[userId]", () => {
    it("retorna perfil completo e estatísticas", async () => {
      const mockUser = {
        id: "user-123",
        displayName: "John Doe",
        masterName: "Mestre Arcano",
        masterAvatar: "https://example.com/avatar.png",
        masterBio: "Mestre há 10 anos",
        masterBannerUrl: "https://example.com/banner.png",
      };

      // Query 1: user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      // Query 2: campaigns count
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      // Query 3: postStats
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            spells: 2,
            items: 4,
            classes: 1,
            npcs: 5,
            worlds: 1,
          }]),
        }),
      });

      const req = new NextRequest("http://localhost/api/community/profile/user-123");
      const res = await getProfile(req, { params: Promise.resolve({ userId: "user-123" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.masterName).toBe("Mestre Arcano");
      expect(data.masterAvatar).toBe("https://example.com/avatar.png");
      expect(data.statistics.campaigns).toBe(3);
      expect(data.statistics.spells).toBe(2);
      expect(data.statistics.items).toBe(4);
    });

    it("retorna fallback com displayName quando perfil não configurado", async () => {
      const mockUser = {
        id: "user-456",
        displayName: "Player One",
        masterName: null,
        masterAvatar: null,
        masterBio: null,
        masterBannerUrl: null,
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            spells: 0,
            items: 0,
            classes: 0,
            npcs: 0,
            worlds: 0,
          }]),
        }),
      });

      const req = new NextRequest("http://localhost/api/community/profile/user-456");
      const res = await getProfile(req, { params: Promise.resolve({ userId: "user-456" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.masterName).toBe("Player One");
      expect(data.masterAvatar).toBeNull();
      expect(data.statistics.campaigns).toBe(0);
    });

    it("retorna 404 quando o usuário não for encontrado", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const req = new NextRequest("http://localhost/api/community/profile/unknown");
      const res = await getProfile(req, { params: Promise.resolve({ userId: "unknown" }) });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Usuário não encontrado");
    });
  });

  describe("PUT /api/community/profile", () => {
    it("retorna 401 quando não autenticado", async () => {
      mockRequireAuth.mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/community/profile", {
        method: "PUT",
        body: JSON.stringify({ masterName: "Novo Nome" }),
      });

      const res = await updateProfile(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Não autenticado");
    });

    it("retorna 400 para dados inválidos (ex: URL inválida)", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-123", displayName: "Tester" },
      });

      const req = new NextRequest("http://localhost/api/community/profile", {
        method: "PUT",
        body: JSON.stringify({ masterAvatar: "nao-eh-url" }),
      });

      const res = await updateProfile(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Dados inválidos");
    });

    it("atualiza o perfil com sucesso", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-123", displayName: "Tester" },
      });

      const updatedUser = {
        id: "user-123",
        displayName: "Tester",
        masterName: "Novo Mestre",
        masterAvatar: "https://example.com/avatar.jpg",
        masterBio: "Nova bio",
        masterBannerUrl: "https://example.com/banner.jpg",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedUser]),
          }),
        }),
      });

      const req = new NextRequest("http://localhost/api/community/profile", {
        method: "PUT",
        body: JSON.stringify({
          masterName: "Novo Mestre",
          masterAvatar: "https://example.com/avatar.jpg",
          masterBio: "Nova bio",
          masterBannerUrl: "https://example.com/banner.jpg",
        }),
      });

      const res = await updateProfile(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.profile.masterName).toBe("Novo Mestre");
      expect(data.profile.masterBio).toBe("Nova bio");
    });
  });

  describe("GET /api/community/profile/[userId]/posts", () => {
    it("retorna lista paginada de posts do usuário", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-123", displayName: "Tester" },
      });

      const mockRows = [
        {
          post: {
            id: "post-1",
            authorId: "user-123",
            title: "Bola de Fogo",
            contentType: "spell",
            tags: ["fogo"],
            clonesCount: 3,
            createdAt: "2026-03-01T12:00:00Z",
          },
          author: {
            id: "user-123",
            displayName: "Tester",
            masterName: "Mestre Arcano",
            masterAvatar: null,
          },
          likesCount: 5,
          commentsCount: 2,
          isLikedByMe: true,
        },
      ];

      const queryChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockRows),
      };

      mockDb.select.mockReturnValue(queryChain);

      const req = new NextRequest("http://localhost/api/community/profile/user-123/posts?page=1&limit=10");
      const res = await getPosts(req, { params: Promise.resolve({ userId: "user-123" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Bola de Fogo");
      expect(data.data[0].likesCount).toBe(5);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(10);
    });
  });

  describe("GET /api/community/profile/[userId]/cloned", () => {
    it("retorna lista paginada de posts clonados pelo usuário", async () => {
      mockRequireAuth.mockResolvedValue(null);

      const mockRows = [
        {
          post: {
            id: "post-99",
            authorId: "other-user",
            title: "Espada Justiceira",
            contentType: "item",
            tags: ["arma"],
            clonesCount: 1,
            createdAt: "2026-03-01T10:00:00Z",
          },
          author: {
            id: "other-user",
            displayName: "Other Master",
            masterName: "Other",
            masterAvatar: null,
          },
          clonedAt: "2026-03-02T15:00:00Z",
          likesCount: 10,
          commentsCount: 0,
          isLikedByMe: false,
        },
      ];

      const queryChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockRows),
      };

      mockDb.select.mockReturnValue(queryChain);

      const req = new NextRequest("http://localhost/api/community/profile/user-123/cloned?page=2&limit=5");
      const res = await getCloned(req, { params: Promise.resolve({ userId: "user-123" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data[0].title).toBe("Espada Justiceira");
      expect(data.data[0].clonedAt).toBe("2026-03-02T15:00:00Z");
      expect(data.page).toBe(2);
      expect(data.limit).toBe(5);
    });
  });

  describe("GET /api/community/profile/[userId]/liked", () => {
    it("retorna lista paginada de posts curtidos pelo usuário", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-123", displayName: "Tester" },
      });

      const mockRows = [
        {
          post: {
            id: "post-77",
            authorId: "creator-user",
            title: "Reino de Eldoria",
            contentType: "world",
            tags: ["fantasia"],
            clonesCount: 12,
            createdAt: "2026-02-20T10:00:00Z",
          },
          author: {
            id: "creator-user",
            displayName: "WorldBuilder",
            masterName: "Eldor",
            masterAvatar: null,
          },
          likedAt: "2026-03-01T18:00:00Z",
          likesCount: 42,
          commentsCount: 7,
          isLikedByMe: true,
        },
      ];

      const queryChain = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(mockRows),
      };

      mockDb.select.mockReturnValue(queryChain);

      const req = new NextRequest("http://localhost/api/community/profile/user-123/liked?page=1&limit=20");
      const res = await getLiked(req, { params: Promise.resolve({ userId: "user-123" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data[0].title).toBe("Reino de Eldoria");
      expect(data.data[0].likesCount).toBe(42);
      expect(data.data[0].likedAt).toBe("2026-03-01T18:00:00Z");
    });
  });
});
