// =============================================================================
// Libmork — Sistema Fallout 2d20: Camada de Serviços do Servidor
// Gerenciamento de Fichas, Estado de Campanha (AP Pool) e Execução de Rolagens
// =============================================================================

import { db } from "@/lib/db";
import { campaigns, falloutCampaignStates, falloutCharacters } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  createInitialFalloutCharacter,
  evaluateRollDice,
  rollDie,
  rollCombatDice,
  calculateHitLocation,
  clampRadiation,
  getCharacterRadiation,
  getExtraDiceApCost,
  getExtraDiceLuckCost,
  isRadiationImmune,
} from "../systems/fallout/rules";
import type {
  CombatDiceRollResult,
  FalloutAttribute,
  FalloutCampaignState,
  FalloutCharacter,
  FalloutRadiationCondition,
  FalloutRollParams,
  FalloutRollResult,
  FalloutSkillName,
} from "../systems/fallout/types";
import type {
  AdjustFalloutAPInput,
  ApplyFalloutRadiationInput,
  CombatDiceRollInput,
  CreateFalloutCharacterInput,
  FalloutRerollInput,
  FalloutRollInput,
  UpdateFalloutCharacterInput,
} from "../systems/fallout/validators";
import { createPendingRoll, getPendingRoll, type FalloutHitLocation } from "./fallout-roll-store";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Erro de regra de negócio com o status HTTP que a rota deve devolver. */
export class FalloutServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 410,
  ) {
    super(message);
    this.name = "FalloutServiceError";
  }
}

// =============================================================================
// Estado da Campanha (AP Pool)
// =============================================================================

