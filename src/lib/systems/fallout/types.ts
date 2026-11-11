// =============================================================================
// Libmork — Sistema Fallout 2d20: Tipos de Domínio
// Baseado no sistema oficial da Modiphius Entertainment Ltd.
// =============================================================================

/** Os 7 Atributos S.P.E.C.I.A.L. */
export const FALLOUT_ATTRIBUTES = ["str", "per", "end", "cha", "int", "agi", "luc"] as const;
export type FalloutAttribute = (typeof FALLOUT_ATTRIBUTES)[number];

export interface FalloutAttributeConfig {
  key: FalloutAttribute;
  label: string;
  shortLabel: string;
  description: string;
}

export const FALLOUT_ATTRIBUTE_CONFIGS: Record<FalloutAttribute, FalloutAttributeConfig> = {
  str: {
    key: "str",
    label: "Força",
    shortLabel: "FOR / STR",
    description: "Potência física, capacidade de carga e dano corpo a corpo.",
  },
  per: {
    key: "per",
    label: "Percepção",
    shortLabel: "PER",
    description: "Consciência sensorial, iniciativa e pontaria.",
  },
  end: {
    key: "end",
    label: "Resistência",
    shortLabel: "RES / END",
    description: "Vigor físico, pontos de vida e resistência a radiação/venenos.",
  },
  cha: {
    key: "cha",
    label: "Carisma",
    shortLabel: "CAR / CHA",
    description: "Liderança, persuasão, comércio e influência social.",
  },
  int: {
    key: "int",
    label: "Inteligência",
    shortLabel: "INT",
    description: "Conhecimento técnico, medicina, ciência e modificação de equipamentos.",
  },
  agi: {
    key: "agi",
    label: "Agilidade",
    shortLabel: "AGI",
    description: "Coordenação motora, defesa, furtividade e armas leves.",
  },
  luc: {
    key: "luc",
    label: "Sorte",
    shortLabel: "SOR / LUC",
    description: "Pontos de sorte, momentos de milagre e pontos de vida.",
  },
};

/** 17 Perícias Oficiais de Fallout 2d20 */
export const FALLOUT_SKILLS = [
  "athletics",
  "barter",
  "big_guns",
  "energy_weapons",
  "explosives",
  "lockpick",
  "medicine",
  "melee_weapons",
  "pilot",
  "repair",
  "science",
  "small_guns",
  "sneak",
  "speech",
  "survival",
  "throwing",
  "unarmed",
] as const;
export type FalloutSkillName = (typeof FALLOUT_SKILLS)[number];

export interface FalloutSkillConfig {
  name: FalloutSkillName;
  label: string;
  defaultAttribute: FalloutAttribute;
}

export const FALLOUT_SKILL_CONFIGS: Record<FalloutSkillName, FalloutSkillConfig> = {
  athletics: { name: "athletics", label: "Atletismo", defaultAttribute: "str" },
  barter: { name: "barter", label: "Barganha", defaultAttribute: "cha" },
  big_guns: { name: "big_guns", label: "Armas Pesadas", defaultAttribute: "end" },
  energy_weapons: { name: "energy_weapons", label: "Armas de Energia", defaultAttribute: "per" },
  explosives: { name: "explosives", label: "Explosivos", defaultAttribute: "per" },
  lockpick: { name: "lockpick", label: "Gazua / Arrombamento", defaultAttribute: "per" },
  medicine: { name: "medicine", label: "Medicina", defaultAttribute: "int" },
  melee_weapons: { name: "melee_weapons", label: "Armas Brancas", defaultAttribute: "str" },
  pilot: { name: "pilot", label: "Pilotagem", defaultAttribute: "per" },
  repair: { name: "repair", label: "Reparos", defaultAttribute: "int" },
  science: { name: "science", label: "Ciência", defaultAttribute: "int" },
  small_guns: { name: "small_guns", label: "Armas Leves", defaultAttribute: "agi" },
  sneak: { name: "sneak", label: "Furtividade", defaultAttribute: "agi" },
  speech: { name: "speech", label: "Discurso", defaultAttribute: "cha" },
  survival: { name: "survival", label: "Sobrevivência", defaultAttribute: "end" },
  throwing: { name: "throwing", label: "Arremesso", defaultAttribute: "agi" },
  unarmed: { name: "unarmed", label: "Combate Desarmado", defaultAttribute: "str" },
};

