// =============================================================================
// Libmork — API Route Tests: Entrar na Campanha via Convite (multi-sistema)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

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
  campaigns: {
    id: "campaigns.id",
    masterId: "campaigns.masterId",
    rulesEngine: "campaigns.rulesEngine",
  },
  characters: { id: "characters.id", ownerId: "characters.ownerId" },
  characterCampaigns: {
    characterId: "characterCampaigns.characterId",
    campaignId: "characterCampaigns.campaignId",
  },
  campaignInvites: {
    token: "campaignInvites.token",
    campaignId: "campaignInvites.campaignId",
    revoked: "campaignInvites.revoked",
  },
  missingHabitants: {
    id: "missingHabitants.id",
    ownerId: "missingHabitants.ownerId",
    campaignId: "missingHabitants.campaignId",
  },
  missingActionLedger: {},
  falloutCharacters: {
    id: "falloutCharacters.id",
    ownerId: "falloutCharacters.ownerId",
    campaignId: "falloutCharacters.campaignId",
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
  logger: { error: vi.fn() },
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

const CHAR_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeRequest(characterId: string = CHAR_ID) {
  return new NextRequest("http://localhost/api/invites/tok-123/join", {
    method: "POST",
    body: JSON.stringify({ characterId }),
  });
}

const params = Promise.resolve({ token: "tok-123" });

function mockSelectSequence(...chains: ReturnType<typeof createSelectChain>[]) {
  let callCount = 0;
  mockDb.select.mockImplementation(() => {
    const chain = chains[Math.min(callCount, chains.length - 1)];
    callCount++;
    return chain;
  });
}

describe("POST /api/invites/:token/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "test@example.com", role: "player" },
    });
  });

  it("retorna 401 quando não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);
    const response = await POST(makeRequest(), { params });
    expect(response.status).toBe(401);
  });

  it("retorna 404 quando o convite é inválido ou revogado", async () => {
    mockSelectSequence(createSelectChain([]));
    const response = await POST(makeRequest(), { params });
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toBe("Convite inválido ou revogado");
  });

  it("retorna 400 quando characterId não é UUID", async () => {
    mockSelectSequence(
      createSelectChain([{ campaignId: "camp-1", token: "tok-123", revoked: false }]),
    );
    const response = await POST(makeRequest("invalid-id"), { params });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toBe("Dados inválidos");
  });

  it("retorna 404 quando a campanha do convite não existe", async () => {
    mockSelectSequence(
      createSelectChain([{ campaignId: "camp-1", token: "tok-123", revoked: false }]),
      createSelectChain([]),
    );
    const response = await POST(makeRequest(), { params });
    const data = await response.json();
    expect(response.status).toBe(404);
    expect(data.error).toBe("Campanha não encontrada");
  });

  it("vincula personagem d20 via characterCampaigns com origin invited", async () => {
    mockSelectSequence(
      createSelectChain([{ campaignId: "camp-1", token: "tok-123", revoked: false }]),
      createSelectChain([{ id: "camp-1", masterId: "master-user", rulesEngine: "dual_d20_sum" }]),
      createSelectChain([{ id: CHAR_ID, ownerId: "user-1" }]),
      createSelectChain([]),
    );
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        { characterId: CHAR_ID, campaignId: "camp-1", origin: "invited", approvalStatus: "approved" },
      ]),
    });

    const response = await POST(makeRequest(), { params });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.data.origin).toBe("invited");
    expect(data.data.approvalStatus).toBe("approved");
  });

  it("vincula habitante em campanha missing_zero e registra ledger", async () => {
    mockSelectSequence(
      createSelectChain([{ campaignId: "camp-m", token: "tok-123", revoked: false }]),
      createSelectChain([{ id: "camp-m", masterId: "master-user", rulesEngine: "missing_zero" }]),
      createSelectChain([{ id: CHAR_ID, name: "Detetive John", ownerId: "user-1", campaignId: null }]),
    );
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mockDb.update.mockReturnValue({ set: mockSet });
    const mockValues = vi.fn().mockResolvedValue([]);
    mockDb.insert.mockReturnValue({ values: mockValues });

    const response = await POST(makeRequest(), { params: Promise.resolve({ token: "tok-123" }) });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.data).toEqual({ habitantId: CHAR_ID, campaignId: "camp-m" });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "camp-m" }));
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: "camp-m", habitantId: CHAR_ID, eventType: "system" }),
    );
  });

  it("vincula sobrevivente em campanha fallout_2d20 via campaignId", async () => {
    mockSelectSequence(
      createSelectChain([{ campaignId: "camp-f", token: "tok-123", revoked: false }]),
      createSelectChain([{ id: "camp-f", masterId: "master-user", rulesEngine: "fallout_2d20" }]),
      createSelectChain([{ id: CHAR_ID, name: "Cooper Howard", ownerId: "user-1", campaignId: null }]),
    );
    const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    mockDb.update.mockReturnValue({ set: mockSet });

    const response = await POST(makeRequest(), { params: Promise.resolve({ token: "tok-123" }) });
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.data).toEqual({ characterId: CHAR_ID, campaignId: "camp-f" });
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "camp-f" }));
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("retorna 409 quando o sobrevivente já participa da campanha fallout", async () => {
    mockSelectSequence(
      createSelectChain([{ campaignId: "camp-f", token: "tok-123", revoked: false }]),
      createSelectChain([{ id: "camp-f", masterId: "master-user", rulesEngine: "fallout_2d20" }]),
      createSelectChain([{ id: CHAR_ID, ownerId: "user-1", campaignId: "camp-f" }]),
    );

    const response = await POST(makeRequest(), { params: Promise.resolve({ token: "tok-123" }) });
    const data = await response.json();
    expect(response.status).toBe(409);
    expect(data.error).toBe("Este sobrevivente já participa da campanha");
  });
});