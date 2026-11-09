import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { selectResults, issueShareLinkMock, hubMock, publicMock, previewMock, acquireMock } =
  vi.hoisted(() => ({
    selectResults: [] as unknown[][],
    issueShareLinkMock: vi.fn(),
    hubMock: vi.fn(),
    publicMock: vi.fn(),
    previewMock: vi.fn(),
    acquireMock: vi.fn(),
  }));

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/server/character-share-service", () => ({
  issueShareLink: issueShareLinkMock,
  getCharacterHub: hubMock,
  getPublicOffSession: publicMock,
  getAcquirePreview: previewMock,
  acquireCharacter: acquireMock,
}));
vi.mock("@/lib/db", () => {
  const makeSelect = () => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.limit = async () => selectResults.shift() ?? [];
    return chain;
  };
  return {
    db: {
      select: () => makeSelect(),
      update: () => ({
        set: () => ({ where: async () => undefined }),
      }),
    },
  };
});

const { requireAuth } = await import("@/lib/auth/session");
const {
  GET: getShare,
  POST: postShare,
  DELETE: deleteShare,
} = await import("../[id]/share/route");
const { GET: getHub } = await import("../[id]/hub/route");
const { GET: getPublicSheet } = await import("../../public-sheet/[token]/route");
const { GET: getImportPreview, POST: postAcquire } = await import("../import/[token]/route");

const characterRow = { id: "char-1", ownerId: "user-1", name: "Artemis" };
const authed = { user: { id: "user-1" } } as never;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const tokenParams = (token: string) => ({ params: Promise.resolve({ token }) });

