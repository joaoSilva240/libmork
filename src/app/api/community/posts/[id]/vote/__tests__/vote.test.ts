import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as votePost } from "../route";
import { NextRequest } from "next/server";

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  communityPosts: {
    id: "communityPosts.id",
  },
  communityPostVotes: {
    postId: "communityPostVotes.postId",
    userId: "communityPostVotes.userId",
    value: "communityPostVotes.value",
    updatedAt: "communityPostVotes.updatedAt",
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, op: "eq" })),
  and: vi.fn((...args) => ({ op: "and", args })),
  sql: vi.fn((strings, ...values) => ({ strings, values, op: "sql" })),
}));

describe("POST /api/community/posts/[id]/vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registra primeiro upvote com sucesso", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    // Post existe
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "post-1" }]),
        }),
      }),
    });

    // Nenhum voto existente
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    // Agregação
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ upvotes: 1, downvotes: 0, score: 1 }]),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/vote", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
    });

    const res = await votePost(req, { params: Promise.resolve({ id: "post-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.upvotes).toBe(1);
    expect(data.downvotes).toBe(0);
    expect(data.score).toBe(1);
    expect(data.userVote).toBe(1);
  });

  it("toggle de upvote existente remove o voto", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "post-1" }]),
        }),
      }),
    });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: 1 }]),
        }),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ upvotes: 0, downvotes: 0, score: 0 }]),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/vote", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
    });

    const res = await votePost(req, { params: Promise.resolve({ id: "post-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.upvotes).toBe(0);
    expect(data.downvotes).toBe(0);
    expect(data.score).toBe(0);
    expect(data.userVote).toBeNull();
  });

  it("troca downvote para upvote", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "post-1" }]),
        }),
      }),
    });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ value: -1 }]),
        }),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ upvotes: 1, downvotes: 0, score: 1 }]),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/vote", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
    });

    const res = await votePost(req, { params: Promise.resolve({ id: "post-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.upvotes).toBe(1);
    expect(data.score).toBe(1);
    expect(data.userVote).toBe(1);
  });

  it("rejeita voto inválido", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/vote", {
      method: "POST",
      body: JSON.stringify({ value: 5 }),
    });

    const res = await votePost(req, { params: Promise.resolve({ id: "post-1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("inválido");
  });

  it("rejeita voto não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/community/posts/post-1/vote", {
      method: "POST",
      body: JSON.stringify({ value: 1 }),
    });

    const res = await votePost(req, { params: Promise.resolve({ id: "post-1" }) });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("autenticado");
  });
});