function mapCampaignState(row: typeof falloutCampaignStates.$inferSelect): FalloutCampaignState {
  return {
    campaignId: row.campaignId,
    partyAP: row.partyAP,
    maxPartyAP: row.maxPartyAP,
    overseerAP: row.overseerAP,
    scarcityLevel: row.scarcityLevel as FalloutCampaignState["scarcityLevel"],
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Trava a linha do pool para que débitos e créditos simultâneos não se percam. */
async function lockCampaignState(tx: DbExecutor, campaignId: string) {
  const [existing] = await tx
    .select()
    .from(falloutCampaignStates)
    .where(eq(falloutCampaignStates.campaignId, campaignId))
    .for("update")
    .limit(1);

  if (existing) return existing;

  await tx
    .insert(falloutCampaignStates)
    .values({
      campaignId,
      partyAP: 0,
      maxPartyAP: 6,
      overseerAP: 0,
      scarcityLevel: "standard",
    })
    .onConflictDoNothing();

  const [created] = await tx
    .select()
    .from(falloutCampaignStates)
    .where(eq(falloutCampaignStates.campaignId, campaignId))
    .for("update")
    .limit(1);

  return created;
}

async function writeCampaignState(
  tx: DbExecutor,
  campaignId: string,
  patch: { partyAP?: number; overseerAP?: number },
) {
  const [updated] = await tx
    .update(falloutCampaignStates)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(falloutCampaignStates.campaignId, campaignId))
    .returning();

  return mapCampaignState(updated);
}

export async function getOrCreateFalloutCampaignState(
  campaignId: string,
): Promise<FalloutCampaignState> {
  return db.transaction(async (tx) => mapCampaignState(await lockCampaignState(tx, campaignId)));
}

async function loadCampaign(campaignId: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  return campaign ?? null;
}

async function hasFalloutCharacterInCampaign(campaignId: string, userId: string) {
  const [row] = await db
    .select({ id: falloutCharacters.id })
    .from(falloutCharacters)
    .where(and(eq(falloutCharacters.campaignId, campaignId), eq(falloutCharacters.ownerId, userId)))
    .limit(1);
  return !!row;
}

/**
 * Move o pool por delta. O Supervisor mexe nos dois pools; quem tem ficha na
 * campanha só move o AP da equipe.
 */
export async function adjustFalloutCampaignAP(
  campaignId: string,
  input: AdjustFalloutAPInput,
  userId: string,
): Promise<FalloutCampaignState> {
  const campaign = await loadCampaign(campaignId);
  if (!campaign) throw new FalloutServiceError("Campanha não encontrada", 404);

  if (campaign.masterId !== userId) {
    if (input.deltaOverseer !== 0) {
      throw new FalloutServiceError("Apenas o Supervisor move o AP do Supervisor", 403);
    }
    if (!(await hasFalloutCharacterInCampaign(campaignId, userId))) {
      throw new FalloutServiceError("Você não participa desta campanha", 403);
    }
  }

  return db.transaction(async (tx) => {
    const state = await lockCampaignState(tx, campaignId);
    return writeCampaignState(tx, campaignId, {
      partyAP: Math.max(0, Math.min(state.partyAP + input.deltaParty, state.maxPartyAP)),
      overseerAP: Math.max(0, state.overseerAP + input.deltaOverseer),
    });
  });
}

// =============================================================================
// Personagens de Fallout 2d20
// =============================================================================

export async function getFalloutCharactersByCampaign(
  campaignId: string,
): Promise<FalloutCharacter[]> {
  const records = await db
    .select()
    .from(falloutCharacters)
    .where(eq(falloutCharacters.campaignId, campaignId))
    .orderBy(desc(falloutCharacters.createdAt));

  return records.map(mapDbToFalloutCharacter);
}

export async function getFalloutCharactersByUser(userId: string): Promise<FalloutCharacter[]> {
  const records = await db
    .select()
    .from(falloutCharacters)
    .where(eq(falloutCharacters.ownerId, userId))
    .orderBy(desc(falloutCharacters.createdAt));

  return records.map(mapDbToFalloutCharacter);
}

export async function getFalloutCharacterById(id: string): Promise<FalloutCharacter | null> {
  const [record] = await db
    .select()
    .from(falloutCharacters)
    .where(eq(falloutCharacters.id, id))
    .limit(1);

  if (!record) return null;
  return mapDbToFalloutCharacter(record);
}

export async function createFalloutCharacterRecord(
  input: CreateFalloutCharacterInput,
  ownerId: string,
): Promise<FalloutCharacter> {
  const initial = createInitialFalloutCharacter(input, ownerId);

  const [inserted] = await db
    .insert(falloutCharacters)
    .values({
      campaignId: initial.campaignId || null,
      ownerId: initial.ownerId,
      name: initial.name,
      origin: initial.origin,
      level: initial.level,
      xp: initial.xp,
      caps: initial.caps,
      hpCurrent: initial.hpCurrent,
      hpMax: initial.hpMax,
      radiation: initial.radiation,
      luckPointsCurrent: initial.luckPointsCurrent,
      defense: initial.defense,
      initiative: initial.initiative,
      meleeDamageBonus: initial.meleeDamageBonus,
      carryWeightMax: initial.carryWeightMax,
      attributes: initial.attributes,
      skills: initial.skills,
      tagSkills: initial.tagSkills,
      bodyParts: initial.bodyParts,
      items: initial.items,
      perks: initial.perks,
    })
    .returning();

  return mapDbToFalloutCharacter(inserted);
}

export async function updateFalloutCharacterRecord(
  id: string,
  input: UpdateFalloutCharacterInput,
  userId: string,
): Promise<FalloutCharacter | null> {
  const existing = await getFalloutCharacterById(id);
  if (!existing) return null;

  // Permite edição pelo dono ou pelo mestre da campanha
  if (existing.ownerId !== userId) {
    if (existing.campaignId) {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, existing.campaignId))
        .limit(1);
      if (campaign?.masterId !== userId) {
        throw new Error("Não autorizado");
      }
    } else {
      throw new Error("Não autorizado");
    }
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) patch.name = input.name;
  if (input.level !== undefined) patch.level = input.level;
  if (input.xp !== undefined) patch.xp = input.xp;
  if (input.hpCurrent !== undefined) patch.hpCurrent = input.hpCurrent;
  if (input.radiation !== undefined) patch.radiation = input.radiation;
  if (input.luckPointsCurrent !== undefined) patch.luckPointsCurrent = input.luckPointsCurrent;
  if (input.caps !== undefined) patch.caps = input.caps;
  if (input.attributes !== undefined) {
    patch.attributes = { ...existing.attributes, ...input.attributes };
  }
  if (input.skills !== undefined) {
    patch.skills = { ...existing.skills, ...input.skills };
  }
  if (input.tagSkills !== undefined) patch.tagSkills = input.tagSkills;
  if (input.bodyParts !== undefined) {
    patch.bodyParts = { ...existing.bodyParts, ...input.bodyParts };
  }
  if (input.items !== undefined) patch.items = input.items;
  if (input.perks !== undefined) patch.perks = input.perks;

  const [updated] = await db
    .update(falloutCharacters)
    .set(patch)
    .where(eq(falloutCharacters.id, id))
    .returning();

  return mapDbToFalloutCharacter(updated);
}

