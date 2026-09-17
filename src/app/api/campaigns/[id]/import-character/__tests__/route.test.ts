// =============================================================================
// Libmork — API Route Tests: Importar Personagem para Campanha
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock dependencies with vi.hoisted
const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  characters: { id: "characters.id", ownerId: "characters.ownerId" },
  characterCampaigns: {
    characterId: "characterCampaigns.characterId",
    campaignId: "characterCampaigns.campaignId",
  },
  campaignInvites: {
    userId: "campaignInvites.userId",
    campaignId: "campaignInvites.campaignId",
    revoked: "campaignInvites.revoked",
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, op: "eq" })),
  and: vi.fn((...args) => ({ op: "and", args })),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("POST /api/campaigns/:id/import-character", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "char-1" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Não autenticado");
  });

  it("should return 400 when characterId is invalid (not UUID)", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "invalid-id" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Dados inválidos");
  });

  it("should return 404 when character does not exist or does not belong to user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const mockSelect = vi.fn().mockReturnThis();
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([]);

    mockDb.select.mockReturnValue({
      from: mockFrom.mockReturnValue({
        where: mockWhere.mockReturnValue({
          limit: mockLimit,
        }),
      }),
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Personagem não encontrado");
  });

  it("should return 403 when user does not have an active invite for the campaign", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    // First query: character found
    const mockCharacterQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          id: "char-1",
          name: "Hero",
          ownerId: "user-1",
        },
      ]),
    };

    // Second query: invite not found
    const mockInviteQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockCharacterQuery : mockInviteQuery;
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Você não tem convite ativo para esta campanha");
  });

  it("should return 409 when character is already linked to the campaign", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    // First query: character found
    const mockCharacterQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "char-1", ownerId: "user-1" }]),
    };

    // Second query: invite found
    const mockInviteQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { userId: "user-1", campaignId: "camp-1", revoked: false },
      ]),
    };

    // Third query: existing link found
    const mockLinkQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { characterId: "char-1", campaignId: "camp-1" },
      ]),
    };

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCharacterQuery;
      if (callCount === 2) return mockInviteQuery;
      return mockLinkQuery;
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Este personagem já está vinculado a esta campanha");
  });

  it("should return 201 and create link when all validations pass", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    // Character found
    const mockCharacterQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "char-1", ownerId: "user-1" }]),
    };

    // Invite found
    const mockInviteQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        { userId: "user-1", campaignId: "camp-1", revoked: false },
      ]),
    };

    // No existing link
    const mockLinkQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCharacterQuery;
      if (callCount === 2) return mockInviteQuery;
      return mockLinkQuery;
    });

    // Insert successful
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          characterId: "550e8400-e29b-41d4-a716-446655440000",
          campaignId: "camp-1",
          origin: "imported",
          approvalStatus: "approved",
        },
      ]),
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.origin).toBe("imported");
    expect(data.data.approvalStatus).toBe("approved");
  });
});