export interface FalloutSkillState {
  name: FalloutSkillName;
  rank: number; // 0 a 6
  isTag: boolean; // Tag Skill: dobra sucessos em rolagens <= rank
}

/** 4 Tipos de Dano e Resistência de Armadura */
export const FALLOUT_DAMAGE_TYPES = ["physical", "energy", "radiation", "poison"] as const;
export type FalloutDamageType = (typeof FALLOUT_DAMAGE_TYPES)[number];

export type FalloutResistances = Record<FalloutDamageType, number>;

/** Localizações de Membros do Corpo Humanoide (Paperdoll) */
export const FALLOUT_BODY_LOCATIONS = ["head", "torso", "armL", "armR", "legL", "legR"] as const;
export type FalloutBodyLocation = (typeof FALLOUT_BODY_LOCATIONS)[number];

export interface FalloutBodyPart {
  location: FalloutBodyLocation;
  label: string;
  minRoll: number;
  maxRoll: number;
  injuries: number; // contagem de ferimentos críticos (0 a 3)
  isCrippled: boolean;
  resistances: FalloutResistances;
}

export const FALLOUT_DEFAULT_BODY_PARTS: Record<
  FalloutBodyLocation,
  Omit<FalloutBodyPart, "injuries" | "isCrippled" | "resistances">
> = {
  head: { location: "head", label: "Cabeça", minRoll: 1, maxRoll: 2 },
  torso: { location: "torso", label: "Tronco", minRoll: 3, maxRoll: 8 },
  armL: { location: "armL", label: "Braço Esquerdo", minRoll: 9, maxRoll: 11 },
  armR: { location: "armR", label: "Braço Direito", minRoll: 12, maxRoll: 14 },
  legL: { location: "legL", label: "Perna Esquerda", minRoll: 15, maxRoll: 17 },
  legR: { location: "legR", label: "Perna Direita", minRoll: 18, maxRoll: 20 },
};

/** Efeitos de Dano de Armas (Combat Dice) */
export const FALLOUT_DAMAGE_EFFECTS = [
  "burst",
  "piercing",
  "radioactive",
  "spread",
  "stun",
  "vicious",
  "breaking",
  "persistent",
] as const;
export type FalloutDamageEffect = (typeof FALLOUT_DAMAGE_EFFECTS)[number];

/** Qualidades de Armas */
export const FALLOUT_WEAPON_QUALITIES = [
  "accurate",
  "close_quarters",
  "concealed",
  "inaccurate",
  "reliable",
  "two_handed",
  "unreliable",
  "blast",
  "gatling",
  "thrown",
] as const;
export type FalloutWeaponQuality = (typeof FALLOUT_WEAPON_QUALITIES)[number];

/** Tipos de Item no Inventário Fallout */
export type FalloutItemType =
  "weapon" | "apparel" | "ammo" | "consumable" | "perk" | "miscellany" | "mod";

export interface FalloutWeaponItem {
  id: string;
  name: string;
  type: "weapon";
  damageDiceRating: number; // Quantidade de dados de combate DC (d6)
  damageType: FalloutDamageType;
  damageEffects: FalloutDamageEffect[];
  qualities: FalloutWeaponQuality[];
  ammoType?: string;
  ammoPerShot: number;
  fireRate: number;
  range: "close" | "medium" | "long" | "extreme";
  weight: number;
  costCaps: number;
  equipped: boolean;
}

