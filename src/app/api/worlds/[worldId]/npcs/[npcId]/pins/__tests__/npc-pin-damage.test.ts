import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { PATCH as patchPin } from "../../pins/[pinId]/route";

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";

function createFluentQuery(resolvedValue: unknown) {
  const query: Record<string, unknown> = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    values: vi.fn(() => query),
    set: vi.fn(() => query),
    returning: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(resolvedValue).then(resolve, reject),
  };
  return query;
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/worlds/w1/npcs/n1/pins", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function patchRequest(body: unknown) {
  return new NextRequest("http://localhost/api/worlds/w1/npcs/n1/pins/p1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const ctx = {
  params: Promise.resolve({ worldId: "w1", npcId: "n1" }),
};
const pinCtx = {
  params: Promise.resolve({ worldId: "w1", npcId: "n1", pinId: "p1" }),
};

function postRequestCtx(body: unknown) {
  return POST(postRequest(body), ctx);
}

function patchRequestCtx(body: unknown) {
  return patchPin(patchRequest(body), pinCtx);
}

const PIN = {
  id: "p1",
  npcId: "n1",
  pinType: "attack",
  label: "Mordissa",
  rollExpression: null,
  attackExpression: "1d20+9",
  damageExpression: "3d6+5",
  damageType: "cortante",
  criticalRange: 19,
};

describe("NPC Pins API — dano configurado (issue #90)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "master-1" } });
  });

  it("POST cria pin de ataque com ataque/dano/tipo/crítico configurados", async () => {
    const npcQuery = createFluentQuery([{ id: "n1", worldId: "w1" }]);
    const worldQuery = createFluentQuery([{ id: "w1", campaignId: "c1" }]);
    const campaignQuery = createFluentQuery([{ id: "c1", masterId: "master-1" }]);
    const insertQuery = createFluentQuery([PIN]);
    vi.mocked(db.select)
      .mockReturnValueOnce(worldQuery as never)
      .mockReturnValueOnce(campaignQuery as never)
      .mockReturnValueOnce(npcQuery as never);
    vi.mocked(db.insert).mockReturnValueOnce(insertQuery as never);

    const response = await postRequestCtx({ ...PIN });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.attackExpression).toBe("1d20+9");
    expect(json.data.damageExpression).toBe("3d6+5");
    expect(json.data.damageType).toBe("cortante");
    expect(json.data.criticalRange).toBe(19);
    expect(insertQuery.values).toHaveBeenCalledWith(
      expect.objectContaining({
        attackExpression: "1d20+9",
        damageExpression: "3d6+5",
        damageType: "cortante",
        criticalRange: 19,
      }),
    );
  });

  it("POST rejeita expressão de ataque inválida com erro PT-BR", async () => {
    const worldQuery = createFluentQuery([{ id: "w1", campaignId: "c1" }]);
    const campaignQuery = createFluentQuery([{ id: "c1", masterId: "master-1" }]);
    const npcQuery = createFluentQuery([{ id: "n1", worldId: "w1" }]);
    vi.mocked(db.select)
      .mockReturnValueOnce(worldQuery as never)
      .mockReturnValueOnce(campaignQuery as never)
      .mockReturnValueOnce(npcQuery as never);

    const response = await postRequestCtx({
      pinType: "attack",
      label: "Mordissa",
      attackExpression: "atacar forte",
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Expressão inválida");
  });

  it("PATCH atualiza campos de dano configurado", async () => {
    const pinQuery = createFluentQuery([{ id: "p1", npcId: "n1" }]);
    const worldQuery = createFluentQuery([{ id: "w1", campaignId: "c1" }]);
    const campaignQuery = createFluentQuery([{ id: "c1", masterId: "master-1" }]);
    const updateQuery = createFluentQuery([{ ...PIN, damageExpression: "2d8+4" }]);

    vi.mocked(db.select)
      .mockReturnValueOnce(worldQuery as never)
      .mockReturnValueOnce(campaignQuery as never)
      .mockReturnValueOnce(pinQuery as never);
    vi.mocked(db.update).mockReturnValueOnce(updateQuery as never);

    const response = await patchRequestCtx({ damageExpression: "2d8+4" });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.damageExpression).toBe("2d8+4");
    expect(updateQuery.set).toHaveBeenCalledWith(
      expect.objectContaining({ damageExpression: "2d8+4" }),
    );
  });

  it("PATCH rejeita faixa de crítico fora de 1..20", async () => {
    const pinQuery = createFluentQuery([{ id: "p1", npcId: "n1" }]);
    const worldQuery = createFluentQuery([{ id: "w1", campaignId: "c1" }]);
    const campaignQuery = createFluentQuery([{ id: "c1", masterId: "master-1" }]);
    vi.mocked(db.select)
      .mockReturnValueOnce(worldQuery as never)
      .mockReturnValueOnce(campaignQuery as never)
      .mockReturnValueOnce(pinQuery as never);

    const response = await patchRequestCtx({ criticalRange: 25 });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("crítico");
  });
});
