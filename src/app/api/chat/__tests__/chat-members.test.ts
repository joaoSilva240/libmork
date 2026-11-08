import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getMembers } from "../groups/[groupId]/members/route";
import {
  PATCH as patchMember,
  DELETE as deleteMember,
} from "../groups/[groupId]/members/[userId]/route";
import { POST as postRemoveMember } from "../../campaigns/[id]/remove-member/route";

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/server/chat-service", () => ({
  listGroupMembers: vi.fn(),
  updateMemberPermissions: vi.fn(),
  removeGroupMember: vi.fn(),
  removeUserFromCampaign: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { requireAuth } = await import("@/lib/auth/session");
const { listGroupMembers, updateMemberPermissions, removeGroupMember, removeUserFromCampaign } =
  await import("@/lib/server/chat-service");

const mockMember = {
  userId: "u-2",
  displayName: "Maria",
  avatarUrl: null,
  role: "member" as const,
  canRead: true,
  canWrite: true,
  canShare: true,
  joinedAt: new Date().toISOString(),
};

describe("GET /api/chat/groups/:groupId/members", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 200 com a lista de membros", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(listGroupMembers).mockResolvedValue([mockMember]);
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members");
    const res = await getMembers(req, { params: Promise.resolve({ groupId: "g-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].userId).toBe("u-2");
  });

  it("retorna 403 quando o usuário não é membro do grupo", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(listGroupMembers).mockRejectedValue(new Error("Você não é membro deste grupo"));
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members");
    const res = await getMembers(req, { params: Promise.resolve({ groupId: "g-1" }) });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/chat/groups/:groupId/members/:userId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 200 com o membro atualizado", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(updateMemberPermissions).mockResolvedValue({
      ...mockMember,
      canWrite: false,
    });
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canWrite: false }),
    });
    const res = await patchMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-2" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.canWrite).toBe(false);
  });

  it("retorna 400 para body vazio", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await patchMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-2" }) });
    expect(res.status).toBe(400);
  });

  it("retorna 403 quando não é admin", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(updateMemberPermissions).mockRejectedValue(
      new Error("Apenas o Mestre pode alterar permissões"),
    );
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canWrite: false }),
    });
    const res = await patchMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-2" }) });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/chat/groups/:groupId/members/:userId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 200 ao remover membro", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(removeGroupMember).mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-2", {
      method: "DELETE",
    });
    const res = await deleteMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-2" }) });
    expect(res.status).toBe(200);
    expect(removeGroupMember).toHaveBeenCalledWith("g-1", "user-1", "u-2");
  });

  it("retorna 403 ao tentar remover um administrador", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(removeGroupMember).mockRejectedValue(
      new Error("Não é possível remover um administrador"),
    );
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-2", {
      method: "DELETE",
    });
    const res = await deleteMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-2" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando o membro não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(removeGroupMember).mockRejectedValue(new Error("Membro não encontrado"));
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/members/u-9", {
      method: "DELETE",
    });
    const res = await deleteMember(req, { params: Promise.resolve({ groupId: "g-1", userId: "u-9" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/campaigns/:id/remove-member", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 200 e chama o serviço com os ids corretos", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "master-1" } } as never);
    vi.mocked(removeUserFromCampaign).mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/campaigns/c-1/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postRemoveMember(req, { params: Promise.resolve({ id: "c-1" }) });
    expect(res.status).toBe(200);
    expect(removeUserFromCampaign).toHaveBeenCalledWith(
      "c-1",
      "master-1",
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("retorna 400 para body inválido", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "master-1" } } as never);
    const req = new NextRequest("http://localhost/api/campaigns/c-1/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "x" }),
    });
    const res = await postRemoveMember(req, { params: Promise.resolve({ id: "c-1" }) });
    expect(res.status).toBe(400);
  });

  it("retorna 403 quando não é o mestre da campanha", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(removeUserFromCampaign).mockRejectedValue(
      new Error("Apenas o Mestre pode remover usuários da campanha"),
    );
    const req = new NextRequest("http://localhost/api/campaigns/c-1/remove-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await postRemoveMember(req, { params: Promise.resolve({ id: "c-1" }) });
    expect(res.status).toBe(403);
  });
});
