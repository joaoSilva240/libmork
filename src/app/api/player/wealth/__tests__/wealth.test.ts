// =============================================================================
// Libmork — API Route Tests: Gestão de Riquezas e Transferência (Issue #36)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { POST as transferPost } from "../transfer/route";
import { NextRequest } from "next/server";

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  characters: {
    id: "characters.id",
    ownerId: "characters.ownerId",
    name: "characters.name",
    imageUrl: "characters.imageUrl",
    level: "characters.level",
    deathStatus: "characters.deathStatus",
    coins: "characters.coins",
    updatedAt: "characters.updatedAt",
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

describe("GET /api/player/wealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Não autenticado");
  });

  it("should return characters and aggregated coin totals for authenticated user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "player@libmork.com" },
    });

    const mockCharacters = [
      {
        id: "char-1",
        name: "Arthur",
        imageUrl: "http://image.url/1",
        level: 5,
        deathStatus: "alive",
        coins: { bronze: 50, prata: 10, ouro: 100, platina: 2, diamante: 1 },
      },
      {
        id: "char-2",
        name: "Merlin",
        imageUrl: null,
        level: 3,
        deathStatus: "alive",
        coins: { bronze: 25, prata: 5, ouro: 50, platina: 0, diamante: 0 },
      },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(mockCharacters),
      }),
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totals).toEqual({
      bronze: 75,
      prata: 15,
      ouro: 150,
      platina: 2,
      diamante: 1,
    });
    expect(data.data.characters).toHaveLength(2);
    expect(data.data.characters[0].name).toBe("Arthur");
  });
});

describe("POST /api/player/wealth/transfer", () => {
  const validPayload = {
    sourceCharacterId: "550e8400-e29b-41d4-a716-446655440001",
    targetCharacterId: "550e8400-e29b-41d4-a716-446655440002",
    coinType: "ouro",
    amount: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it("should return 400 when source and target are the same character", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123" },
    });

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify({
        ...validPayload,
        targetCharacterId: validPayload.sourceCharacterId,
      }),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Dados inválidos");
  });

  it("should return 400 when amount is zero or negative", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123" },
    });

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify({
        ...validPayload,
        amount: 0,
      }),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("should return 404 when source character is not found or not owned by user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123" },
    });

    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // sourceChar empty
            }),
          }),
        }),
      };
      return callback(mockTx);
    });

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("origem não encontrado");
  });

  it("should return 404 when target character is not found or not owned by user", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123" },
    });

    mockDb.transaction.mockImplementation(async (callback) => {
      let callCount = 0;
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve([
                    {
                      id: validPayload.sourceCharacterId,
                      name: "Hero 1",
                      ownerId: "user-123",
                      coins: { ouro: 100 },
                    },
                  ]);
                }
                return Promise.resolve([]); // targetChar empty
              }),
            }),
          }),
        }),
      };
      return callback(mockTx);
    });

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain("destino não encontrado");
  });

  it("should return 400 when source character has insufficient balance", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123" },
    });

    mockDb.transaction.mockImplementation(async (callback) => {
      let callCount = 0;
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve([
                    {
                      id: validPayload.sourceCharacterId,
                      name: "Hero 1",
                      ownerId: "user-123",
                      coins: { ouro: 20 }, // 20 ouro < 50 solicitado
                    },
                  ]);
                }
                return Promise.resolve([
                  {
                    id: validPayload.targetCharacterId,
                    name: "Hero 2",
                    ownerId: "user-123",
                    coins: { ouro: 10 },
                  },
                ]);
              }),
            }),
          }),
        }),
      };
      return callback(mockTx);
    });

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Saldo insuficiente");
  });

  it("should perform atomic transfer when all validations succeed", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123" },
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    });

    mockDb.transaction.mockImplementation(async (callback) => {
      let callCount = 0;
      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve([
                    {
                      id: validPayload.sourceCharacterId,
                      name: "Hero 1",
                      ownerId: "user-123",
                      coins: { ouro: 100, prata: 10 },
                    },
                  ]);
                }
                return Promise.resolve([
                  {
                    id: validPayload.targetCharacterId,
                    name: "Hero 2",
                    ownerId: "user-123",
                    coins: { ouro: 25, prata: 5 },
                  },
                ]);
              }),
            }),
          }),
        }),
        update: mockUpdate,
      };
      return callback(mockTx);
    });

    const req = new NextRequest("http://localhost/api/player/wealth/transfer", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await transferPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Transferência realizada com sucesso");
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
