// =============================================================================
// Libmork — Sistema Fallout 2d20: Camada de Serviços do Servidor
// Gerenciamento de Fichas, Estado de Campanha (AP Pool) e Execução de Rolagens
// =============================================================================

import { db } from "@/lib/db";
import { campaigns, falloutCampaignStates, falloutCharacters } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  createInitialFalloutCharacter,
  roll2d20,
  rollCombatDice,
  calculateHitLocation,
} from "../systems/fallout/rules";
import type {
  CombatDiceRollResult,
  FalloutCampaignState,
  FalloutCharacter,
  FalloutRollResult,
} from "../systems/fallout/types";
import type {
  CombatDiceRollInput,
  CreateFalloutCharacterInput,
  FalloutRollInput,
  UpdateFalloutCampaignStateInput,
  UpdateFalloutCharacterInput,
} from "../systems/fallout/validators";

// =============================================================================
// Estado da Campanha (AP Pool)
// =============================================================================

export async function getOrCreateFalloutCampaignState(
  campaignId: string,
): Promise<FalloutCampaignState> {
  const [existing] = await db
    .select()
    .from(falloutCampaignStates)
    .where(eq(falloutCampaignStates.campaignId, campaignId))
    .limit(1);

  if (existing) {
    return {
      campaignId: existing.campaignId,
      partyAP: existing.partyAP,
      maxPartyAP: existing.maxPartyAP,
      overseerAP: existing.overseerAP,
      scarcityLevel: existing.scarcityLevel as any,
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const [inserted] = await db
    .insert(falloutCampaignStates)
    .values({
      campaignId,
      partyAP: 0,
      maxPartyAP: 6,
      overseerAP: 0,
      scarcityLevel: "standard",
    })
    .returning();

  return {
    campaignId: inserted.campaignId,
    partyAP: inserted.partyAP,
    maxPartyAP: inserted.maxPartyAP,
    overseerAP: inserted.overseerAP,
    scarcityLevel: inserted.scarcityLevel as any,
    updatedAt: inserted.updatedAt.toISOString(),
  };
}

export async function updateFalloutCampaignState(
  campaignId: string,
  input: UpdateFalloutCampaignStateInput,
): Promise<FalloutCampaignState> {
  const currentState = await getOrCreateFalloutCampaignState(campaignId);

  const newPartyAP =
    input.partyAP !== undefined
      ? Math.max(0, Math.min(input.partyAP, currentState.maxPartyAP))
      : currentState.partyAP;

  const newOverseerAP =
    input.overseerAP !== undefined ? Math.max(0, input.overseerAP) : currentState.overseerAP;

  const newScarcity = input.scarcityLevel || currentState.scarcityLevel;

  const [updated] = await db
    .update(falloutCampaignStates)
    .set({
      partyAP: newPartyAP,
      overseerAP: newOverseerAP,
      scarcityLevel: newScarcity,
      updatedAt: new Date(),
    })
    .where(eq(falloutCampaignStates.campaignId, campaignId))
    .returning();

  return {
    campaignId: updated.campaignId,
    partyAP: updated.partyAP,
    maxPartyAP: updated.maxPartyAP,
    overseerAP: updated.overseerAP,
    scarcityLevel: updated.scarcityLevel as any,
    updatedAt: updated.updatedAt.toISOString(),
  };
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

export function executeFalloutRoll(input: FalloutRollInput): {
  rollResult: FalloutRollResult;
  hitLocation?: { location: string; label: string; roll: number };
} {
  const rollResult = roll2d20({
    attributeValue: input.attributeValue,
    skillRank: input.skillRank,
    isTagSkill: input.isTagSkill,
    extraDiceCount: input.extraDiceCount,
    difficulty: input.difficulty,
    complicationThreshold: input.complicationThreshold,
  });

  let hitLocation: { location: string; label: string; roll: number } | undefined;
  if (input.rollLocation) {
    hitLocation = calculateHitLocation();
  }

  return { rollResult, hitLocation };
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
