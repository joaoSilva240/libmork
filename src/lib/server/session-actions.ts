// =============================================================================
// Libmork — Ações de Sessão do Escudo do Mestre (RF-035, RF-049, RF-050)
// =============================================================================
// Aplicação de deltas de HP/Mana/XP (com level-up automático, D-18) e de
// condições sobre personagens/NPCs, registrando tudo em campaign_logs.
// =============================================================================

import { db } from "@/lib/db";
import {
  characters,
  npcs,
  campaignLogs,
  characterConditions,
  conditions,
  characterCampaigns,
} from "@/lib/db/schema";
import { XP_PER_LEVEL, REFERENCE_MAX_LEVEL } from "@/lib/utils/constants";
import { eq, inArray, and } from "drizzle-orm";

type LogInput = {
  actorType: "character" | "npc" | "system";
  actorId: string | null;
  actorName: string | null;
  action: string;
  description: string | null;
  payload?: Record<string, unknown>;
};

export type ActorUpdateInput = {
  hpDelta?: number;
  manaDelta?: number;
  hitPointsCurrent?: number;
  manaPointsCurrent?: number;
  xpDelta?: number;
  level?: number;
  conditionsAdd?: string[];
  conditionsRemove?: string[];
  reason?: string;
};

async function writeLog(campaignId: string, userId: string, log: LogInput) {
  const [entry] = await db
    .insert(campaignLogs)
    .values({
      campaignId,
      createdById: userId,
      actorType: log.actorType,
      actorId: log.actorId,
      actorName: log.actorName,
      action: log.action,
      description: log.description,
      payload: log.payload ?? {},
    })
    .returning();

  return entry;
}

/**
 * Aplica progressão de XP com level-up automático (D-18, RF-035).
 */
function resolveXpProgress(currentXp: number, currentLevel: number, delta: number) {
  let xp = currentXp + delta;
  let level = currentLevel;

  while (xp >= XP_PER_LEVEL) {
    xp -= XP_PER_LEVEL;
    level = Math.min(level + 1, REFERENCE_MAX_LEVEL);
  }

  return { xp, level, leveledUp: level > currentLevel };
}

/**
 * Aplica as mutações do mestre em um PERSONAGEM da campanha e registra logs.
 */
