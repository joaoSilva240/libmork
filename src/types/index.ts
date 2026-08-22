// =============================================================================
// Libmork — Tipos TypeScript Globais
// =============================================================================

import type { AttributeMap } from "@/lib/engine/attributes";
import type {
  Attribute,
  ApprovalStatus,
  DeathStatus,
  RulesEngine,
  NpcType,
  SpellUseType,
  DuelStatus,
} from "@/lib/utils/constants";

export type { AttributeMap, Attribute };

// =============================================================================
// Schemas JSONB (conforme § 7.1 do documento de requisitos)
// =============================================================================

/** Schema para RPG_CLASS.initial_items */
export type InitialItem = {
  item_id: string | null;
  name: string;
  quantity: number;
  description?: string;
};

/** Schema para RPG_CLASS.proficiencies */
export type Proficiencies = {
  weapons?: string[];
  armor?: string[];
  languages?: string[];
  tools?: string[];
};

/** Schema para CLASS_LEVEL_BENEFIT.benefits */
export type ClassLevelBenefit = {
  attribute_bonuses?: Partial<AttributeMap>;
  hp_bonus?: number;
  mana_bonus?: number;
  skills_granted?: string[];
  spells_granted?: string[];
  extra_trained_skills?: number;
  advantages?: string[];
  description?: string;
};

/** Schema para CHARACTER_CAMPAIGN.shadow_points_bonuses */
export type ShadowPointBonus = {
  bonus_type: "attribute" | "skill" | "spell";
  target: string;
  bonus_value: number;
  source_campaign_id: string;
  campaigns_remaining: number;
};

// =============================================================================
// Tipos de Entidades do Banco
// =============================================================================

export type User = {
  id: string;
  email: string;
  passwordHash: string | null;
  oauthProvider: string;
  displayName: string;
  shadowPoints: number;
  createdAt: Date;
};

export type Character = {
  id: string;
  ownerId: string;
  classId: string | null;
  name: string;
  imageUrl: string | null;
  hitPointsMax: number;
  hitPointsCurrent: number;
  manaPointsMax: number;
  manaPointsCurrent: number;
  attributes: AttributeMap;
  level: number;
  xp: number;
  block: number;
  deathStatus: DeathStatus;
  deathSuccesses: number;
  deathFailures: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Campaign = {
  id: string;
  masterId: string;
  name: string;
  rulesEngine: RulesEngine;
  pvpEnabled: boolean;
  difficultyModifierShadowPoints: number;
  createdAt: Date;
  updatedAt: Date;
};

export type World = {
  id: string;
  campaignId: string;
  name: string;
  description: string | null;
  createdAt: Date;
};

export type CharacterCampaign = {
  id: string;
  characterId: string;
  campaignId: string;
  approvalStatus: ApprovalStatus;
  origin: string;
  sessionsPlayed: number;
  shadowPointsBonuses: ShadowPointBonus[];
};

export type RpgClass = {
  id: string;
  name: string;
  description: string | null;
  initialItems: InitialItem[];
  proficiencies: Proficiencies;
};

export type Skill = {
  id: string;
  campaignId: string | null;
  name: string;
  description: string | null;
  rollExpression: string | null;
  keyAttribute: Attribute;
};

export type Spell = {
  id: string;
  campaignId: string | null;
  name: string;
  circle: number;
  manaCost: number;
  description: string | null;
  useType: SpellUseType;
  duration: string | null;
  extraEffect: string | null;
  actionCostOverride: number | null;
};

export type Item = {
  id: string;
  campaignId: string | null;
  name: string;
  description: string | null;
  qualityDescription: string | null;
  counterpointDescription: string | null;
};

export type Condition = {
  id: string;
  campaignId: string | null;
  name: string;
  description: string | null;
};

export type Npc = {
  id: string;
  worldId: string;
  name: string;
  npcType: NpcType;
  hitPoints: number;
  hitPointsMax: number;
  manaPoints: number;
  manaPointsMax: number;
  attributes: AttributeMap;
  imageUrl: string | null;
  xpReward: number;
  createdAt: Date;
};

export type Duel = {
  id: string;
  campaignId: string;
  status: DuelStatus;
  permanentResults: boolean;
  createdAt: Date;
  finishedAt: Date | null;
};

// =============================================================================
// Tipos de API Response
// =============================================================================

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};
