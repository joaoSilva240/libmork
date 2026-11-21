/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { randomUUID } from "crypto";

const { store, txCalls } = vi.hoisted(() => ({
  store: {
    campaigns: [] as any[],
    falloutCampaignStates: [] as any[],
    falloutCharacters: [] as any[],
  },
  txCalls: { count: 0 },
}));

function tableRows(table: any): any[] {
  const name = table?.[Symbol.for("drizzle:Name")] || table?.name;
  if (name === "campaigns") return store.campaigns;
  if (name === "fallout_campaign_states") return store.falloutCampaignStates;
  if (name === "fallout_characters") return store.falloutCharacters;
  return [];
}

function matches(item: any, cond: any): boolean {
  if (!cond) return true;
  if (cond.op === "eq") {
    const colName = cond.col?.name ?? cond.col;
    const camel = String(colName).replace(/_([a-z])/g, (_: any, l: string) => l.toUpperCase());
    return (item[camel] !== undefined ? item[camel] : item[colName]) === cond.val;
  }
  if (cond.op === "and") return cond.args.every((c: any) => matches(item, c));
  return true;
}

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: any, val: any) => ({ op: "eq", col, val }),
    and: (...args: any[]) => ({ op: "and", args }),
    desc: (col: any) => col,
  };
});

