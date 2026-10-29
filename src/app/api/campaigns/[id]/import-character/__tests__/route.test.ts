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
    update: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  campaigns: { id: "campaigns.id", masterId: "campaigns.masterId", rulesEngine: "campaigns.rulesEngine" },
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
  missingHabitants: {
    id: "missingHabitants.id",
    ownerId: "missingHabitants.ownerId",
    campaignId: "missingHabitants.campaignId",
  },
  missingActionLedger: {},
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

function createSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("POST /api/campaigns/:id/import-character", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
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

  it("should return 404 when campaign does not exist", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    // Query 1: campaign not found
    mockDb.select.mockReturnValueOnce(createSelectChain([]));

    const request = new NextRequest("http://localhost/api/campaigns/camp-1/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-1" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Campanha não encontrada");
  });

  it("should return 403 when user does not have an active invite and is not master", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    // Query 1: campaign found (master is someone else)
    const mockCampaignQuery = createSelectChain([
      { id: "camp-1", masterId: "master-user", rulesEngine: "dual_d20_sum" },
    ]);
    // Query 2: invite not found
    const mockInviteQuery = createSelectChain([]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockCampaignQuery : mockInviteQuery;
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

  it("should return 404 when d20 character does not exist or does not belong to user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    // Query 1: campaign found
    const mockCampaignQuery = createSelectChain([
      { id: "camp-1", masterId: "master-user", rulesEngine: "dual_d20_sum" },
    ]);
    // Query 2: invite found
    const mockInviteQuery = createSelectChain([
      { userId: "user-1", campaignId: "camp-1", revoked: false },
    ]);
    // Query 3: character not found
    const mockCharacterQuery = createSelectChain([]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCampaignQuery;
      if (callCount === 2) return mockInviteQuery;
      return mockCharacterQuery;
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

  it("should return 409 when d20 character is already linked to the campaign", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const mockCampaignQuery = createSelectChain([
      { id: "camp-1", masterId: "master-user", rulesEngine: "dual_d20_sum" },
    ]);
    const mockInviteQuery = createSelectChain([
      { userId: "user-1", campaignId: "camp-1", revoked: false },
    ]);
    const mockCharacterQuery = createSelectChain([
      { id: "550e8400-e29b-41d4-a716-446655440000", ownerId: "user-1" },
    ]);
    const mockLinkQuery = createSelectChain([
      { characterId: "550e8400-e29b-41d4-a716-446655440000", campaignId: "camp-1" },
    ]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCampaignQuery;
      if (callCount === 2) return mockInviteQuery;
      if (callCount === 3) return mockCharacterQuery;
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

  it("should return 201 and create link when all validations pass for d20 character", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const mockCampaignQuery = createSelectChain([
      { id: "camp-1", masterId: "master-user", rulesEngine: "dual_d20_sum" },
    ]);
    const mockInviteQuery = createSelectChain([
      { userId: "user-1", campaignId: "camp-1", revoked: false },
    ]);
    const mockCharacterQuery = createSelectChain([
      { id: "550e8400-e29b-41d4-a716-446655440000", ownerId: "user-1" },
    ]);
    const mockLinkQuery = createSelectChain([]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCampaignQuery;
      if (callCount === 2) return mockInviteQuery;
      if (callCount === 3) return mockCharacterQuery;
      return mockLinkQuery;
    });

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

  // Tests for MISSING — Edição ZERO
  it("should return 404 when habitant does not exist or does not belong to user in missing_zero campaign", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const mockCampaignQuery = createSelectChain([
      { id: "camp-missing", masterId: "master-user", rulesEngine: "missing_zero" },
    ]);
    const mockInviteQuery = createSelectChain([
      { userId: "user-1", campaignId: "camp-missing", revoked: false },
    ]);
    // Habitant not found
    const mockHabitantQuery = createSelectChain([]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCampaignQuery;
      if (callCount === 2) return mockInviteQuery;
      return mockHabitantQuery;
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-missing/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-missing" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Habitante não encontrado");
  });

  it("should return 409 when habitant is already in this campaign", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const mockCampaignQuery = createSelectChain([
      { id: "camp-missing", masterId: "master-user", rulesEngine: "missing_zero" },
    ]);
    const mockInviteQuery = createSelectChain([
      { userId: "user-1", campaignId: "camp-missing", revoked: false },
    ]);
    const mockHabitantQuery = createSelectChain([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Habitante Teste",
        ownerId: "user-1",
        campaignId: "camp-missing",
      },
    ]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCampaignQuery;
      if (callCount === 2) return mockInviteQuery;
      return mockHabitantQuery;
    });

    const request = new NextRequest("http://localhost/api/campaigns/camp-missing/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-missing" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Este habitante já está nesta campanha");
  });

  it("should update habitant and insert ledger event returning 201 for missing_zero campaign", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });

    const mockCampaignQuery = createSelectChain([
      { id: "camp-missing", masterId: "master-user", rulesEngine: "missing_zero" },
    ]);
    const mockInviteQuery = createSelectChain([
      { userId: "user-1", campaignId: "camp-missing", revoked: false },
    ]);
    const mockHabitantQuery = createSelectChain([
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Detetive John",
        ownerId: "user-1",
        campaignId: null,
      },
    ]);

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockCampaignQuery;
      if (callCount === 2) return mockInviteQuery;
      return mockHabitantQuery;
    });

    const mockSet = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ id: "550e8400-e29b-41d4-a716-446655440000" }]),
    });
    mockDb.update.mockReturnValue({ set: mockSet });

    const mockValues = vi.fn().mockResolvedValue([]);
    mockDb.insert.mockReturnValue({ values: mockValues });

    const request = new NextRequest("http://localhost/api/campaigns/camp-missing/import-character", {
      method: "POST",
      body: JSON.stringify({ characterId: "550e8400-e29b-41d4-a716-446655440000" }),
    });

    const params = Promise.resolve({ id: "camp-missing" });
    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      habitantId: "550e8400-e29b-41d4-a716-446655440000",
      campaignId: "camp-missing",
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp-missing",
      })
    );

    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp-missing",
        habitantId: "550e8400-e29b-41d4-a716-446655440000",
        actorRole: "writer",
        eventType: "system",
      })
    );
  });
});
