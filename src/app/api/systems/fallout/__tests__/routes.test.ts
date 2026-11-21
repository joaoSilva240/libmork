/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

const { mockRequireAuth, store } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  store: {
    campaigns: [] as any[],
    falloutCampaignStates: [] as any[],
    falloutCharacters: [] as any[],
  },
}));

function tableRows(table: any): any[] {
  const name = table?.[Symbol.for("drizzle:Name")] || table?.name;
  if (name === "campaigns") return store.campaigns;
  if (name === "fallout_campaign_states") return store.falloutCampaignStates;
  if (name === "fallout_characters") return store.falloutCharacters;
  return [];
}

function matchCondition(item: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.op === "eq") {
    const colName = cond.col?.name ?? cond.col;
    const camel = String(colName).replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
    const val = item[camel] !== undefined ? item[camel] : item[colName];
    return val === cond.val;
  }
  if (cond.op === "and") return cond.args.every((c: any) => matchCondition(item, c));
  return true;
}

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: any, val: any) => ({ op: "eq", col, val }),
    and: (...args: any[]) => ({ op: "and", args }),
    desc: (col: any) => col,
    asc: (col: any) => col,
  };
});

vi.mock("@/lib/db", () => {
  const selectChain = (table: any) => {
    const state: { cond: any } = { cond: null };
    const rows = () => tableRows(table).filter((item) => matchCondition(item, state.cond));
    const chain: any = {
      where(cond: any) {
        state.cond = cond;
        return chain;
      },
      for: () => chain,
      innerJoin: () => chain,
      limit: (n: number) => Promise.resolve(rows().slice(0, n)),
      orderBy: () => Promise.resolve(rows()),
      then: (res: any, rej: any) => Promise.resolve(rows()).then(res, rej),
    };
    return chain;
  };

  const dbMock: any = {
    select: () => ({ from: (table: any) => selectChain(table) }),
    insert: (table: any) => ({
      values: (data: any) => {
        const rows = tableRows(table);
        const item = {
          id: data.id || randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        const commit = () => {
          const clash =
            table?.[Symbol.for("drizzle:Name")] === "fallout_campaign_states" &&
            rows.some((r) => r.campaignId === data.campaignId);
          if (!clash) rows.push(item);
          return clash ? [] : [item];
        };
        const chain: any = {
          returning: () => Promise.resolve(commit()),
          onConflictDoNothing: () => chain,
          then: (res: any, rej: any) => Promise.resolve(commit()).then(res, rej),
        };
        return chain;
      },
    }),
    update: (table: any) => ({
      set: (data: any) => {
        const state: { cond: any } = { cond: null };
        let applied: any[] | null = null;
        const commit = () => {
          if (applied) return applied;
          applied = [];
          tableRows(table).forEach((row) => {
            if (matchCondition(row, state.cond)) {
              Object.assign(row, data, { updatedAt: new Date() });
              applied!.push(row);
            }
          });
          return applied;
        };
        const chain: any = {
          where(cond: any) {
            state.cond = cond;
            return chain;
          },
          returning: () => Promise.resolve(commit()),
          then: (res: any, rej: any) => Promise.resolve(commit()).then(res, rej),
        };
        return chain;
      },
    }),
    transaction: async (cb: any) => cb(dbMock),
  };

  return { db: dbMock };
});

import { GET as getCharacters, POST as createCharacter } from "../characters/route";
import { PATCH as patchCharacter } from "../characters/[id]/route";
import { GET as getAp, POST as postAp } from "../campaigns/[id]/ap/route";
import { POST as rollPost } from "../roll/route";
import { POST as rerollPost } from "../roll/reroll/route";
import { POST as radiationPost } from "../radiation/route";
import { POST as combatDicePost } from "../combat-dice/route";
import { clearPendingRolls } from "@/lib/server/fallout-roll-store";
import { createInitialFalloutCharacter } from "@/lib/systems/fallout/rules";

describe("Fallout 2d20 — Rotas da API REST", () => {
  const userId = randomUUID();
  const campaignId = randomUUID();

  function seedCharacter(overrides: Record<string, any> = {}) {
    const base = createInitialFalloutCharacter(
      {
        name: "Lucy",
        origin: "vault_dweller",
        level: 1,
        xp: 0,
        attributes: { str: 5, per: 6, end: 6, cha: 7, int: 6, agi: 9, luc: 5 },
        tagSkills: ["small_guns"],
        perks: [],
        caps: 0,
        campaignId,
      },
      userId,
      randomUUID(),
    );
    const row = {
      ...base,
      hpMax: 20,
      hpCurrent: 20,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    store.falloutCharacters.push(row);
    return row;
  }

  function seedState(partyAP: number, overseerAP = 0) {
    const row = {
      id: randomUUID(),
      campaignId,
      partyAP,
      maxPartyAP: 6,
      overseerAP,
      scarcityLevel: "standard",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.falloutCampaignStates.push(row);
    return row;
  }

  beforeEach(() => {
    store.campaigns = [{ id: campaignId, masterId: userId, name: "Wasteland" }];
    store.falloutCampaignStates = [];
    store.falloutCharacters = [];
    clearPendingRolls();

    mockRequireAuth.mockResolvedValue({
      user: { id: userId, email: "vault@dweller.com", name: "Sole Survivor" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST & GET /api/systems/fallout/characters", () => {
    it("cria um personagem e retorna status 201", async () => {
      const req = new NextRequest("http://localhost/api/systems/fallout/characters", {
        method: "POST",
        body: JSON.stringify({
          name: "Lucy MacLean",
          origin: "vault_dweller",
          attributes: { str: 5, per: 6, end: 6, cha: 7, int: 6, agi: 5, luc: 5 },
          tagSkills: ["repair", "science", "speech"],
          caps: 100,
        }),
      });

      const res = await createCharacter(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Lucy MacLean");
      expect(data.data.hpMax).toBe(11); // END 6 + LUC 5
      expect(data.data.tagSkills).toEqual(["repair", "science", "speech"]);
    });

    it("recupera a lista de personagens do usuário", async () => {
      seedCharacter({ name: "Ghoul", origin: "ghoul", campaignId: null });

      const req = new NextRequest("http://localhost/api/systems/fallout/characters");
      const res = await getCharacters(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Ghoul");
    });
  });

  describe("GET & PATCH /api/systems/fallout/characters/[id]", () => {
    it("obtém e atualiza HP e radiação do personagem", async () => {
      const char = seedCharacter({ hpMax: 12, hpCurrent: 12, caps: 50 });

      const patchReq = new NextRequest(
        `http://localhost/api/systems/fallout/characters/${char.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ hpCurrent: 8, radiation: 3, caps: 120 }),
        },
      );

      const patchRes = await patchCharacter(patchReq, { params: Promise.resolve({ id: char.id }) });
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.data.hpCurrent).toBe(8);
      expect(patchData.data.radiation).toBe(3);
      expect(patchData.data.caps).toBe(120);
    });
  });

  describe("GET & POST /api/systems/fallout/campaigns/[id]/ap", () => {
    it("inicializa o pool e aplica ajustes por delta", async () => {
      const getRes = await getAp(
        new NextRequest(`http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`),
        { params: Promise.resolve({ id: campaignId }) },
      );
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.data.partyAP).toBe(0);
      expect(getData.data.maxPartyAP).toBe(6);

      const postRes = await postAp(
        new NextRequest(`http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`, {
          method: "POST",
          body: JSON.stringify({ deltaParty: 4, deltaOverseer: 2 }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );
      const postData = await postRes.json();

      expect(postRes.status).toBe(200);
      expect(postData.data.partyAP).toBe(4);
      expect(postData.data.overseerAP).toBe(2);

      const spendRes = await postAp(
        new NextRequest(`http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`, {
          method: "POST",
          body: JSON.stringify({ deltaParty: -3 }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );
      expect((await spendRes.json()).data.partyAP).toBe(1);
    });

    it("rejeita o antigo contrato de valor absoluto", async () => {
      seedState(0);

      const res = await postAp(
        new NextRequest(`http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`, {
          method: "POST",
          body: JSON.stringify({ partyAP: 6, overseerAP: 99 }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      expect(res.status).toBe(400);
      expect(store.falloutCampaignStates[0].partyAP).toBe(0);
    });

    it("bloqueia usuário sem vínculo com a campanha", async () => {
      seedState(2);
      mockRequireAuth.mockResolvedValue({ user: { id: randomUUID() } });

      const res = await postAp(
        new NextRequest(`http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`, {
          method: "POST",
          body: JSON.stringify({ deltaParty: 4 }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      expect(res.status).toBe(403);
      expect(store.falloutCampaignStates[0].partyAP).toBe(2);
    });

    it("exige autenticação", async () => {
      mockRequireAuth.mockResolvedValue(null);

      const res = await postAp(
        new NextRequest(`http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`, {
          method: "POST",
          body: JSON.stringify({ deltaParty: 1 }),
        }),
        { params: Promise.resolve({ id: campaignId }) },
      );

      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/systems/fallout/roll", () => {
    it("resolve o teste pela ficha e devolve o pool já atualizado", async () => {
      const char = seedCharacter();
      seedState(3);
      vi.spyOn(Math, "random").mockReturnValue(0); // todos os dados saem 1

      const res = await rollPost(
        new NextRequest("http://localhost/api/systems/fallout/roll", {
          method: "POST",
          body: JSON.stringify({
            characterId: char.id,
            attribute: "agi",
            skill: "small_guns",
            difficulty: 4,
            extraDiceCount: 1,
          }),
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.rollResult.targetNumber).toBe(9); // AGI 9 + rank 0
      expect(data.data.rollResult.dice).toHaveLength(3);
      expect(data.data.apCost).toBe(1);
      expect(data.data.ap.partyAP).toBe(4); // 3 - 1 de custo + 2 gerados
      expect(data.data.rollId).toBeTruthy();
    });

    it("recusa pedido sem characterId", async () => {
      const res = await rollPost(
        new NextRequest("http://localhost/api/systems/fallout/roll", {
          method: "POST",
          body: JSON.stringify({ attribute: "agi", attributeValue: 20, skillRank: 6 }),
        }),
      );

      expect(res.status).toBe(400);
    });

    it("devolve 409 quando o pool não cobre os dados extras", async () => {
      const char = seedCharacter();
      seedState(0);

      const res = await rollPost(
        new NextRequest("http://localhost/api/systems/fallout/roll", {
          method: "POST",
          body: JSON.stringify({
            characterId: char.id,
            attribute: "agi",
            extraDiceCount: 2,
          }),
        }),
      );

      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/AP insuficiente/);
    });
  });

  describe("POST /api/systems/fallout/roll/reroll", () => {
    async function failingRoll(charId: string) {
      vi.spyOn(Math, "random").mockReturnValue(0.999);
      const res = await rollPost(
        new NextRequest("http://localhost/api/systems/fallout/roll", {
          method: "POST",
          body: JSON.stringify({ characterId: charId, attribute: "agi", difficulty: 1 }),
        }),
      );
      const data = await res.json();
      vi.restoreAllMocks();
      mockRequireAuth.mockResolvedValue({ user: { id: userId } });
      return data.data;
    }

    it("gasta 1 Ponto de Sorte e devolve o teste recalculado", async () => {
      const char = seedCharacter({ luckPointsCurrent: 5 });
      seedState(0);
      const rolled = await failingRoll(char.id);
      expect(rolled.rollResult.isSuccess).toBe(false);

      vi.spyOn(Math, "random").mockReturnValue(0);
      const res = await rerollPost(
        new NextRequest("http://localhost/api/systems/fallout/roll/reroll", {
          method: "POST",
          body: JSON.stringify({ rollId: rolled.rollId, dieIndex: 0 }),
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.luckPointsCurrent).toBe(4);
      expect(data.data.rollResult.isSuccess).toBe(true);
      expect(data.data.ap.partyAP).toBe(1);
    });

    it("devolve 410 para teste expirado", async () => {
      const res = await rerollPost(
        new NextRequest("http://localhost/api/systems/fallout/roll/reroll", {
          method: "POST",
          body: JSON.stringify({ rollId: randomUUID(), dieIndex: 0 }),
        }),
      );

      expect(res.status).toBe(410);
    });
  });

  describe("POST /api/systems/fallout/radiation", () => {
    it("aplica radiação aos alvos e reporta os imunes", async () => {
      const human = seedCharacter({ name: "Lucy" });
      const ghoul = seedCharacter({ name: "Cooper", origin: "ghoul" });

      const res = await radiationPost(
        new NextRequest("http://localhost/api/systems/fallout/radiation", {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            characterIds: [human.id, ghoul.id],
            delta: 5,
          }),
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.updated).toHaveLength(1);
      expect(data.data.updated[0].radiation).toBe(5);
      expect(data.data.updated[0].hpCurrent).toBe(15);
      expect(data.data.immune[0].name).toBe("Cooper");
    });

    it("só o mestre da campanha aplica radiação", async () => {
      const human = seedCharacter();
      mockRequireAuth.mockResolvedValue({ user: { id: randomUUID() } });

      const res = await radiationPost(
        new NextRequest("http://localhost/api/systems/fallout/radiation", {
          method: "POST",
          body: JSON.stringify({ campaignId, characterIds: [human.id], delta: 5 }),
        }),
      );

      expect(res.status).toBe(403);
    });

    it("recusa delta zero ou lista vazia", async () => {
      const human = seedCharacter();

      const zero = await radiationPost(
        new NextRequest("http://localhost/api/systems/fallout/radiation", {
          method: "POST",
          body: JSON.stringify({ campaignId, characterIds: [human.id], delta: 0 }),
        }),
      );
      expect(zero.status).toBe(400);

      const empty = await radiationPost(
        new NextRequest("http://localhost/api/systems/fallout/radiation", {
          method: "POST",
          body: JSON.stringify({ campaignId, characterIds: [], delta: 2 }),
        }),
      );
      expect(empty.status).toBe(400);
    });
  });

  describe("POST /api/systems/fallout/combat-dice", () => {
    it("executa rolagem de Combat Dice (DC) e retorna dano e efeitos", async () => {
      const res = await combatDicePost(
        new NextRequest("http://localhost/api/systems/fallout/combat-dice", {
          method: "POST",
          body: JSON.stringify({
            diceCount: 4,
            damageType: "physical",
            damageEffects: ["piercing"],
          }),
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.diceCount).toBe(4);
      expect(data.data.dice).toHaveLength(4);
      expect(typeof data.data.totalDamage).toBe("number");
      expect(typeof data.data.totalEffects).toBe("number");
    });
  });
});