vi.mock("@/lib/db", () => {
  const selectChain = (table: any) => {
    const state: { cond: any } = { cond: null };
    const rows = () => tableRows(table).filter((item) => matches(item, state.cond));
    const chain: any = {
      where(cond: any) {
        state.cond = cond;
        return chain;
      },
      for: () => chain,
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
          const rows = tableRows(table);
          applied = [];
          rows.forEach((row) => {
            if (matches(row, state.cond)) {
              Object.assign(row, data);
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
    transaction: async (cb: any) => {
      txCalls.count += 1;
      return cb(dbMock);
    },
  };

  return { db: dbMock };
});

import {
  adjustFalloutCampaignAP,
  applyFalloutRadiation,
  executeAuthoritativeFalloutRoll,
  rerollFalloutDieWithLuck,
  FalloutServiceError,
} from "../fallout-service";
import { clearPendingRolls } from "../fallout-roll-store";
import { createInitialFalloutCharacter } from "@/lib/systems/fallout/rules";

const masterId = randomUUID();
const playerId = randomUUID();
const outsiderId = randomUUID();
const campaignId = randomUUID();

function seedCharacter(overrides: Record<string, any> = {}) {
  const base = createInitialFalloutCharacter(
    {
      name: "Lucy MacLean",
      origin: "vault_dweller",
      level: 1,
      xp: 0,
      attributes: { str: 5, per: 6, end: 6, cha: 7, int: 6, agi: 9, luc: 5 },
      tagSkills: ["small_guns"],
      perks: [],
      caps: 0,
      campaignId,
    },
    playerId,
    randomUUID(),
  );

  const skills = { ...base.skills };
  skills.small_guns = { name: "small_guns", rank: 4, isTag: true };

  const row = {
    ...base,
    skills,
    hpMax: 20,
    hpCurrent: 20,
    luckPointsCurrent: 5,
    radiation: 0,
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

/** Math.random fixo => todas as faces de d20 saem iguais. */
function fixDice(random: number) {
  return vi.spyOn(Math, "random").mockReturnValue(random);
}

beforeEach(() => {
  store.campaigns = [{ id: campaignId, masterId, name: "Wasteland" }];
  store.falloutCampaignStates = [];
  store.falloutCharacters = [];
  txCalls.count = 0;
  clearPendingRolls();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Fallout 2d20 — Rolagem autoritativa", () => {
  it("resolve o Número Alvo pela ficha, ignorando qualquer valor vindo do cliente", async () => {
    const char = seedCharacter();
    seedState(3);
    fixDice(0.5);

    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        skill: "small_guns",
        difficulty: 1,
        extraDiceCount: 0,
        complicationThreshold: 20,
        rollLocation: false,
        // Campos que um cliente malicioso poderia injetar:
        ...({ attributeValue: 25, skillRank: 6, isTagSkill: true } as any),
      },
      playerId,
    );

    expect(outcome.rollResult.targetNumber).toBe(13); // AGI 9 + rank 4
    expect(outcome.rollResult.criticalThreshold).toBe(4); // Tag Skill
    expect(outcome.rollResult.dice).toHaveLength(2);
  });

  it("debita o custo dos dados extras e credita o AP gerado na mesma operação", async () => {
    const char = seedCharacter();
    const state = seedState(2);
    fixDice(0); // todos os dados saem 1 => crítico

    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        skill: "small_guns",
        difficulty: 4,
        extraDiceCount: 1,
        complicationThreshold: 20,
        rollLocation: false,
      },
      playerId,
    );

    expect(outcome.apCost).toBe(1);
    expect(outcome.rollResult.totalSuccesses).toBe(6); // 3 dados críticos
    expect(outcome.apGenerated).toBe(2);
    expect(outcome.ap?.partyAP).toBe(3); // 2 - 1 + 2
    expect(state.partyAP).toBe(3);
    expect(txCalls.count).toBe(1);
  });

  it("recusa dados extras quando o pool não cobre o custo e não altera nada", async () => {
    const char = seedCharacter();
    const state = seedState(0);
    fixDice(0);

    await expect(
      executeAuthoritativeFalloutRoll(
        {
          characterId: char.id,
          attribute: "agi",
          skill: "small_guns",
          difficulty: 1,
          extraDiceCount: 3,
          complicationThreshold: 20,
          rollLocation: false,
        },
        playerId,
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("AP insuficiente") });

    expect(state.partyAP).toBe(0);
  });

  it("cobra o custo em Pontos de Sorte quando a ficha está fora de campanha", async () => {
    const char = seedCharacter({ campaignId: null });
    fixDice(0.5);

    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        skill: "small_guns",
        difficulty: 1,
        extraDiceCount: 2,
        complicationThreshold: 20,
        rollLocation: false,
      },
      playerId,
    );

    expect(outcome.ap).toBeNull();
    expect(outcome.luckCost).toBe(2);
    expect(outcome.luckPointsCurrent).toBe(3);
    expect(store.falloutCharacters[0].luckPointsCurrent).toBe(3);
  });

  it("recusa dados extras fora de campanha sem Sorte suficiente", async () => {
    const char = seedCharacter({ campaignId: null, luckPointsCurrent: 1 });
    fixDice(0.5);

    await expect(
      executeAuthoritativeFalloutRoll(
        {
          characterId: char.id,
          attribute: "agi",
          difficulty: 1,
          extraDiceCount: 2,
          complicationThreshold: 20,
          rollLocation: false,
        },
        playerId,
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(store.falloutCharacters[0].luckPointsCurrent).toBe(1);
  });

  it("soma a penalidade de dificuldade da radiação ao teste", async () => {
    const char = seedCharacter({ radiation: 10, hpMax: 20 }); // 50% => Debilitado
    seedState(0);
    fixDice(0.5);

    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        skill: "small_guns",
        difficulty: 1,
        extraDiceCount: 0,
        complicationThreshold: 20,
        rollLocation: false,
      },
      playerId,
    );

    expect(outcome.baseDifficulty).toBe(1);
    expect(outcome.rollResult.difficulty).toBe(2);
    expect(outcome.radiation.stage).toBe("weakened");
  });

  it("não aplica penalidade de radiação a origens imunes", async () => {
    const char = seedCharacter({ origin: "ghoul", radiation: 15, hpMax: 20 });
    seedState(0);
    fixDice(0.5);

    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        difficulty: 1,
        extraDiceCount: 0,
        complicationThreshold: 20,
        rollLocation: false,
      },
      playerId,
    );

    expect(outcome.radiation.stage).toBe("clean");
    expect(outcome.rollResult.difficulty).toBe(1);
  });

  it("bloqueia quem não é dono nem mestre da campanha", async () => {
    const char = seedCharacter();
    seedState(0);

    await expect(
      executeAuthoritativeFalloutRoll(
        {
          characterId: char.id,
          attribute: "agi",
          difficulty: 1,
          extraDiceCount: 0,
          complicationThreshold: 20,
          rollLocation: false,
        },
        outsiderId,
      ),
    ).rejects.toBeInstanceOf(FalloutServiceError);
  });

  it("permite que o mestre role pela ficha de um jogador", async () => {
    const char = seedCharacter();
    seedState(0);
    fixDice(0.5);

    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        difficulty: 1,
        extraDiceCount: 0,
        complicationThreshold: 20,
        rollLocation: false,
      },
      masterId,
    );

    expect(outcome.character.id).toBe(char.id);
  });
});

