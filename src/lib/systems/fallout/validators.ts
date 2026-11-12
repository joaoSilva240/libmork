// =============================================================================
// Libmork — Sistema Fallout 2d20: Validadores Zod
// =============================================================================

import { z } from "zod";
import {
  FALLOUT_ATTRIBUTES,
  FALLOUT_SKILLS,
  FALLOUT_DAMAGE_TYPES,
  FALLOUT_BODY_LOCATIONS,
  FALLOUT_DAMAGE_EFFECTS,
  FALLOUT_WEAPON_QUALITIES,
} from "./types";

export const falloutAttributeSchema = z.enum(FALLOUT_ATTRIBUTES);
export const falloutSkillNameSchema = z.enum(FALLOUT_SKILLS);
export const falloutDamageTypeSchema = z.enum(FALLOUT_DAMAGE_TYPES);
export const falloutBodyLocationSchema = z.enum(FALLOUT_BODY_LOCATIONS);

export const falloutAttributesRecordSchema = z.object({
  str: z.number().int().min(4).max(20).default(5),
  per: z.number().int().min(4).max(20).default(5),
  end: z.number().int().min(4).max(20).default(5),
  cha: z.number().int().min(4).max(20).default(5),
  int: z.number().int().min(4).max(20).default(5),
  agi: z.number().int().min(4).max(20).default(5),
  luc: z.number().int().min(4).max(20).default(5),
});

export const falloutSkillStateSchema = z.object({
  name: falloutSkillNameSchema,
  rank: z.number().int().min(0).max(6).default(0),
  isTag: z.boolean().default(false),
});

export const falloutResistancesSchema = z.object({
  physical: z.number().int().min(0).default(0),
  energy: z.number().int().min(0).default(0),
  radiation: z.number().int().min(0).default(0),
  poison: z.number().int().min(0).default(0),
});

export const falloutBodyPartSchema = z.object({
  location: falloutBodyLocationSchema,
  label: z.string(),
  minRoll: z.number().int().min(1).max(20),
  maxRoll: z.number().int().min(1).max(20),
  injuries: z.number().int().min(0).max(3).default(0),
  isCrippled: z.boolean().default(false),
  resistances: falloutResistancesSchema,
});

export const createFalloutCharacterSchema = z.object({
  campaignId: z.string().uuid().optional().nullable(),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").max(100),
  origin: z
    .enum([
      "vault_dweller",
      "wastelander",
      "brotherhood_initiate",
      "ghoul",
      "super_mutant",
      "mister_handy",
      "survivor",
    ])
    .default("vault_dweller"),
  level: z.number().int().min(1).max(50).default(1),
  xp: z.number().int().min(0).default(0),
  attributes: falloutAttributesRecordSchema.default({
    str: 5,
    per: 5,
    end: 5,
    cha: 5,
    int: 5,
    agi: 5,
    luc: 5,
  }),
  tagSkills: z.array(falloutSkillNameSchema).max(3).default([]),
  perks: z.array(z.string()).default([]),
  caps: z.number().int().min(0).default(0),
});

export type CreateFalloutCharacterInput = z.infer<typeof createFalloutCharacterSchema>;

export const updateFalloutCharacterSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  level: z.number().int().min(1).max(50).optional(),
  xp: z.number().int().min(0).optional(),
  hpCurrent: z.number().int().min(0).optional(),
  radiation: z.number().int().min(0).optional(),
  luckPointsCurrent: z.number().int().min(0).optional(),
  caps: z.number().int().min(0).optional(),
  attributes: falloutAttributesRecordSchema.partial().optional(),
  skills: z.record(falloutSkillNameSchema, falloutSkillStateSchema).optional(),
  tagSkills: z.array(falloutSkillNameSchema).max(3).optional(),
  bodyParts: z.record(falloutBodyLocationSchema, falloutBodyPartSchema).optional(),
  items: z.array(z.any()).optional(),
  perks: z.array(z.string()).optional(),
});

export type UpdateFalloutCharacterInput = z.infer<typeof updateFalloutCharacterSchema>;

export const falloutRollSchema = z.object({
  campaignId: z.string().optional(),
  characterId: z.string().optional(),
  characterName: z.string().default("Viajante"),
  attribute: falloutAttributeSchema,
  skill: falloutSkillNameSchema.optional(),
  attributeValue: z.number().int().min(1).max(25),
  skillRank: z.number().int().min(0).max(6).default(0),
  isTagSkill: z.boolean().default(false),
  extraDiceCount: z.number().int().min(0).max(3).default(0),
  difficulty: z.number().int().min(0).max(10).default(1),
  complicationThreshold: z.number().int().min(15).max(20).default(20),
  rollLocation: z.boolean().default(false),
});

export type FalloutRollInput = z.infer<typeof falloutRollSchema>;

export const combatDiceRollSchema = z.object({
  campaignId: z.string().optional(),
  characterName: z.string().default("Atacante"),
  weaponName: z.string().optional(),
  diceCount: z.number().int().min(1).max(30),
  damageType: falloutDamageTypeSchema.default("physical"),
  damageEffects: z.array(z.enum(FALLOUT_DAMAGE_EFFECTS)).default([]),
  weaponQualities: z.array(z.enum(FALLOUT_WEAPON_QUALITIES)).default([]),
});

export type CombatDiceRollInput = z.infer<typeof combatDiceRollSchema>;

export const updateFalloutCampaignStateSchema = z.object({
  partyAP: z.number().int().min(0).max(6).optional(),
  overseerAP: z.number().int().min(0).max(99).optional(),
  scarcityLevel: z.enum(["abundant", "standard", "scarce", "desolate"]).optional(),
});

export type UpdateFalloutCampaignStateInput = z.infer<typeof updateFalloutCampaignStateSchema>;