export async function applyCharacterUpdate(
  campaignId: string,
  characterId: string,
  userId: string,
  input: ActorUpdateInput
) {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!character) {
    return { error: "Personagem não encontrado" as const };
  }

  const [membership] = await db.select({ characterId: characterCampaigns.characterId }).from(characterCampaigns)
    .where(and(eq(characterCampaigns.characterId, characterId), eq(characterCampaigns.campaignId, campaignId))).limit(1);
  if (!membership) return { error: "Personagem não pertence à campanha" as const };

  const logs: unknown[] = [];

  const setFields: Record<string, unknown> = {};
  const next = {
    hitPointsCurrent: character.hitPointsCurrent,
    manaPointsCurrent: character.manaPointsCurrent,
    xp: character.xp,
    level: character.level,
  };

  if (input.hpDelta !== undefined) {
    const from = next.hitPointsCurrent;
    next.hitPointsCurrent = Math.min(
      Math.max(next.hitPointsCurrent + input.hpDelta, 0),
      character.hitPointsMax
    );
    setFields.hitPointsCurrent = next.hitPointsCurrent;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "character",
        actorId: characterId,
        actorName: character.name,
        action: "hp_change",
        description: `HP de ${character.name}: ${from} → ${next.hitPointsCurrent} (${input.hpDelta >= 0 ? "+" : ""}${input.hpDelta})${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.hitPointsCurrent, delta: input.hpDelta },
      })
    );
  }

  if (input.manaDelta !== undefined) {
    const from = next.manaPointsCurrent;
    next.manaPointsCurrent = Math.min(
      Math.max(next.manaPointsCurrent + input.manaDelta, 0),
      character.manaPointsMax
    );
    setFields.manaPointsCurrent = next.manaPointsCurrent;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "character",
        actorId: characterId,
        actorName: character.name,
        action: "mana_change",
        description: `Mana de ${character.name}: ${from} → ${next.manaPointsCurrent} (${input.manaDelta >= 0 ? "+" : ""}${input.manaDelta})${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.manaPointsCurrent, delta: input.manaDelta },
      })
    );
  }

  if (input.hitPointsCurrent !== undefined) {
    const from = next.hitPointsCurrent;
    next.hitPointsCurrent = Math.min(Math.max(input.hitPointsCurrent, 0), character.hitPointsMax);
    setFields.hitPointsCurrent = next.hitPointsCurrent;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "character",
        actorId: characterId,
        actorName: character.name,
        action: "hp_change",
        description: `HP de ${character.name}: ${from} → ${next.hitPointsCurrent}${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.hitPointsCurrent },
      })
    );
  }

  if (input.manaPointsCurrent !== undefined) {
    const from = next.manaPointsCurrent;
    next.manaPointsCurrent = Math.min(Math.max(input.manaPointsCurrent, 0), character.manaPointsMax);
    setFields.manaPointsCurrent = next.manaPointsCurrent;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "character",
        actorId: characterId,
        actorName: character.name,
        action: "mana_change",
        description: `Mana de ${character.name}: ${from} → ${next.manaPointsCurrent}${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.manaPointsCurrent },
      })
    );
  }

  if (input.xpDelta !== undefined && input.xpDelta !== 0) {
    const { xp, level, leveledUp } = resolveXpProgress(next.xp, next.level, input.xpDelta);
    next.xp = xp;
    next.level = level;
    setFields.xp = xp;
    setFields.level = level;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "character",
        actorId: characterId,
        actorName: character.name,
        action: "xp_gain",
        description: `${character.name} ganhou ${input.xpDelta} XP (agora ${xp}/100)${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { amount: input.xpDelta, xp, level },
      })
    );
    if (leveledUp) {
      logs.push(
        await writeLog(campaignId, userId, {
          actorType: "character",
          actorId: characterId,
          actorName: character.name,
          action: "level_up",
          description: `${character.name} subiu para o nível ${level}!`,
          payload: { level },
        })
      );
    }
  }

  if (input.level !== undefined) {
    const from = next.level;
    next.level = input.level;
    setFields.level = input.level;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "character",
        actorId: characterId,
        actorName: character.name,
        action: "level_change",
        description: `Nível de ${character.name}: ${from} → ${input.level}`,
        payload: { from, to: input.level },
      })
    );
  }

  if (input.conditionsAdd?.length) {
    const existing = await db
      .select()
      .from(characterConditions)
      .where(
        and(
          eq(characterConditions.characterId, characterId),
          inArray(characterConditions.conditionId, input.conditionsAdd)
        )
      );

    const existingIds = new Set(existing.map((row) => row.conditionId));
    const toAdd = input.conditionsAdd.filter((id) => !existingIds.has(id));

    if (toAdd.length) {
      await db.insert(characterConditions).values(
        toAdd.map((conditionId) => ({ characterId, conditionId }))
      );

      const conditionRows = await db
        .select()
        .from(conditions)
        .where(inArray(conditions.id, toAdd));

      for (const condition of conditionRows) {
        logs.push(
          await writeLog(campaignId, userId, {
            actorType: "character",
            actorId: characterId,
            actorName: character.name,
            action: "condition_add",
            description: `Condição "${condition.name}" aplicada em ${character.name}`,
            payload: { conditionId: condition.id },
          })
        );
      }
    }
  }

  if (input.conditionsRemove?.length) {
    await db
      .delete(characterConditions)
      .where(
        and(
          eq(characterConditions.characterId, characterId),
          inArray(characterConditions.conditionId, input.conditionsRemove)
        )
      );

    const conditionRows = await db
      .select()
      .from(conditions)
      .where(inArray(conditions.id, input.conditionsRemove));

    for (const condition of conditionRows) {
      logs.push(
        await writeLog(campaignId, userId, {
          actorType: "character",
          actorId: characterId,
          actorName: character.name,
          action: "condition_remove",
          description: `Condição "${condition.name}" removida de ${character.name}`,
          payload: { conditionId: condition.id },
        })
      );
    }
  }

  if (Object.keys(setFields).length) {
    setFields.updatedAt = new Date();
    await db.update(characters).set(setFields).where(eq(characters.id, characterId));
  }

  const [refreshed] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  return { data: refreshed, logs };
}

/**
 * Aplica as mutações do mestre em um NPC da campanha e registra logs.
 */
export async function applyNpcUpdate(
  campaignId: string,
  npcId: string,
  userId: string,
  input: ActorUpdateInput
) {
  const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

  if (!npc) {
    return { error: "NPC não encontrado" as const };
  }

  const logs: unknown[] = [];

  const setFields: Record<string, unknown> = {};
  const next = {
    hitPoints: npc.hitPoints,
    manaPoints: npc.manaPoints,
    xp: npc.xp,
    level: npc.level,
  };

  if (input.hpDelta !== undefined) {
    const from = next.hitPoints;
    next.hitPoints = Math.min(Math.max(next.hitPoints + input.hpDelta, 0), npc.hitPointsMax);
    setFields.hitPoints = next.hitPoints;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "npc",
        actorId: npcId,
        actorName: npc.name,
        action: "hp_change",
        description: `HP de ${npc.name}: ${from} → ${next.hitPoints} (${input.hpDelta >= 0 ? "+" : ""}${input.hpDelta})${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.hitPoints, delta: input.hpDelta },
      })
    );
  }

  if (input.manaDelta !== undefined) {
    const from = next.manaPoints;
    next.manaPoints = Math.min(Math.max(next.manaPoints + input.manaDelta, 0), npc.manaPointsMax);
    setFields.manaPoints = next.manaPoints;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "npc",
        actorId: npcId,
        actorName: npc.name,
        action: "mana_change",
        description: `Mana de ${npc.name}: ${from} → ${next.manaPoints} (${input.manaDelta >= 0 ? "+" : ""}${input.manaDelta})${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.manaPoints, delta: input.manaDelta },
      })
    );
  }

  if (input.hitPointsCurrent !== undefined) {
    const from = next.hitPoints;
    next.hitPoints = Math.min(Math.max(input.hitPointsCurrent, 0), npc.hitPointsMax);
    setFields.hitPoints = next.hitPoints;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "npc",
        actorId: npcId,
        actorName: npc.name,
        action: "hp_change",
        description: `HP de ${npc.name}: ${from} → ${next.hitPoints}${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.hitPoints },
      })
    );
  }

  if (input.manaPointsCurrent !== undefined) {
    const from = next.manaPoints;
    next.manaPoints = Math.min(Math.max(input.manaPointsCurrent, 0), npc.manaPointsMax);
    setFields.manaPoints = next.manaPoints;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "npc",
        actorId: npcId,
        actorName: npc.name,
        action: "mana_change",
        description: `Mana de ${npc.name}: ${from} → ${next.manaPoints}${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { from, to: next.manaPoints },
      })
    );
  }

  if (input.xpDelta !== undefined && input.xpDelta !== 0) {
    const { xp, level, leveledUp } = resolveXpProgress(next.xp, next.level, input.xpDelta);
    next.xp = xp;
    next.level = level;
    setFields.xp = xp;
    setFields.level = level;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "npc",
        actorId: npcId,
        actorName: npc.name,
        action: "xp_gain",
        description: `${npc.name} ganhou ${input.xpDelta} XP (agora ${xp}/100)${input.reason ? ` — ${input.reason}` : ""}`,
        payload: { amount: input.xpDelta, xp, level },
      })
    );
    if (leveledUp) {
      logs.push(
        await writeLog(campaignId, userId, {
          actorType: "npc",
          actorId: npcId,
          actorName: npc.name,
          action: "level_up",
          description: `${npc.name} subiu para o nível ${level}!`,
          payload: { level },
        })
      );
    }
  }

  if (input.level !== undefined) {
    const from = next.level;
    next.level = input.level;
    setFields.level = input.level;
    logs.push(
      await writeLog(campaignId, userId, {
        actorType: "npc",
        actorId: npcId,
        actorName: npc.name,
        action: "level_change",
        description: `Nível de ${npc.name}: ${from} → ${input.level}`,
        payload: { from, to: input.level },
      })
    );
  }

  if (Object.keys(setFields).length) {
    setFields.updatedAt = new Date();
    await db.update(npcs).set(setFields).where(eq(npcs.id, npcId));
  }

  const [refreshed] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

  return { data: refreshed, logs };
}

/**
 * Cria uma requisição de rolagem no log da campanha (RF-041).
 */
export async function createRollRequest(
  campaignId: string,
  userId: string,
  input: {
    actorType: "character" | "npc";
    actorId: string;
    actorName: string;
    rollExpression: string;
    reason?: string;
  }
) {
  return writeLog(campaignId, userId, {
    actorType: input.actorType,
    actorId: input.actorId,
    actorName: input.actorName,
    action: "roll_request",
    description: `${input.actorName} deve rolar ${input.rollExpression}${input.reason ? ` (${input.reason})` : ""}`,
    payload: { rollExpression: input.rollExpression, reason: input.reason ?? null, result: null },
  });
}

/**
 * Preenche o resultado de uma rolagem requisitada (RF-041).
 */
export async function fillRollResult(
  logId: string,
  result: number,
  description?: string
) {
  const [log] = await db
    .select()
    .from(campaignLogs)
    .where(eq(campaignLogs.id, logId))
    .limit(1);

  if (!log || log.action !== "roll_request") {
    return { error: "Rolagem não encontrada" as const };
  }

  const rollExpression = ((log.payload as Record<string, unknown>).rollExpression as string) ?? "—";

  const [updated] = await db
    .update(campaignLogs)
    .set({
      action: "roll_result",
      description:
        description ??
        `${log.actorName ?? "Alguém"} rolou ${rollExpression} e obteve ${result}`,
      payload: { ...(log.payload as Record<string, unknown>), result },
    })
    .where(eq(campaignLogs.id, logId))
    .returning();

  return { data: updated };
}
