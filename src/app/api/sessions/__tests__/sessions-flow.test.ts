import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getFeed } from "../route";
import { GET as getSession, PATCH as patchSession } from "../[id]/route";
import { GET as getCandidates, POST as postCandidate } from "../[id]/candidates/route";
import { PATCH as patchCandidate } from "../[id]/candidates/[userId]/route";
import { GET as getPlayerCalendar } from "../../player/calendar/route";

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/server/session-service", () => ({
  getSessionFeed: vi.fn(),
  getSessionDetail: vi.fn(),
  confirmSession: vi.fn(),
  cancelSession: vi.fn(),
  listSessionCandidates: vi.fn(),
  applyToSession: vi.fn(),
  decideCandidate: vi.fn(),
  listPlayerCalendar: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { requireAuth } = await import("@/lib/auth/session");
const {
  getSessionFeed,
  getSessionDetail,
  confirmSession,
  cancelSession,
  listSessionCandidates,
  applyToSession,
  decideCandidate,
  listPlayerCalendar,
} = await import("@/lib/server/session-service");

const mockSession = {
  id: "s-1",
  campaignId: "c-1",
  campaignName: "Strahd",
  coverImageUrl: null,
  masterId: "m-1",
  masterName: "João",
  masterAvatar: null,
  description: "Sessão de abertura em Barovia",
  proposedStart: "2026-12-01T00:00:00.000Z",
  proposedEnd: "2026-12-03T23:59:59.000Z",
  scheduledAt: null,
  durationMinutes: 240,
  xpReward: 500,
  sessionType: "one_shot",
  maxSlots: 4,
  acceptedCount: 1,
  interestedCount: 2,
  remainingSlots: 3,
  status: "proposed",
  userApplication: null,
  createdAt: new Date().toISOString(),
};

const mockCandidate = {
  userId: "u-2",
  displayName: "Maria",
  avatarUrl: null,
  characterId: "ch-1",
  characterName: "Artemis",
  availableDays: ["2026-12-01", "2026-12-02"],
  preferredStart: "19:00",
  preferredEnd: "23:00",
  allDay: false,
  status: "interested",
  appliedAt: new Date().toISOString(),
};

describe("GET /api/sessions (feed)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const req = new NextRequest("http://localhost/api/sessions?page=1");
    const res = await getFeed(req);
    expect(res.status).toBe(401);
  });

  it("retorna feed paginado", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-1" } } as never);
    vi.mocked(getSessionFeed).mockResolvedValue({
      items: [mockSession],
      page: 1,
      hasMore: false,
    } as never);
    const req = new NextRequest("http://localhost/api/sessions?page=1");
    const res = await getFeed(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items).toHaveLength(1);
    expect(json.data.hasMore).toBe(false);
    expect(getSessionFeed).toHaveBeenCalledWith("u-1", 1);
  });

  it("sanitiza página inválida para 1", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-1" } } as never);
    vi.mocked(getSessionFeed).mockResolvedValue({ items: [], page: 1, hasMore: false } as never);
    const req = new NextRequest("http://localhost/api/sessions?page=abc");
    const res = await getFeed(req);
    expect(res.status).toBe(200);
    expect(getSessionFeed).toHaveBeenCalledWith("u-1", 1);
  });
});

describe("GET /api/sessions/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o detalhe da sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-1" } } as never);
    vi.mocked(getSessionDetail).mockResolvedValue(mockSession as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1");
    const res = await getSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("s-1");
  });

  it("retorna 404 quando não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-1" } } as never);
    vi.mocked(getSessionDetail).mockRejectedValue(new Error("Sessão não encontrada"));
    const req = new NextRequest("http://localhost/api/sessions/s-x");
    const res = await getSession(req, { params: Promise.resolve({ id: "s-x" }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/sessions/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirma a sessão com durationMinutes default", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(confirmSession).mockResolvedValue({
      ...mockSession,
      status: "confirmed",
      scheduledAt: "2026-12-02T22:00:00.000Z",
    } as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", scheduledAt: "2026-12-02T22:00:00.000Z" }),
    });
    const res = await patchSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(200);
    expect(confirmSession).toHaveBeenCalledWith("s-1", "m-1", "2026-12-02T22:00:00.000Z", 240);
    const json = await res.json();
    expect(json.data.status).toBe("confirmed");
  });

  it("cancela a sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(cancelSession).mockResolvedValue(undefined as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await patchSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(200);
    expect(cancelSession).toHaveBeenCalledWith("s-1", "m-1");
  });

  it("retorna 409 quando a sessão já foi confirmada", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(confirmSession).mockRejectedValue(new Error("Sessão já confirmada ou cancelada"));
    const req = new NextRequest("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", scheduledAt: "2026-12-02T22:00:00.000Z" }),
    });
    const res = await patchSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(409);
  });

  it("retorna 409 quando a data está fora do período proposto", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(confirmSession).mockRejectedValue(new Error("Data final fora do período proposto"));
    const req = new NextRequest("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", scheduledAt: "2026-12-10T22:00:00.000Z" }),
    });
    const res = await patchSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(409);
  });

  it("retorna 403 para quem não é o mestre", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-2" } } as never);
    vi.mocked(cancelSession).mockRejectedValue(
      new Error("Apenas o Mestre pode gerenciar sessões desta campanha"),
    );
    const req = new NextRequest("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const res = await patchSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 400 para action inválida", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    });
    const res = await patchSession(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
  });
});