describe("Fallout 2d20 — Re-rolagem com Pontos de Sorte", () => {
  async function rollFailing(extraDiceCount = 0) {
    const char = seedCharacter();
    seedState(extraDiceCount > 0 ? 6 : 0);
    const high = fixDice(0.999); // todos os dados saem 20 => falha
    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        skill: "small_guns",
        difficulty: 1,
        extraDiceCount,
        complicationThreshold: 20,
        rollLocation: false,
      },
      playerId,
    );
    high.mockRestore();
    return { char, outcome };
  }

  it("gasta 1 Ponto de Sorte por dado re-rolado e pode virar o teste", async () => {
    const { char, outcome } = await rollFailing();
    expect(outcome.rollResult.isSuccess).toBe(false);

    fixDice(0); // re-rolagem sai 1 => crítico com 2 sucessos
    const rerolled = await rerollFalloutDieWithLuck(
      { rollId: outcome.rollId, dieIndex: 0 },
      playerId,
    );

    expect(rerolled.luckCost).toBe(1);
    expect(rerolled.luckPointsCurrent).toBe(4);
    expect(rerolled.rollResult.isSuccess).toBe(true);
    expect(rerolled.rerolledIndexes).toEqual([0]);
    expect(rerolled.dieIndex).toBe(0);
    expect(store.falloutCharacters[0].id).toBe(char.id);
    expect(store.falloutCharacters[0].luckPointsCurrent).toBe(4);
  });

  it("credita no pool o AP que a re-rolagem passou a gerar", async () => {
    const { outcome } = await rollFailing();
    const state = store.falloutCampaignStates[0];
    expect(state.partyAP).toBe(0);

    fixDice(0);
    const first = await rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 0 }, playerId);
    expect(first.rollResult.totalSuccesses).toBe(2);
    expect(first.apGenerated).toBe(1);
    expect(state.partyAP).toBe(1);
    expect(first.ap?.partyAP).toBe(1);
  });

  it("não deixa re-rolar o mesmo dado duas vezes", async () => {
    const { outcome } = await rollFailing(1);
    fixDice(0.999); // continua falhando para permitir nova tentativa

    await rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 0 }, playerId);

    await expect(
      rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 0 }, playerId),
    ).rejects.toMatchObject({ status: 409, message: "Este dado já foi re-rolado" });
  });

  it("recusa re-rolagem depois que o teste virou sucesso", async () => {
    const { outcome } = await rollFailing(1);
    fixDice(0);
    await rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 0 }, playerId);

    await expect(
      rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 1 }, playerId),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("teste falho") });
  });

  it("recusa re-rolagem sem Pontos de Sorte", async () => {
    const char = seedCharacter({ luckPointsCurrent: 0 });
    seedState(0);
    fixDice(0.999);
    const outcome = await executeAuthoritativeFalloutRoll(
      {
        characterId: char.id,
        attribute: "agi",
        difficulty: 1,
        extraDiceCount: 0,
        complicationThreshold: 20,
        rollLocation: false,
      },
      playerId,
    );

    await expect(
      rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 0 }, playerId),
    ).rejects.toMatchObject({ status: 409, message: "Pontos de Sorte insuficientes" });

    expect(store.falloutCharacters[0].luckPointsCurrent).toBe(0);
  });

  it("recusa teste expirado ou inexistente", async () => {
    await expect(
      rerollFalloutDieWithLuck({ rollId: randomUUID(), dieIndex: 0 }, playerId),
    ).rejects.toMatchObject({ status: 410 });
  });

  it("recusa índice de dado fora do teste", async () => {
    const { outcome } = await rollFailing();
    await expect(
      rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 4 }, playerId),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("bloqueia re-rolagem por quem não é dono nem mestre", async () => {
    const { outcome } = await rollFailing();
    await expect(
      rerollFalloutDieWithLuck({ rollId: outcome.rollId, dieIndex: 0 }, outsiderId),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("Fallout 2d20 — Ajuste do pool por delta", () => {
  it("aplica deltas e respeita os limites do pool", async () => {
    const state = seedState(5, 1);

    const up = await adjustFalloutCampaignAP(
      campaignId,
      { deltaParty: 4, deltaOverseer: 2 },
      masterId,
    );
    expect(up.partyAP).toBe(6);
    expect(up.overseerAP).toBe(3);

    const down = await adjustFalloutCampaignAP(
      campaignId,
      { deltaParty: -10, deltaOverseer: -10 },
      masterId,
    );
    expect(down.partyAP).toBe(0);
    expect(down.overseerAP).toBe(0);
    expect(state.partyAP).toBe(0);
  });

  it("jogador com ficha na campanha move o AP da equipe", async () => {
    seedCharacter();
    seedState(1);

    const state = await adjustFalloutCampaignAP(
      campaignId,
      { deltaParty: 1, deltaOverseer: 0 },
      playerId,
    );
    expect(state.partyAP).toBe(2);
  });

  it("jogador não move o AP do Supervisor", async () => {
    seedCharacter();
    seedState(1);

    await expect(
      adjustFalloutCampaignAP(campaignId, { deltaParty: 0, deltaOverseer: 1 }, playerId),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("usuário sem ficha na campanha não move o pool", async () => {
    seedState(1);

    await expect(
      adjustFalloutCampaignAP(campaignId, { deltaParty: 1, deltaOverseer: 0 }, outsiderId),
    ).rejects.toMatchObject({ status: 403 });

    expect(store.falloutCampaignStates[0].partyAP).toBe(1);
  });
});

describe("Fallout 2d20 — Medidor de Radiação", () => {
  it("aplica radiação, corta o teto de PV e arrasta os PV atuais", async () => {
    const char = seedCharacter({ hpMax: 20, hpCurrent: 20, radiation: 0 });

    const result = await applyFalloutRadiation(
      { campaignId, characterIds: [char.id], delta: 8 },
      masterId,
    );

    expect(result.updated).toHaveLength(1);
    expect(result.updated[0].radiation).toBe(8);
    expect(result.updated[0].condition.effectiveMaxHp).toBe(12);
    expect(result.updated[0].condition.stage).toBe("sickened");
    expect(result.updated[0].hpCurrent).toBe(12);
    expect(store.falloutCharacters[0].hpCurrent).toBe(12);
  });

  it("reduz radiação com delta negativo sem devolver PV já perdido", async () => {
    const char = seedCharacter({ hpMax: 20, hpCurrent: 10, radiation: 10 });

    const result = await applyFalloutRadiation(
      { campaignId, characterIds: [char.id], delta: -6 },
      masterId,
    );

    expect(result.updated[0].radiation).toBe(4);
    expect(result.updated[0].hpCurrent).toBe(10);
  });

  it("nunca passa de 100% do teto de PV nem fica negativa", async () => {
    const char = seedCharacter({ hpMax: 12, hpCurrent: 12, radiation: 10 });

    const over = await applyFalloutRadiation(
      { campaignId, characterIds: [char.id], delta: 20 },
      masterId,
    );
    expect(over.updated[0].radiation).toBe(12);
    expect(over.updated[0].condition.stage).toBe("incapacitated");
    expect(over.updated[0].hpCurrent).toBe(0);

    const under = await applyFalloutRadiation(
      { campaignId, characterIds: [char.id], delta: -20 },
      masterId,
    );
    expect(under.updated[0].radiation).toBe(0);
  });

  it("ignora ghoul, super mutante e mister handy mesmo se o cliente os enviar", async () => {
    const ghoul = seedCharacter({ origin: "ghoul", name: "Cooper" });
    const mutant = seedCharacter({ origin: "super_mutant", name: "Marcus" });
    const robot = seedCharacter({ origin: "mister_handy", name: "Codsworth" });
    const human = seedCharacter({ origin: "wastelander", name: "Lucy" });

    const result = await applyFalloutRadiation(
      { campaignId, characterIds: [ghoul.id, mutant.id, robot.id, human.id], delta: 5 },
      masterId,
    );

    expect(result.immune.map((i) => i.name).sort()).toEqual(["Codsworth", "Cooper", "Marcus"]);
    expect(result.updated.map((u) => u.name)).toEqual(["Lucy"]);
    expect(store.falloutCharacters.find((c) => c.id === ghoul.id)!.radiation).toBe(0);
    expect(store.falloutCharacters.find((c) => c.id === human.id)!.radiation).toBe(5);
  });

  it("só o Supervisor aplica radiação", async () => {
    const char = seedCharacter();

    await expect(
      applyFalloutRadiation({ campaignId, characterIds: [char.id], delta: 3 }, playerId),
    ).rejects.toMatchObject({ status: 403 });

    expect(store.falloutCharacters[0].radiation).toBe(0);
  });

  it("não irradia ficha de outra campanha", async () => {
    const foreign = seedCharacter({ campaignId: randomUUID() });

    await expect(
      applyFalloutRadiation({ campaignId, characterIds: [foreign.id], delta: 3 }, masterId),
    ).rejects.toMatchObject({ status: 404 });
  });
});
