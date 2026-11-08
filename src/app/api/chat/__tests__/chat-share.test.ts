import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getShareCatalog } from "../share-catalog/route";
import { GET as getChatSearch } from "../search/route";
import { POST as postMessage } from "../groups/[groupId]/messages/route";

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/server/chat-service", () => ({
  getShareCatalog: vi.fn(),
  searchChatMentions: vi.fn(),
  postChatMessage: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { requireAuth } = await import("@/lib/auth/session");
const { getShareCatalog: getShareCatalogSvc, searchChatMentions, postChatMessage } = await import(
  "@/lib/server/chat-service"
);

const mockCatalog = {
  posts: [{ id: "p-1", title: "Post", contentType: "spell", authorName: "Mestre" }],
  campaigns: [{ id: "c-1", name: "Campanha", coverImageUrl: null }],
};

describe("GET /api/chat/share-catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await getShareCatalog();
    expect(res.status).toBe(401);
  });

  it("retorna o catálogo com sucesso", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(getShareCatalogSvc).mockResolvedValue(mockCatalog as never);
    const res = await getShareCatalog();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.posts).toHaveLength(1);
    expect(json.data.campaigns).toHaveLength(1);
  });
});

describe("GET /api/chat/search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const req = new NextRequest("http://localhost/api/chat/search?q=mar");
    const res = await getChatSearch(req);
    expect(res.status).toBe(401);
  });

  it("retorna 400 com q de 2 caracteres", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    const req = new NextRequest("http://localhost/api/chat/search?q=ab");
    const res = await getChatSearch(req);
    expect(res.status).toBe(400);
  });

  it("retorna 200 com usuários e itens da biblioteca com q=mar", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(searchChatMentions).mockResolvedValue({
      users: [{ userId: "u-2", displayName: "Maria", avatarUrl: null, isGroupMember: true }],
      libraryItems: [
        {
          id: "s-1",
          name: "Bola de Fogo",
          contentType: "spells",
          description: null,
          imageUrl: null,
        },
      ],
    } as never);
    const req = new NextRequest("http://localhost/api/chat/search?q=mar");
    const res = await getChatSearch(req);
    expect(res.status).toBe(200);
    expect(searchChatMentions).toHaveBeenCalledWith("mar", "user-1", undefined);
    const json = await res.json();
    expect(json.data.users[0].displayName).toBe("Maria");
    expect(json.data.libraryItems[0].name).toBe("Bola de Fogo");
  });
});

describe("POST /api/chat/groups/:groupId/messages (share)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria mensagem de compartilhamento com payload montado no servidor", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(postChatMessage).mockResolvedValue({
      id: "m-3",
      groupId: "g-1",
      senderId: "user-1",
      senderName: "João",
      senderAvatar: null,
      isMaster: false,
      content: "Olha esse perfil",
      type: "share",
      createdAt: new Date().toISOString(),
      payload: {
        kind: "profile",
        snapshot: {
          userId: "u-2",
          displayName: "Maria",
          avatarUrl: null,
          bio: null,
        },
      },
    } as never);
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Olha esse perfil",
        type: "share",
        share: { kind: "profile", id: "550e8400-e29b-41d4-a716-446655440000" },
      }),
    });
    const res = await postMessage(req, { params: Promise.resolve({ groupId: "g-1" }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.payload.kind).toBe("profile");
  });

  it("retorna 403 quando o membro não pode compartilhar", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(postChatMessage).mockRejectedValue(
      new Error("Você não tem permissão para compartilhar neste grupo"),
    );
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Olha esse perfil",
        type: "share",
        share: { kind: "profile", id: "550e8400-e29b-41d4-a716-446655440000" },
      }),
    });
    const res = await postMessage(req, { params: Promise.resolve({ groupId: "g-1" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando o conteúdo compartilhado não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(postChatMessage).mockRejectedValue(
      new Error("Conteúdo não encontrado para compartilhar"),
    );
    const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Compartilhando",
        type: "share",
        share: {
          kind: "library_item",
          id: "550e8400-e29b-41d4-a716-446655440000",
          contentType: "spells",
        },
      }),
    });
    const res = await postMessage(req, { params: Promise.resolve({ groupId: "g-1" }) });
    expect(res.status).toBe(404);
  });
});