// =============================================================================
// Execução de Rolagens
// =============================================================================

export interface FalloutRollOutcome {
  rollId: string;
  rollResult: FalloutRollResult;
  hitLocation: FalloutHitLocation | null;
  rerolledIndexes: number[];
  ap: FalloutCampaignState | null;
  /** AP debitado do pool para comprar dados extras nesta rolagem. */
  apCost: number;
  /** AP creditado no pool por sucessos excedentes. */
  apGenerated: number;
  /** Pontos de Sorte gastos (dados extras fora de campanha). */
  luckCost: number;
  luckPointsCurrent: number;
  radiation: FalloutRadiationCondition;
  baseDifficulty: number;
  character: { id: string; name: string };
}

export interface FalloutRerollOutcome extends FalloutRollOutcome {
  dieIndex: number;
}

export interface FalloutRadiationOutcome {
  campaignId: string;
  delta: number;
  updated: {
    characterId: string;
    name: string;
    radiation: number;
    hpCurrent: number;
    hpMax: number;
    condition: FalloutRadiationCondition;
  }[];
  immune: { characterId: string; name: string; origin: string }[];
}

async function loadAuthorizedCharacter(characterId: string, userId: string) {
  const character = await getFalloutCharacterById(characterId);
  if (!character) throw new FalloutServiceError("Personagem não encontrado", 404);

  if (character.ownerId !== userId) {
    const campaign = character.campaignId ? await loadCampaign(character.campaignId) : null;
    if (campaign?.masterId !== userId) {
      throw new FalloutServiceError("Não autorizado", 403);
    }
  }

  return character;
}

/** Número Alvo, graduação e Tag vêm da ficha persistida, nunca do cliente. */
function resolveRollParams(
  character: FalloutCharacter,
  attribute: FalloutAttribute,
  skill: FalloutSkillName | undefined,
  difficulty: number,
  extraDiceCount: number,
  complicationThreshold: number,
): FalloutRollParams {
  const skillState = skill ? character.skills?.[skill] : undefined;
  return {
    attributeValue: character.attributes?.[attribute] ?? 5,
    skillRank: skillState?.rank ?? 0,
    isTagSkill: !!skill && (!!skillState?.isTag || character.tagSkills?.includes(skill)),
    extraDiceCount,
    difficulty,
    complicationThreshold,
  };
}

async function lockCharacterRow(tx: DbExecutor, characterId: string) {
  const [row] = await tx
    .select()
    .from(falloutCharacters)
    .where(eq(falloutCharacters.id, characterId))
    .for("update")
    .limit(1);
  return row;
}

/**
 * Executa o teste 2d20 com autoridade total no servidor: resolve o TN da ficha,
 * cobra os dados extras (AP da equipe, ou Sorte quando a ficha está avulsa),
 * credita o AP gerado e guarda o teste para permitir re-rolagens com Sorte.
 */
