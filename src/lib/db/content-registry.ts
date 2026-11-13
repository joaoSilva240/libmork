// =============================================================================
// Libmork — Registro de Tabelas de Conteúdo (RF-016, RF-017, RF-018)
// =============================================================================
// Mapeia o tipo de conteúdo para a tabela Drizzle correspondente.
// =============================================================================

import {
  skills,
  spells,
  items,
  conditions,
  attacks,
  characterSkills,
  characterSpells,
  characterItems,
  characterConditions,
} from "@/lib/db/schema";
import type { ContentType } from "@/lib/validators/content";

const CONTENT_TABLES = {
  skills,
  spells,
  items,
  conditions,
  attacks,
} as const;

const JUNCTION_TABLES = {
  skills: characterSkills,
  spells: characterSpells,
  items: characterItems,
  conditions: characterConditions,
} as const;

const JUNCTION_CONTENT_COLUMNS = {
  skills: characterSkills.skillId,
  spells: characterSpells.spellId,
  items: characterItems.itemId,
  conditions: characterConditions.conditionId,
} as const;

const ATTACKS_JUNCTION_ERROR = "Ataques não possuem junção com fichas de personagem";

/**
 * Tabela de conteúdo (biblioteca) por tipo.
 */
export function getContentTable(type: ContentType) {
  return CONTENT_TABLES[type];
}

/**
 * Tabela de junção ficha↔conteúdo por tipo.
 */
export function getJunctionTable(type: ContentType) {
  if (type === "attacks") {
    throw new Error(ATTACKS_JUNCTION_ERROR);
  }
  return JUNCTION_TABLES[type];
}

/**
 * Coluna de FK do conteúdo na tabela de junção.
 */
export function getJunctionContentColumn(type: ContentType) {
  if (type === "attacks") {
    throw new Error(ATTACKS_JUNCTION_ERROR);
  }
  return JUNCTION_CONTENT_COLUMNS[type];
}

/**
 * Coluna de FK do personagem na tabela de junção.
 */
export function getJunctionCharacterColumn(type: ContentType) {
  if (type === "attacks") {
    throw new Error(ATTACKS_JUNCTION_ERROR);
  }
  return JUNCTION_TABLES[type].characterId;
}

/**
 * Nome do campo de id do conteúdo na tabela de conteúdo.
 */
export function getContentIdColumn(type: ContentType) {
  return CONTENT_TABLES[type].id;
}

/**
 * Nome do campo de campaign_id da tabela de conteúdo.
 */
export function getContentCampaignColumn(type: ContentType) {
  return CONTENT_TABLES[type].campaignId;
}

/**
 * Nome do campo de name da tabela de conteúdo.
 */
export function getContentNameColumn(type: ContentType) {
  return CONTENT_TABLES[type].name;
}

/**
 * Monta os valores de inserção da junção a partir do payload validado (Zod).
 * O shape é garantido pelo validador; tipagem relaxada de propósito.
 */
export function buildJunctionValues(
  type: ContentType,
  characterId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const contentId = data.contentId as string;
  switch (type) {
    case "skills":
      return { characterId, skillId: contentId, trained: (data.trained as boolean) ?? false };
    case "spells":
      return { characterId, spellId: contentId };
    case "items": {
      const base = { characterId, itemId: contentId, quantity: (data.quantity as number) ?? 1 };
      if (data.hitRoll !== undefined) {
        (base as Record<string, unknown>).hitRoll = data.hitRoll;
      }
      if (data.damageRoll !== undefined) {
        (base as Record<string, unknown>).damageRoll = data.damageRoll;
      }
      return base;
    }
    case "conditions":
      return {
        characterId,
        conditionId: contentId,
        permanent: (data.permanent as boolean) ?? false,
      };
    case "attacks":
      throw new Error("Ataques não possuem junção com fichas de personagem");
  }
}

/**
 * Monta os campos atualizáveis da junção por tipo.
 */
export function buildJunctionPatch(
  type: ContentType,
  data: Record<string, unknown>,
): Record<string, unknown> {
  switch (type) {
    case "skills":
      return { trained: data.trained as boolean };
    case "items": {
      const patch: Record<string, unknown> = {};
      if (data.quantity !== undefined) {
        patch.quantity = data.quantity as number;
      }
      if (data.hitRoll !== undefined) {
        patch.hitRoll = data.hitRoll;
      }
      if (data.damageRoll !== undefined) {
        patch.damageRoll = data.damageRoll;
      }
      return patch;
    }
    case "conditions":
      return { permanent: data.permanent as boolean };
    case "spells":
      return {};
    case "attacks":
      throw new Error("Ataques não possuem junção com fichas de personagem");
  }
}
