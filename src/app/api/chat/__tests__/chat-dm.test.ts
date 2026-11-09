import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postDm } from "../dm/route";

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/server/chat-service", () => ({ getOrCreateDmGroup: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { requireAuth } = await import("@/lib/auth/session");
const { getOrCreateDmGroup } = await import("@/lib/server/chat-service");

const mockGroup = {
  id: "dm-1",
  campaignId: null,
  type: "dm",
  name: "Maria",
  avatarUrl: null,
  role: "member",
  permissions: { canRead: true, canWrite: true, canShare: true },
  unreadCount: 0,
  lastMessage: null,
  membersCount: 2,
  updatedAt: new Date().toISOString(),
};

describe("POST /api/chat/dm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(401);
  });

  it("retorna 400 para body inválido", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "x" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(400);
  });

  it("cria/retorna o grupo DM", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getOrCreateDmGroup).mockResolvedValue(mockGroup as never);
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.type).toBe("dm");
  });

  it("retorna 404 quando usuário não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getOrCreateDmGroup).mockRejectedValue(new Error("Usuário não encontrado"));
    const req = new NextRequest("http://localhost/api/chat/dm", {
      method: "POST",
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postDm(req);
    expect(res.status).toBe(404);
  });
});