export async function executeAuthoritativeFalloutRoll(
  input: FalloutRollInput,
  userId: string,
): Promise<FalloutRollOutcome> {
  const character = await loadAuthorizedCharacter(input.characterId, userId);
  const radiation = getCharacterRadiation(character);
  const difficulty = Math.min(10, input.difficulty + radiation.difficultyPenalty);

  const params = resolveRollParams(
    character,
    input.attribute,
    input.skill,
    difficulty,
    input.extraDiceCount,
    input.complicationThreshold,
  );

  const apCost = character.campaignId ? getExtraDiceApCost(input.extraDiceCount) : 0;
  const luckCost = character.campaignId ? 0 : getExtraDiceLuckCost(input.extraDiceCount);
  const diceCount = 2 + input.extraDiceCount;
  const values = Array.from({ length: diceCount }, () => rollDie(20));
  const rollResult = evaluateRollDice(values, params);
  const hitLocation = input.rollLocation ? calculateHitLocation() : null;

  const { ap, luckPointsCurrent } = await db.transaction(async (tx) => {
    let nextLuck = character.luckPointsCurrent;

    if (luckCost > 0) {
      const row = await lockCharacterRow(tx, character.id);
      if (!row || row.luckPointsCurrent < luckCost) {
        throw new FalloutServiceError(
          `Pontos de Sorte insuficientes: ${luckCost} necessário(s), ${row?.luckPointsCurrent ?? 0} disponível(is)`,
          409,
        );
      }
      nextLuck = row.luckPointsCurrent - luckCost;
      await tx
        .update(falloutCharacters)
        .set({ luckPointsCurrent: nextLuck, updatedAt: new Date() })
        .where(eq(falloutCharacters.id, character.id));
    }

    if (!character.campaignId) return { ap: null, luckPointsCurrent: nextLuck };

    const state = await lockCampaignState(tx, character.campaignId);
    if (state.partyAP < apCost) {
      throw new FalloutServiceError(
        `AP insuficiente: ${apCost} AP necessário(s), ${state.partyAP} no pool da equipe`,
        409,
      );
    }

    const nextParty = Math.max(
      0,
      Math.min(state.partyAP - apCost + rollResult.apGenerated, state.maxPartyAP),
    );

    return {
      ap: await writeCampaignState(tx, character.campaignId, { partyAP: nextParty }),
      luckPointsCurrent: nextLuck,
    };
  });

  const pending = createPendingRoll({
    characterId: character.id,
    campaignId: character.campaignId,
    params,
    values,
    result: rollResult,
    hitLocation,
  });

  return {
    rollId: pending.id,
    rollResult,
    hitLocation,
    rerolledIndexes: [],
    ap,
    apCost,
    apGenerated: ap ? rollResult.apGenerated : 0,
    luckCost,
    luckPointsCurrent,
    radiation,
    baseDifficulty: input.difficulty,
    character: { id: character.id, name: character.name },
  };
}

/**
 * Re-rola um único dado de um teste falho por 1 Ponto de Sorte.
 * Cada dado só pode ser re-rolado uma vez, e o teste deixa de aceitar
 * re-rolagens assim que vira sucesso.
 */
export async function rerollFalloutDieWithLuck(
  input: FalloutRerollInput,
  userId: string,
): Promise<FalloutRerollOutcome> {
  const pending = getPendingRoll(input.rollId);
  if (!pending) {
    throw new FalloutServiceError("Este teste expirou. Faça uma nova rolagem.", 410);
  }

  const character = await loadAuthorizedCharacter(pending.characterId, userId);

  if (pending.result.isSuccess) {
    throw new FalloutServiceError("Só é possível re-rolar dados de um teste falho", 409);
  }
  if (input.dieIndex >= pending.values.length) {
    throw new FalloutServiceError("Dado inexistente neste teste", 400);
  }
  if (pending.rerolledIndexes.includes(input.dieIndex)) {
    throw new FalloutServiceError("Este dado já foi re-rolado", 409);
  }

  const newValue = rollDie(20);

  const { ap, luckPointsCurrent, rollResult, apGenerated } = await db.transaction(async (tx) => {
    const row = await lockCharacterRow(tx, character.id);
    if (!row || row.luckPointsCurrent < 1) {
      throw new FalloutServiceError("Pontos de Sorte insuficientes", 409);
    }

    const nextLuck = row.luckPointsCurrent - 1;
    await tx
      .update(falloutCharacters)
      .set({ luckPointsCurrent: nextLuck, updatedAt: new Date() })
      .where(eq(falloutCharacters.id, character.id));

    const nextValues = [...pending.values];
    nextValues[input.dieIndex] = newValue;
    const nextResult = evaluateRollDice(nextValues, pending.params);
    const generated = Math.max(0, nextResult.apGenerated - pending.result.apGenerated);

    if (!pending.campaignId) {
      return {
        ap: null,
        luckPointsCurrent: nextLuck,
        rollResult: nextResult,
        apGenerated: 0,
      };
    }

    const state = await lockCampaignState(tx, pending.campaignId);
    const updatedState = await writeCampaignState(tx, pending.campaignId, {
      partyAP: Math.max(0, Math.min(state.partyAP + generated, state.maxPartyAP)),
    });

    return {
      ap: updatedState,
      luckPointsCurrent: nextLuck,
      rollResult: nextResult,
      apGenerated: generated,
    };
  });

  pending.values[input.dieIndex] = newValue;
  pending.result = rollResult;
  pending.rerolledIndexes.push(input.dieIndex);

  return {
    rollId: pending.id,
    rollResult,
    hitLocation: pending.hitLocation,
    rerolledIndexes: [...pending.rerolledIndexes],
    ap,
    apCost: 0,
    apGenerated,
    luckCost: 1,
    luckPointsCurrent,
    radiation: getCharacterRadiation(character),
    baseDifficulty: pending.params.difficulty ?? 1,
    character: { id: character.id, name: character.name },
    dieIndex: input.dieIndex,
  };
}

