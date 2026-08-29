// =============================================================================
// Libmork — Constantes do Sistema
// =============================================================================
// Valores fixos derivados das decisões do projeto.
// =============================================================================

/** Atributos base fixos do sistema (D-11) */
export const ATTRIBUTES = ["forca", "destreza", "vigor", "inteligencia", "empatia"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

/** Valor inicial de cada atributo na criação (D-17) */
export const ATTRIBUTE_BASE_VALUE = 8;

/** Pontos livres para distribuição na criação (D-17) */
export const ATTRIBUTE_FREE_POINTS = 8;

/** Total de atributos na criação: 5×8 + 8 = 48 (D-17) */
export const ATTRIBUTE_CREATION_TOTAL = ATTRIBUTES.length * ATTRIBUTE_BASE_VALUE + ATTRIBUTE_FREE_POINTS;

/** Nível máximo de referência (D-17) — sem teto rígido */
export const REFERENCE_MAX_LEVEL = 20;

/** XP necessário para subir de nível (D-18) */
export const XP_PER_LEVEL = 100;

/** Ações por turno de combate (D-23) */
export const ACTIONS_PER_TURN = 3;

/** Perícias treinadas base (D-40) */
export const BASE_TRAINED_SKILLS = 3;

/** Pontos de Inteligência por perícia treinada extra (D-40) */
export const INTELLIGENCE_PER_EXTRA_SKILL = 2;

/** Campanhas até expiração dos bônus de Pontos de Sombra (D-26) */
export const SHADOW_POINTS_CAMPAIGN_EXPIRY = 3;

/** Bônus por ponto de sombra gasto (D-26) */
export const SHADOW_POINT_BONUS = 2;

/**
 * Custo padrão de ações por círculo de magia (D-39).
 * Índice 0 não usado; círculos 1-9.
 */
export const SPELL_ACTION_COST_BY_CIRCLE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 2,
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
};

/** Status de morte do personagem (D-25) */
export const DEATH_STATUSES = ["alive", "falling", "dead", "reborn"] as const;
export type DeathStatus = (typeof DEATH_STATUSES)[number];

/** Status de aprovação de ficha em campanha (D-07) */
export const APPROVAL_STATUSES = ["draft", "pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

/** Motores de regras disponíveis (D-02) */
export const RULES_ENGINES = ["d20_mod", "dual_d20_sum"] as const;
export type RulesEngine = (typeof RULES_ENGINES)[number];

/** Tipos de NPC (D-38) */
export const NPC_TYPES = ["enemy", "common"] as const;
export type NpcType = (typeof NPC_TYPES)[number];

/** Tipos de uso de magia (D-22) */
export const SPELL_USE_TYPES = ["somatic", "manual", "verbal"] as const;
export type SpellUseType = (typeof SPELL_USE_TYPES)[number];

/** Status de duelo (D-45) */
export const DUEL_STATUSES = ["pending", "active", "finished", "cancelled"] as const;
export type DuelStatus = (typeof DUEL_STATUSES)[number];

/** Papéis globais de usuário (D-09, RF-005) */
export const USER_ROLES = ["player", "master"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Duração da sessão de autenticação em dias (D-44) */
export const SESSION_DURATION_DAYS = 30;

/** Timeout para requisições ao NINEROUTER/9Router em ms */
export const NINEROUTER_TIMEOUT_MS = 25_000;

/** Delay entre retentativas ao NINEROUTER em ms */
export const NINEROUTER_RETRY_DELAY_MS = 2000;

/** Dificuldade base para testes de morte (D-25) */
export const DEATH_SAVE_BASE_DIFFICULTY = 10;
