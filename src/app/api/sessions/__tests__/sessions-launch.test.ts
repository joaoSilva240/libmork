import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postSession } from "../route";
import { GET as getMasterSessions } from "../master/route";
import { GET as getSessionContextRoute } from "../../campaigns/[id]/session-context/route";
import { GET as getEnrolledPlayers } from "../../campaigns/[id]/enrolled-players/route";

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/server/session-service", () => ({
  launchSession: vi.fn(),
  listMasterSessions: vi.fn(),
  getSessionContext: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { requireAuth } = await import("@/lib/auth/session");
const { launchSession, listMasterSessions, getSessionContext } = await import(
  "@/lib/server/session-service"
);

const UUID = "550e8400-e29b-41d4-a716-446655440000";

const launchBody = {
  campaignId: UUID,
  description: "Sessão de abertura em Barovia",
  proposedStart: "2026-12-01T00:00:00.000Z",
  proposedEnd: "2026-12-03T23:59:59.000Z",
  sessionType: "one_shot",
  maxSlots: 4,
};

const mockSession = {
  id: "s-1",
  campaignId: UUID,
  campaignName: "Strahd",
  coverImageUrl: null,
  masterId: "m-1",
  masterName: "João",
  masterAvatar: null,
  description: launchBody.description,
  proposedStart: launchBody.proposedStart,
  proposedEnd: launchBody.proposedEnd,
  scheduledAt: null,
  durationMinutes: 240,
  xpReward: null,
  sessionType: "one_shot",
  maxSlots: 4,
  acceptedCount: 0,
  interestedCount: 0,
  remainingSlots: 4,
  status: "proposed",
  userApplication: null,
  createdAt: new Date().toISOString(),
};

describe("POST /api/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(launchBody),
    });
    const res = await postSession(req);
    expect(res.status).toBe(401);
  });

  it("retorna 400 para body inválido", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...launchBody, description: "curta" }),
    });
    const res = await postSession(req);
    expect(res.status).toBe(400);
  });

  it("lança a sessão com 201", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(launchSession).mockResolvedValue(mockSession as never);
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(launchBody),
    });
    const res = await postSession(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.id).toBe("s-1");
  });

  it("retorna 403 quando não é o mestre da campanha", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-2" } } as never);
    vi.mocked(launchSession).mockRejectedValue(
      new Error("Apenas o Mestre pode gerenciar sessões desta campanha"),
    );
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(launchBody),
    });
    const res = await postSession(req);
    expect(res.status).toBe(403);
  });

  it("retorna 400 quando a primeira sessão não informa tipo/vagas", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(launchSession).mockRejectedValue(
      new Error("Tipo de sessão e vagas são obrigatórios na primeira sessão"),
    );
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: UUID,
        description: "Sessão de abertura em Barovia",
        proposedStart: "2026-12-01T00:00:00.000Z",
        proposedEnd: "2026-12-03T23:59:59.000Z",
      }),
    });
    const res = await postSession(req);
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando a campanha não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(launchSession).mockRejectedValue(new Error("Campanha não encontrada"));
    const req = new NextRequest("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(launchBody),
    });
    const res = await postSession(req);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/sessions/master", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await getMasterSessions();
    expect(res.status).toBe(401);
  });

  it("lista as sessões do mestre", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(listMasterSessions).mockResolvedValue([mockSession] as never);
    const res = await getMasterSessions();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
  });
});

describe("GET /api/campaigns/:id/session-context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna contexto de primeira sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(getSessionContext).mockResolvedValue({
      isFirstSession: true,
      oneShot: null,
      maxPlayers: null,
      enrolledPlayers: [],
    } as never);
    const req = new NextRequest(`http://localhost/api/campaigns/${UUID}/session-context`);
    const res = await getSessionContextRoute(req, { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isFirstSession).toBe(true);
  });

  it("retorna 403 para quem não é o mestre", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-2" } } as never);
    vi.mocked(getSessionContext).mockRejectedValue(
      new Error("Apenas o Mestre pode gerenciar sessões desta campanha"),
    );
    const req = new NextRequest(`http://localhost/api/campaigns/${UUID}/session-context`);
    const res = await getSessionContextRoute(req, { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(403);
  });

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const req = new NextRequest(`http://localhost/api/campaigns/${UUID}/session-context`);
    const res = await getSessionContextRoute(req, { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/campaigns/:id/enrolled-players", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista inscritos da campanha", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(getSessionContext).mockResolvedValue({
      isFirstSession: false,
      oneShot: false,
      maxPlayers: 5,
      enrolledPlayers: [{ userId: "u-2", displayName: "Maria", characterName: "Artemis" }],
    } as never);
    const req = new NextRequest(`http://localhost/api/campaigns/${UUID}/enrolled-players`);
    const res = await getEnrolledPlayers(req, { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].displayName).toBe("Maria");
  });

  it("retorna 404 quando a campanha não existe", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "m-1" } } as never);
    vi.mocked(getSessionContext).mockRejectedValue(new Error("Campanha não encontrada"));
    const req = new NextRequest(`http://localhost/api/campaigns/${UUID}/enrolled-players`);
    const res = await getEnrolledPlayers(req, { params: Promise.resolve({ id: UUID }) });
    expect(res.status).toBe(404);
  });
});