/**
 * Aplica radiação a sobreviventes da campanha. Só o Supervisor pode irradiar,
 * e as origens imunes são barradas aqui também — não apenas na interface.
 */
export async function applyFalloutRadiation(
  input: ApplyFalloutRadiationInput,
  userId: string,
): Promise<FalloutRadiationOutcome> {
  const campaign = await loadCampaign(input.campaignId);
  if (!campaign) throw new FalloutServiceError("Campanha não encontrada", 404);
  if (campaign.masterId !== userId) {
    throw new FalloutServiceError("Apenas o Supervisor aplica radiação", 403);
  }

  const roster = await getFalloutCharactersByCampaign(input.campaignId);
  const targets = roster.filter((c) => input.characterIds.includes(c.id));
  if (targets.length === 0) {
    throw new FalloutServiceError("Nenhum sobrevivente desta campanha foi selecionado", 404);
  }

  const immune = targets
    .filter((c) => isRadiationImmune(c.origin))
    .map((c) => ({ characterId: c.id, name: c.name, origin: c.origin }));
  const affected = targets.filter((c) => !isRadiationImmune(c.origin));

  const updated = await db.transaction(async (tx) => {
    const results: FalloutRadiationOutcome["updated"] = [];

    for (const target of affected) {
      const row = await lockCharacterRow(tx, target.id);
      if (!row) continue;

      const radiation = clampRadiation(row.radiation + input.delta, row.hpMax);
      const condition = getCharacterRadiation({ ...target, radiation });
      const hpCurrent = Math.min(row.hpCurrent, condition.effectiveMaxHp);

      await tx
        .update(falloutCharacters)
        .set({ radiation, hpCurrent, updatedAt: new Date() })
        .where(eq(falloutCharacters.id, target.id));

      results.push({
        characterId: target.id,
        name: target.name,
        radiation,
        hpCurrent,
        hpMax: row.hpMax,
        condition,
      });
    }

    return results;
  });

  return { campaignId: input.campaignId, delta: input.delta, updated, immune };
}

export function executeCombatDiceRoll(input: CombatDiceRollInput): CombatDiceRollResult {
  return rollCombatDice(input.diceCount);
}

// =============================================================================
// Helper de Mapeamento
// =============================================================================

function mapDbToFalloutCharacter(row: typeof falloutCharacters.$inferSelect): FalloutCharacter {
  return {
    id: row.id,
    campaignId: row.campaignId,
    ownerId: row.ownerId,
    name: row.name,
    origin: row.origin as any,
    level: row.level,
    xp: row.xp,
    caps: row.caps,
    hpCurrent: row.hpCurrent,
    hpMax: row.hpMax,
    radiation: row.radiation,
    luckPointsCurrent: row.luckPointsCurrent,
    defense: row.defense,
    initiative: row.initiative,
    meleeDamageBonus: row.meleeDamageBonus,
    carryWeightMax: row.carryWeightMax,
    attributes: (row.attributes as any) || {},
    skills: (row.skills as any) || {},
    tagSkills: (row.tagSkills as any) || [],
    bodyParts: (row.bodyParts as any) || {},
    items: (row.items as any) || [],
    perks: (row.perks as any) || [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
