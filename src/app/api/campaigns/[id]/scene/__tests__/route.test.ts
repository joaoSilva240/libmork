import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";

const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/auth/campaign-access", () => ({ getCampaignAsMaster: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { requireAuth } = await import("@/lib/auth/session");
const { getCampaignAsMaster } = await import("@/lib/auth/campaign-access");

const MASTER_SESSION = {
  user: { id: "master-1", displayName: "Mestre Teste", masterName: "Mestre Teste" },
  session: { id: "s1" },
};

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/campaigns/c1/scene", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function wireUpdateChain() {
  const where = vi.fn().mockResolvedValue([]);
  const set = vi.fn(() => ({ where }));
  mockUpdate.mockReturnValue({ set });
  return { set, where };
}

function wireInsertChain() {
  const values = vi.fn().mockResolvedValue([]);
  mockInsert.mockReturnValue({ values });
  return values;
}

describe("PATCH /api/campaigns/[id]/scene (issue #86, Fase 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(MASTER_SESSION as never);
    vi.mocked(getCampaignAsMaster).mockResolvedValue({ id: "c1" } as never);
    wireUpdateChain();
    wireInsertChain();
  });

  it("retorna 401 sem sessão", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ scene: "combat" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Não autenticado");
  });

  it("retorna 403 quando não é o mestre da campanha", async () => {
    vi.mocked(getCampaignAsMaster).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ scene: "combat" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(403);
  });

  it("retorna 400 para cena inválida", async () => {
    const res = await PATCH(patchRequest({ scene: "luta" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Cena inválida");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persiste cena válida, registra log e devolve 200", async () => {
    const res = await PATCH(patchRequest({ scene: "combat" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true, data: { campaignId: "c1", scene: "combat" } });

    const { set } = mockUpdate.mock.results[0].value;
    expect(set.mock.calls[0][0]).toMatchObject({ activeScene: "combat" });

    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0]).toMatchObject({
      campaignId: "c1",
      action: "scene_change",
      description: "Cena: Combate iniciada",
      payload: { scene: "combat", encounterAction: null },
    });
  });

  it("scene null (Livre) persiste null com log de desativação", async () => {
    const res = await PATCH(patchRequest({ scene: null }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
    const { set } = mockUpdate.mock.results[0].value;
    expect(set.mock.calls[0][0]).toMatchObject({ activeScene: null });
    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0].description).toBe("Cena desativada — modo Livre");
  });

  it("anexa encounterAction ao log quando informado", async () => {
    await PATCH(patchRequest({ scene: "interlude", encounterAction: "kept" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0].description).toBe(
      "Cena: Interlúdio iniciada — encontro mantido em 2º plano",
    );
  });

  it("ignora encounterAction inválido (grava null)", async () => {
    await PATCH(patchRequest({ scene: "combat", encounterAction: "nope" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    const values = mockInsert.mock.results[0].value.values;
    expect(values.mock.calls[0][0].payload).toEqual({ scene: "combat", encounterAction: null });
  });

  it("retorna 200 mesmo se o insert do log falhar", async () => {
    mockInsert.mockImplementation(() => {
      throw new Error("banco de log indisponível");
    });
    const res = await PATCH(patchRequest({ scene: "stealth" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(res.status).toBe(200);
  });
});
