/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

const { mockRequireAuth, store } = vi.hoisted(() => {
  const memoryStore = {
    campaigns: [] as any[],
    falloutCampaignStates: [] as any[],
    falloutCharacters: [] as any[],
  };

  return {
    mockRequireAuth: vi.fn(),
    store: memoryStore,
  };
});

function getStoreTable(tableName: string) {
  if (tableName === "campaigns") return store.campaigns;
  if (tableName === "fallout_campaign_states") return store.falloutCampaignStates;
  if (tableName === "fallout_characters") return store.falloutCharacters;
  return [];
}

function matchCondition(item: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.op === "eq") {
    const colName = cond.col?.name || cond.col;
    const camel = colName.replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
    const val = item[camel] !== undefined ? item[camel] : item[colName];
    return val === cond.val;
  }
  if (cond.op === "and") {
    return cond.args.every((c: any) => matchCondition(item, c));
  }
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
  const getTableName = (table: any) => {
    return (
      table?.[Symbol.for("drizzle:Name")] ||
      table?._?.name ||
      table?.tableName ||
      table?.name ||
      "unknown"
    );
  };

  return {
    db: {
      select: () => ({
        from: (table: any) => {
          const tableName = getTableName(table);
          return {
            where: (cond: any) => {
              const list = getStoreTable(tableName);
              const filtered = list.filter((item) => matchCondition(item, cond));
              return {
                limit: (n: number) => Promise.resolve(filtered.slice(0, n)),
                orderBy: () => Promise.resolve(filtered),
                then: (res: any, rej: any) => Promise.resolve(filtered).then(res, rej),
              };
            },
            orderBy: () => {
              const list = getStoreTable(tableName);
              return Promise.resolve(list);
            },
            limit: (n: number) => {
              const list = getStoreTable(tableName);
              return Promise.resolve(list.slice(0, n));
            },
            then: (res: any, rej: any) => Promise.resolve(getStoreTable(tableName)).then(res, rej),
          };
        },
      }),
      insert: (table: any) => ({
        values: (data: any) => {
          const tableName = getTableName(table);
          const list = getStoreTable(tableName);
          const newItem = {
            id: data.id || randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          };
          list.push(newItem);
          return {
            returning: () => Promise.resolve([newItem]),
          };
        },
      }),
      update: (table: any) => ({
        set: (data: any) => ({
          where: (cond: any) => {
            const tableName = getTableName(table);
            const list = getStoreTable(tableName);
            const index = list.findIndex((item) => matchCondition(item, cond));
            if (index !== -1) {
              list[index] = { ...list[index], ...data, updatedAt: new Date() };
              return {
                returning: () => Promise.resolve([list[index]]),
              };
            }
            return {
              returning: () => Promise.resolve([]),
            };
          },
        }),
      }),
    },
  };
});

import { GET as getCharacters, POST as createCharacter } from "../characters/route";
import { PATCH as patchCharacter } from "../characters/[id]/route";
import { GET as getAp, POST as postAp } from "../campaigns/[id]/ap/route";
import { POST as rollPost } from "../roll/route";
import { POST as combatDicePost } from "../combat-dice/route";

describe("Fallout 2d20 — Rotas da API REST", () => {
  const userId = "user-test-123";
  const campaignId = randomUUID();

  beforeEach(() => {
    store.campaigns = [];
    store.falloutCampaignStates = [];
    store.falloutCharacters = [];

    mockRequireAuth.mockResolvedValue({
      user: { id: userId, email: "vault@dweller.com", name: "Sole Survivor" },
    });
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
      store.falloutCharacters.push({
        id: "char-1",
        ownerId: userId,
        campaignId: null,
        name: "Ghoul",
        origin: "ghoul",
        level: 3,
        xp: 300,
        caps: 500,
        hpCurrent: 14,
        hpMax: 14,
        radiation: 0,
        luckPointsCurrent: 5,
        defense: 1,
        initiative: 12,
        meleeDamageBonus: 0,
        carryWeightMax: 200,
        attributes: {},
        skills: {},
        tagSkills: [],
        bodyParts: {},
        items: [],
        perks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

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
      const charId = "char-lucy";
      store.falloutCharacters.push({
        id: charId,
        ownerId: userId,
        campaignId: null,
        name: "Lucy",
        origin: "vault_dweller",
        level: 1,
        xp: 0,
        caps: 50,
        hpCurrent: 12,
        hpMax: 12,
        radiation: 0,
        luckPointsCurrent: 5,
        defense: 1,
        initiative: 10,
        meleeDamageBonus: 0,
        carryWeightMax: 200,
        attributes: {},
        skills: {},
        tagSkills: [],
        bodyParts: {},
        items: [],
        perks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const patchReq = new NextRequest(
        `http://localhost/api/systems/fallout/characters/${charId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            hpCurrent: 8,
            radiation: 3,
            caps: 120,
          }),
        },
      );

      const patchRes = await patchCharacter(patchReq, { params: Promise.resolve({ id: charId }) });
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.data.hpCurrent).toBe(8);
      expect(patchData.data.radiation).toBe(3);
      expect(patchData.data.caps).toBe(120);
    });
  });

  describe("GET & POST /api/systems/fallout/campaigns/[id]/ap", () => {
    it("inicializa e atualiza o pool de Action Points da campanha", async () => {
      const getReq = new NextRequest(
        `http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`,
      );
      const getRes = await getAp(getReq, { params: Promise.resolve({ id: campaignId }) });
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.data.partyAP).toBe(0);
      expect(getData.data.maxPartyAP).toBe(6);

      const postReq = new NextRequest(
        `http://localhost/api/systems/fallout/campaigns/${campaignId}/ap`,
        {
          method: "POST",
          body: JSON.stringify({
            partyAP: 4,
            overseerAP: 2,
          }),
        },
      );

      const postRes = await postAp(postReq, { params: Promise.resolve({ id: campaignId }) });
      const postData = await postRes.json();

      expect(postRes.status).toBe(200);
      expect(postData.data.partyAP).toBe(4);
      expect(postData.data.overseerAP).toBe(2);
    });
  });

  describe("POST /api/systems/fallout/roll", () => {
    it("executa rolagem de 2d20 via API e retorna cálculo de sucessos e AP", async () => {
      const req = new NextRequest("http://localhost/api/systems/fallout/roll", {
        method: "POST",
        body: JSON.stringify({
          attribute: "agi",
          skill: "small_guns",
          attributeValue: 8,
          skillRank: 2,
          isTagSkill: true,
          difficulty: 1,
        }),
      });

      const res = await rollPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.rollResult.targetNumber).toBe(10);
      expect(data.data.rollResult.dice).toHaveLength(2);
    });
  });

  describe("POST /api/systems/fallout/combat-dice", () => {
    it("executa rolagem de Combat Dice (DC) e retorna dano e efeitos", async () => {
      const req = new NextRequest("http://localhost/api/systems/fallout/combat-dice", {
        method: "POST",
        body: JSON.stringify({
          diceCount: 4,
          damageType: "physical",
          damageEffects: ["piercing"],
        }),
      });

      const res = await combatDicePost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.diceCount).toBe(4);
      expect(data.data.dice).toHaveLength(4);
      expect(typeof data.data.totalDamage).toBe("number");
      expect(typeof data.data.totalEffects).toBe("number");
    });
  });
});