describe("GET/POST /api/sessions/:id/candidates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista candidaturas para o mestre", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(listSessionCandidates).mockResolvedValue([mockCandidate] as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates");
    const res = await getCandidates(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].displayName).toBe("Maria");
  });

  it("retorna 403 no panorama para não-mestre", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-9" } } as never);
    vi.mocked(listSessionCandidates).mockRejectedValue(
      new Error("Apenas o Mestre pode gerenciar sessões desta campanha"),
    );
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates");
    const res = await getCandidates(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(403);
  });

  it("cria candidatura com 201", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-2" } } as never);
    vi.mocked(applyToSession).mockResolvedValue(mockCandidate as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: "550e8400-e29b-41d4-a716-446655440001",
        availableDays: ["2026-12-01", "2026-12-02"],
        preferredStart: "19:00",
        preferredEnd: "23:00",
      }),
    });
    const res = await postCandidate(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.userId).toBe("u-2");
  });

  it("retorna 409 quando as vagas esgotaram", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-3" } } as never);
    vi.mocked(applyToSession).mockRejectedValue(new Error("Vagas esgotadas"));
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableDays: ["2026-12-01"] }),
    });
    const res = await postCandidate(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(409);
  });

  it("retorna 400 quando nenhum dia é válido", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-2" } } as never);
    vi.mocked(applyToSession).mockRejectedValue(new Error("Selecione ao menos um dia disponível"));
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableDays: ["2027-01-01"] }),
    });
    const res = await postCandidate(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando o mestre tenta candidatar-se", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(applyToSession).mockRejectedValue(
      new Error("O mestre não pode candidatar-se à própria sessão"),
    );
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableDays: ["2026-12-01"] }),
    });
    const res = await postCandidate(req, { params: Promise.resolve({ id: "s-1" }) });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/sessions/:id/candidates/:userId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aceita a candidatura", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(decideCandidate).mockResolvedValue({ ...mockCandidate, status: "accepted" } as never);
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates/u-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "accepted" }),
    });
    const res = await patchCandidate(req, {
      params: Promise.resolve({ id: "s-1", userId: "u-2" }),
    });
    expect(res.status).toBe(200);
    expect(decideCandidate).toHaveBeenCalledWith("s-1", "m-1", "u-2", "accepted");
    const json = await res.json();
    expect(json.data.status).toBe("accepted");
  });

  it("retorna 409 quando estoura as vagas", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(decideCandidate).mockRejectedValue(new Error("Vagas esgotadas"));
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates/u-3", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "accepted" }),
    });
    const res = await patchCandidate(req, {
      params: Promise.resolve({ id: "s-1", userId: "u-3" }),
    });
    expect(res.status).toBe(409);
  });

  it("retorna 404 quando a candidatura não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(decideCandidate).mockRejectedValue(new Error("Candidatura não encontrada"));
    const req = new NextRequest("http://localhost/api/sessions/s-1/candidates/u-x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "rejected" }),
    });
    const res = await patchCandidate(req, {
      params: Promise.resolve({ id: "s-1", userId: "u-x" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/player/calendar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await getPlayerCalendar();
    expect(res.status).toBe(401);
  });

  it("lista as sessões confirmadas do jogador", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u-2" } } as never);
    vi.mocked(listPlayerCalendar).mockResolvedValue([
      {
        sessionId: "s-1",
        campaignId: "c-1",
        campaignName: "Strahd",
        coverImageUrl: null,
        description: "Sessão de abertura",
        scheduledAt: "2026-12-02T22:00:00.000Z",
        durationMinutes: 240,
        sessionType: "one_shot",
        xpReward: null,
      },
    ] as never);
    const res = await getPlayerCalendar();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].sessionId).toBe("s-1");
  });
});