export interface FalloutApparelItem {
  id: string;
  name: string;
  type: "apparel";
  apparelType: "outfit" | "armor" | "headgear" | "powerArmor";
  locationsCovered: FalloutBodyLocation[];
  resistances: FalloutResistances;
  weight: number;
  costCaps: number;
  equipped: boolean;
}

export interface FalloutConsumableItem {
  id: string;
  name: string;
  type: "consumable";
  category: "chem" | "food" | "beverage" | "med";
  hpRestored?: number;
  radsCured?: number;
  radsInflicted?: number;
  quantity: number;
  weight: number;
  costCaps: number;
  addictive?: boolean;
}

export type FalloutItem =
  | FalloutWeaponItem
  | FalloutApparelItem
  | FalloutConsumableItem
  | {
      id: string;
      name: string;
      type: "ammo" | "perk" | "miscellany" | "mod";
      description?: string;
      quantity?: number;
      weight: number;
      costCaps: number;
      equipped?: boolean;
    };

/** Origens / Arquétipos de Personagem */
export type FalloutOrigin =
  | "vault_dweller"
  | "wastelander"
  | "brotherhood_initiate"
  | "ghoul"
  | "super_mutant"
  | "mister_handy"
  | "survivor";

/** Entidade Completa do Personagem Fallout 2d20 */
export interface FalloutCharacter {
  id: string;
  campaignId: string | null;
  ownerId: string;
  name: string;
  origin: FalloutOrigin;
  level: number;
  xp: number;
  attributes: Record<FalloutAttribute, number>;
  skills: Record<FalloutSkillName, FalloutSkillState>;
  tagSkills: FalloutSkillName[]; // até 3
  hpCurrent: number;
  hpMax: number;
  radiation: number; // Radiação acumula e corta o teto de Max HP
  luckPointsCurrent: number;
  defense: number;
  initiative: number;
  meleeDamageBonus: number; // Dados CD extras de combate
  carryWeightMax: number;
  caps: number; // Tampas de Nuka-Cola
  bodyParts: Record<FalloutBodyLocation, FalloutBodyPart>;
  items: FalloutItem[];
  perks: string[];
  createdAt: string;
  updatedAt: string;
}

/** Estado da Campanha Fallout (AP Pool Compartilhado) */
export interface FalloutCampaignState {
  campaignId: string;
  partyAP: number; // 0 a 6 (Pool dos Jogadores)
  maxPartyAP: number; // padrão 6
  overseerAP: number; // Reserva do Supervisor (Mestre)
  scarcityLevel?: "abundant" | "standard" | "scarce" | "desolate";
  updatedAt: string;
}

/** Resultados da Rolagem 2d20 de Teste */
export interface FalloutRollParams {
  attributeValue: number;
  skillRank: number;
  isTagSkill?: boolean;
  extraDiceCount?: number; // 0 a 3 dados extras comprados com AP/Sorte (total 2 a 5 d20)
  difficulty?: number; // padrão 1
  complicationThreshold?: number; // padrão 20
}

export interface FalloutRollDie {
  value: number;
  successes: number; // 0, 1 ou 2 (se crítico)
  isCritical: boolean;
  isComplication: boolean;
}

export interface FalloutRollResult {
  targetNumber: number; // Attribute + Skill
  criticalThreshold: number; // SkillRank se Tag, senão 1
  complicationThreshold: number;
  dice: FalloutRollDie[];
  totalSuccesses: number;
  totalComplications: number;
  difficulty: number;
  isSuccess: boolean;
  apGenerated: number; // Max(0, totalSuccesses - difficulty)
}

/** Resultados da Rolagem de Dados de Combate (Combat Dice — DC) */
export interface CombatDie {
  dieValue: number; // 1 a 6
  damage: number; // 1, 2, 0, 0, 1, 1
  effect: boolean; // true se face 5 ou 6
}

export interface CombatDiceRollResult {
  diceCount: number;
  dice: CombatDie[];
  totalDamage: number;
  totalEffects: number;
}