describe("GET /api/characters/:id/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await getShare(
      new NextRequest("http://localhost/api/characters/char-1/share"),
      params("char-1"),
    );
    expect(res.status).toBe(401);
  });

  it("retorna o link de aquisição com URL /characters/import/:token", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    selectResults.push([characterRow], [
      { token: "tok-acq", kind: "acquire", revoked: false, characterId: "char-1" },
    ]);
    const res = await getShare(
      new NextRequest("http://localhost/api/characters/char-1/share?kind=acquire"),
      params("char-1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.kind).toBe("acquire");
    expect(json.data.url).toContain("/characters/import/tok-acq");
  });

  it("retorna 404 quando o personagem não pertence ao usuário", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    selectResults.push([]);
    const res = await getShare(
      new NextRequest("http://localhost/api/characters/char-1/share"),
      params("char-1"),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/characters/:id/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("sem body emite link view apontando para /public-sheet/:token", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    selectResults.push([characterRow]);
    issueShareLinkMock.mockResolvedValue({ token: "tok-view", kind: "view" });
    const res = await postShare(
      new NextRequest("http://localhost/api/characters/char-1/share", { method: "POST" }),
      params("char-1"),
    );
    expect(res.status).toBe(201);
    expect(issueShareLinkMock).toHaveBeenCalledWith("char-1", "view");
    const json = await res.json();
    expect(json.data.url).toContain("/public-sheet/tok-view");
  });

  it("com kind acquire emite link de aquisição", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    selectResults.push([characterRow]);
    issueShareLinkMock.mockResolvedValue({ token: "tok-acq", kind: "acquire" });
    const res = await postShare(
      new NextRequest("http://localhost/api/characters/char-1/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "acquire" }),
      }),
      params("char-1"),
    );
    expect(res.status).toBe(201);
    expect(issueShareLinkMock).toHaveBeenCalledWith("char-1", "acquire");
    const json = await res.json();
    expect(json.data.url).toContain("/characters/import/tok-acq");
  });

  it("rejeita kind inválido com 400", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    const res = await postShare(
      new NextRequest("http://localhost/api/characters/char-1/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "clone-all" }),
      }),
      params("char-1"),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/characters/:id/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
  });

  it("revoga o link do tipo informado", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    selectResults.push([characterRow]);
    const res = await deleteShare(
      new NextRequest("http://localhost/api/characters/char-1/share?kind=acquire", {
        method: "DELETE",
      }),
      params("char-1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});

describe("GET /api/characters/:id/hub", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await getHub(
      new NextRequest("http://localhost/api/characters/char-1/hub"),
      params("char-1"),
    );
    expect(res.status).toBe(401);
  });

  it("retorna o hub com isOwner e sessão ativa", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    hubMock.mockResolvedValue({
      id: "char-1",
      isOwner: true,
      name: "Artemis",
      level: 5,
      xp: 42,
      xpToNextLevel: 100,
      raceName: "Elfa",
      className: "Ladina",
      description: "Biografia pública",
      activeSession: {
        sessionId: "s-1",
        campaignId: "c-1",
        campaignName: "Strahd",
        scheduledAt: new Date().toISOString(),
      },
    });
    const res = await getHub(
      new NextRequest("http://localhost/api/characters/char-1/hub"),
      params("char-1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isOwner).toBe(true);
    expect(json.data.activeSession.campaignId).toBe("c-1");
  });

  it("retorna 404 quando o personagem não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    hubMock.mockRejectedValue(new Error("Personagem não encontrado"));
    const res = await getHub(
      new NextRequest("http://localhost/api/characters/char-9/hub"),
      params("char-9"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/public-sheet/:token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna apenas a frente off-session", async () => {
    publicMock.mockResolvedValue({
      name: "Artemis",
      imageUrl: null,
      description: "Biografia pública",
      level: 5,
      xp: 42,
      raceName: "Elfa",
      className: "Ladina",
    });
    const res = await getPublicSheet(
      new NextRequest("http://localhost/api/public-sheet/tok-1"),
      tokenParams("tok-1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Artemis");
    expect(json.data).not.toHaveProperty("hitPointsCurrent");
    expect(json.data).not.toHaveProperty("attributes");
  });

  it("retorna 404 para token inválido ou revogado", async () => {
    publicMock.mockRejectedValue(new Error("Link inválido ou revogado"));
    const res = await getPublicSheet(
      new NextRequest("http://localhost/api/public-sheet/tok-x"),
      tokenParams("tok-x"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET/POST /api/characters/import/:token", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preview exige autenticação", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await getImportPreview(
      new NextRequest("http://localhost/api/characters/import/tok-1"),
      tokenParams("tok-1"),
    );
    expect(res.status).toBe(401);
  });

  it("preview retorna identidade e isOwn", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    previewMock.mockResolvedValue({
      characterId: "char-1",
      name: "Artemis",
      imageUrl: null,
      description: null,
      level: 5,
      xp: 42,
      raceName: "Elfa",
      className: "Ladina",
      ownerName: "Maria",
      isOwn: false,
    });
    const res = await getImportPreview(
      new NextRequest("http://localhost/api/characters/import/tok-1"),
      tokenParams("tok-1"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isOwn).toBe(false);
  });

  it("aquisição cria cópia e retorna 201 com novo characterId", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    acquireMock.mockResolvedValue({ characterId: "char-copy" });
    const res = await postAcquire(
      new NextRequest("http://localhost/api/characters/import/tok-1", { method: "POST" }),
      tokenParams("tok-1"),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.characterId).toBe("char-copy");
    expect(acquireMock).toHaveBeenCalledWith("tok-1", "user-1");
  });

  it("aquisição do próprio personagem retorna 409", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    acquireMock.mockRejectedValue(new Error("Você já possui este personagem"));
    const res = await postAcquire(
      new NextRequest("http://localhost/api/characters/import/tok-1", { method: "POST" }),
      tokenParams("tok-1"),
    );
    expect(res.status).toBe(409);
  });

  it("token inválido retorna 404", async () => {
    vi.mocked(requireAuth).mockResolvedValue(authed);
    acquireMock.mockRejectedValue(new Error("Link inválido ou revogado"));
    const res = await postAcquire(
      new NextRequest("http://localhost/api/characters/import/tok-x", { method: "POST" }),
      tokenParams("tok-x"),
    );
    expect(res.status).toBe(404);
  });
});
