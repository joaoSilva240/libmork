import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
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

const ctx = { params: Promise.resolve({ worldId: "w1", npcId: "n1" }) };

function fluent(value: unknown) {
  const q: Record<string, unknown> = {
    from: vi.fn(() => q),
    where: vi.fn(() => q),
    orderBy: vi.fn(() => q),
    limit: vi.fn().mockResolvedValue(value),
    values: vi.fn(() => q),
    returning: vi.fn().mockResolvedValue(value),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(value).then(res, rej),
  };
  return q;
}

const LIBRARY_ATTACK = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Mordissa",
  attackExpression: "1d20+9",
  damageExpression: "3d6+5",
  damageType: "cortante",
  criticalRange: 19,
};

const CREATED_PIN = {
  id: "p1",
  npcId: "n1",
  pinType: "attack",
  label: "Mordissa",
  contentId: "11111111-1111-4111-8111-111111111111",
  attackExpression: "1d20+9",
  damageExpression: "3d6+5",
  damageType: "cortante",
  criticalRange: 19,
};

describe("NPC Pins API — ataque da Biblioteca Global (issue #90 follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "master-1" } });
  });

  it("POST com contentId de ataque da biblioteca herda os campos do ataque", async () => {
    const worldQ = fluent([{ id: "w1", campaignId: "c1" }]);
    const campaignQ = fluent([{ id: "c1", masterId: "master-1" }]);
    const npcQ = fluent([{ id: "n1", worldId: "w1" }]);
    const attackQ = fluent([LIBRARY_ATTACK]);
    const insertQ = fluent([CREATED_PIN]);

    vi.mocked(db.select)
      .mockReturnValueOnce(worldQ as never)
      .mockReturnValueOnce(campaignQ as never)
      .mockReturnValueOnce(npcQ as never)
      .mockReturnValueOnce(attackQ as never);
    vi.mocked(db.insert).mockReturnValueOnce(insertQ as never);

    const response = await POST(
      new NextRequest("http://localhost/api/worlds/w1/npcs/n1/pins", {
        method: "POST",
        body: JSON.stringify({
          pinType: "attack",
          label: "placeholder",
          contentId: "11111111-1111-4111-8111-111111111111",
        }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.data.attackExpression).toBe("1d20+9");
    expect(json.data.damageExpression).toBe("3d6+5");
    expect(json.data.damageType).toBe("cortante");
    expect(json.data.criticalRange).toBe(19);
  });

  it("POST rejeita contentId de ataque inexistente", async () => {
    const worldQ = fluent([{ id: "w1", campaignId: "c1" }]);
    const campaignQ = fluent([{ id: "c1", masterId: "master-1" }]);
    const npcQ = fluent([{ id: "n1", worldId: "w1" }]);
    const attackQ = fluent([]);
    vi.mocked(db.select)
      .mockReturnValueOnce(worldQ as never)
      .mockReturnValueOnce(campaignQ as never)
      .mockReturnValueOnce(npcQ as never)
      .mockReturnValueOnce(attackQ as never);

    const response = await POST(
      new NextRequest("http://localhost/api/worlds/w1/npcs/n1/pins", {
        method: "POST",
        body: JSON.stringify({ pinType: "attack", label: "x", contentId: "22222222-2222-4222-8222-222222222222" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx
    );

    expect(response.status).toBe(404);
  });
});
