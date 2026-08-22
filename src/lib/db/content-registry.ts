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
  characterSkills,
  characterSpells,
  characterItems,
  characterConditions,
} from "@/lib/db/schema";
import type { ContentType } from "@/lib/validators/content";

/**
 * Tabela de conteúdo (biblioteca) por tipo.
 */
export function getContentTable(type: ContentType) {
  switch (type) {
    case "skills":
      return skills;
    case "spells":
      return spells;
    case "items":
      return items;
    case "conditions":
      return conditions;
  }
}

/**
 * Tabela de junção ficha↔conteúdo por tipo.
 */
export function getJunctionTable(type: ContentType) {
  switch (type) {
    case "skills":
      return characterSkills;
    case "spells":
      return characterSpells;
    case "items":
      return characterItems;
    case "conditions":
      return characterConditions;
  }
}

/**
 * Coluna de FK do conteúdo na tabela de junção.
 */
export function getJunctionContentColumn(type: ContentType) {
  switch (type) {
    case "skills":
      return characterSkills.skillId;
    case "spells":
      return characterSpells.spellId;
    case "items":
      return characterItems.itemId;
    case "conditions":
      return characterConditions.conditionId;
  }
}

/**
 * Coluna de FK do personagem na tabela de junção.
 */
export function getJunctionCharacterColumn(type: ContentType) {
  switch (type) {
    case "skills":
      return characterSkills.characterId;
    case "spells":
      return characterSpells.characterId;
    case "items":
      return characterItems.characterId;
    case "conditions":
      return characterConditions.characterId;
  }
}

/**
 * Nome do campo de id do conteúdo na tabela de conteúdo.
 */
export function getContentIdColumn(type: ContentType) {
  switch (type) {
    case "skills":
      return skills.id;
    case "spells":
      return spells.id;
    case "items":
      return items.id;
    case "conditions":
      return conditions.id;
  }
}

/**
 * Nome do campo de campaign_id da tabela de conteúdo.
 */
export function getContentCampaignColumn(type: ContentType) {
  switch (type) {
    case "skills":
      return skills.campaignId;
    case "spells":
      return spells.campaignId;
    case "items":
      return items.campaignId;
    case "conditions":
      return conditions.campaignId;
  }
}

/**
 * Monta os valores de inserção da junção a partir do payload validado (Zod).
 * O shape é garantido pelo validador; tipagem relaxada de propósito.
 */
export function buildJunctionValues(
  type: ContentType,
  characterId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  const contentId = data.contentId as string;
  switch (type) {
    case "skills":
      return { characterId, skillId: contentId, trained: (data.trained as boolean) ?? false };
    case "spells":
      return { characterId, spellId: contentId };
    case "items":
      return { characterId, itemId: contentId, quantity: (data.quantity as number) ?? 1 };
    case "conditions":
      return { characterId, conditionId: contentId, permanent: (data.permanent as boolean) ?? false };
  }
}

/**
 * Monta os campos atualizáveis da junção por tipo.
 */
export function buildJunctionPatch(
  type: ContentType,
  data: Record<string, unknown>
): Record<string, unknown> {
  switch (type) {
    case "skills":
      return { trained: data.trained as boolean };
    case "items":
      return { quantity: data.quantity as number };
    case "conditions":
      return { permanent: data.permanent as boolean };
    case "spells":
      return {};
  }
}
