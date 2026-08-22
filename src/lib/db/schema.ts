// =============================================================================
// Libmork — Schema Drizzle ORM (Modelo de Dados v0.7)
// =============================================================================
// Referência: docs/01-analise-de-requisitos.md § 7. Modelo de Dados Preliminar
// =============================================================================

import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// =============================================================================
// NÚCLEO
// =============================================================================

/**
 * USER — Conta de usuário do sistema.
 * Referência: D-09 (autenticação), D-44 (cookies HTTP-only)
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  oauthProvider: varchar("oauth_provider", { length: 20 }).notNull().default("local"),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("player"),
  shadowPoints: integer("shadow_points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * SESSION — Sessão de autenticação via cookie HTTP-only (D-44).
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * RPG_CLASS — Classes de personagens (D-21).
 * Campos JSONB: initial_items, proficiencies (schemas definidos em § 7.1)
 */
export const rpgClasses = pgTable("rpg_classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  initialItems: jsonb("initial_items").notNull().default([]),
  proficiencies: jsonb("proficiencies").notNull().default({}),
});

/**
 * CLASS_LEVEL_BENEFIT — Benefícios ganhos por nível da classe (D-21).
 * Campo JSONB: benefits (schema definido em § 7.1)
 */
export const classLevelBenefits = pgTable(
  "class_level_benefits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classId: uuid("class_id")
      .notNull()
      .references(() => rpgClasses.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    benefits: jsonb("benefits").notNull().default({}),
  },
  (table) => [index("idx_class_level").on(table.classId, table.level)],
);

/**
 * CHARACTER — Ficha de personagem global (D-06).
 * Campo JSONB: attributes (schema definido em § 7.1)
 */
export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id").references(() => rpgClasses.id, { onDelete: "set null" }),
    name: varchar("name", { length: 100 }).notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    hitPointsMax: integer("hit_points_max").notNull().default(15),
    hitPointsCurrent: integer("hit_points_current").notNull().default(15),
    manaPointsMax: integer("mana_points_max").notNull().default(5),
    manaPointsCurrent: integer("mana_points_current").notNull().default(5),
    attributes: jsonb("attributes")
      .notNull()
      .default({
        forca: 8,
        destreza: 8,
        vigor: 8,
        inteligencia: 8,
        empatia: 8,
      }),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    block: integer("block").notNull().default(0),
    deathStatus: varchar("death_status", { length: 20 }).notNull().default("alive"),
    deathSuccesses: integer("death_successes").notNull().default(0),
    deathFailures: integer("death_failures").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("idx_character_owner").on(table.ownerId)],
);

/**
 * CAMPAIGN — Campanha de RPG (D-02, D-28).
 */
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  masterId: uuid("master_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  rulesEngine: varchar("rules_engine", { length: 20 }).notNull().default("d20_mod"),
  pvpEnabled: boolean("pvp_enabled").notNull().default(false),
  difficultyModifierShadowPoints: integer("difficulty_modifier_shadow_points")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * WORLD — Mundo dentro de uma campanha (D-06).
 */
export const worlds = pgTable(
  "worlds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_world_campaign").on(table.campaignId)],
);

/**
 * NPC — Personagem não-jogador (D-38).
 * Campo JSONB: attributes (mesmo schema de CHARACTER.attributes)
 */
export const npcs = pgTable(
  "npcs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    npcType: varchar("npc_type", { length: 20 }).notNull().default("common"),
    hitPoints: integer("hit_points").notNull().default(10),
    hitPointsMax: integer("hit_points_max").notNull().default(10),
    manaPoints: integer("mana_points").notNull().default(0),
    manaPointsMax: integer("mana_points_max").notNull().default(0),
    attributes: jsonb("attributes")
      .notNull()
      .default({
        forca: 10,
        destreza: 10,
        vigor: 10,
        inteligencia: 10,
        empatia: 10,
      }),
    imageUrl: varchar("image_url", { length: 500 }),
    xpReward: integer("xp_reward").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_npc_world").on(table.worldId)],
);

// =============================================================================
// VÍNCULO N:N — Personagem ↔ Campanha (D-06, D-07)
// =============================================================================

/**
 * CHARACTER_CAMPAIGN — Vínculo N:N com status de aprovação.
 * Campo JSONB: shadow_points_bonuses (schema definido em § 7.1)
 */
export const characterCampaigns = pgTable(
  "character_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    approvalStatus: varchar("approval_status", { length: 20 }).notNull().default("draft"),
    origin: varchar("origin", { length: 30 }).notNull().default("player_created"),
    sessionsPlayed: integer("sessions_played").notNull().default(0),
    shadowPointsBonuses: jsonb("shadow_points_bonuses").notNull().default([]),
  },
  (table) => [
    uniqueIndex("idx_char_campaign_unique").on(table.characterId, table.campaignId),
    index("idx_char_campaign_campaign").on(table.campaignId),
  ],
);

// =============================================================================
// BIBLIOTECA — Global vs Por Campanha (D-08)
// campaign_id NULL => ESCOPO GLOBAL
// campaign_id NOT NULL => ESCOPO POR CAMPANHA
// =============================================================================

/**
 * SKILL — Perícia (D-20, D-35, D-40).
 */
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    rollExpression: varchar("roll_expression", { length: 200 }),
    keyAttribute: varchar("key_attribute", { length: 20 }).notNull(),
  },
  (table) => [index("idx_skill_campaign").on(table.campaignId)],
);

/**
 * SPELL — Magia (D-22, D-39).
 */
export const spells = pgTable(
  "spells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    circle: integer("circle").notNull().default(1),
    manaCost: integer("mana_cost").notNull().default(0),
    description: text("description"),
    useType: varchar("use_type", { length: 20 }).notNull().default("somatic"),
    duration: varchar("duration", { length: 100 }),
    extraEffect: text("extra_effect"),
    actionCostOverride: integer("action_cost_override"),
  },
  (table) => [index("idx_spell_campaign").on(table.campaignId)],
);

/**
 * ITEM — Item de equipamento (D-08, D-27).
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    qualityDescription: text("quality_description"),
    counterpointDescription: text("counterpoint_description"),
  },
  (table) => [index("idx_item_campaign").on(table.campaignId)],
);

/**
 * CONDITION — Condição aplicável (ferido, caído, etc.) (D-08).
 */
export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
  },
  (table) => [index("idx_condition_campaign").on(table.campaignId)],
);

// =============================================================================
// JUNÇÕES — Ficha x Conteúdo
// =============================================================================

/**
 * CHARACTER_SKILL — Perícias do personagem (D-20).
 */
export const characterSkills = pgTable(
  "character_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    trained: boolean("trained").notNull().default(false),
  },
  (table) => [
    uniqueIndex("idx_char_skill_unique").on(table.characterId, table.skillId),
  ],
);

/**
 * CHARACTER_SPELL — Magias do personagem.
 */
export const characterSpells = pgTable(
  "character_spells",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    spellId: uuid("spell_id")
      .notNull()
      .references(() => spells.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("idx_char_spell_unique").on(table.characterId, table.spellId),
  ],
);

/**
 * CHARACTER_ITEM — Itens do personagem.
 */
export const characterItems = pgTable(
  "character_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [
    uniqueIndex("idx_char_item_unique").on(table.characterId, table.itemId),
  ],
);

/**
 * CHARACTER_CONDITION — Condições ativas no personagem.
 */
export const characterConditions = pgTable(
  "character_conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
    permanent: boolean("permanent").notNull().default(false),
    appliedAt: timestamp("applied_at").notNull().defaultNow(),
  },
  (table) => [index("idx_char_condition").on(table.characterId)],
);

// =============================================================================
// COMPARTILHAMENTO / NFC (D-05, D-04)
// =============================================================================

/**
 * PUBLIC_SHARE_LINK — Link público permanente da ficha (RNF-003).
 */
export const publicShareLinks = pgTable(
  "public_share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull().unique(),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("idx_public_link_character").on(table.characterId)],
);

/**
 * NFC_TAG — Etiqueta NFC associada a um personagem (D-04, D-36).
 */
export const nfcTags = pgTable("nfc_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
  ndefUrl: varchar("ndef_url", { length: 500 }).notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// =============================================================================
// DUELO — P2P entre jogadores (D-45)
// =============================================================================

/**
 * DUEL — Instância de duelo entre jogadores.
 */
export const duels = pgTable(
  "duels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    permanentResults: boolean("permanent_results").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => [index("idx_duel_campaign").on(table.campaignId)],
);

/**
 * DUEL_PARTICIPANT — Participante de um duelo.
 */
export const duelParticipants = pgTable(
  "duel_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    duelId: uuid("duel_id")
      .notNull()
      .references(() => duels.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    inviteStatus: varchar("invite_status", { length: 20 }).notNull().default("pending"),
    turnOrder: integer("turn_order"),
    actionsRemaining: integer("actions_remaining").notNull().default(3),
  },
  (table) => [
    uniqueIndex("idx_duel_participant_unique").on(table.duelId, table.characterId),
    index("idx_duel_participant_duel").on(table.duelId),
  ],
);

// =============================================================================
// RELATIONS — Drizzle relational queries
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  characters: many(characters),
  campaigns: many(campaigns),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const rpgClassesRelations = relations(rpgClasses, ({ many }) => ({
  levelBenefits: many(classLevelBenefits),
  characters: many(characters),
}));

export const classLevelBenefitsRelations = relations(classLevelBenefits, ({ one }) => ({
  rpgClass: one(rpgClasses, { fields: [classLevelBenefits.classId], references: [rpgClasses.id] }),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  owner: one(users, { fields: [characters.ownerId], references: [users.id] }),
  rpgClass: one(rpgClasses, { fields: [characters.classId], references: [rpgClasses.id] }),
  characterCampaigns: many(characterCampaigns),
  characterSkills: many(characterSkills),
  characterSpells: many(characterSpells),
  characterItems: many(characterItems),
  characterConditions: many(characterConditions),
  publicShareLinks: many(publicShareLinks),
  nfcTag: many(nfcTags),
  duelParticipations: many(duelParticipants),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  master: one(users, { fields: [campaigns.masterId], references: [users.id] }),
  worlds: many(worlds),
  characterCampaigns: many(characterCampaigns),
  skills: many(skills),
  spells: many(spells),
  items: many(items),
  conditions: many(conditions),
  duels: many(duels),
}));

export const worldsRelations = relations(worlds, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [worlds.campaignId], references: [campaigns.id] }),
  npcs: many(npcs),
}));

export const npcsRelations = relations(npcs, ({ one }) => ({
  world: one(worlds, { fields: [npcs.worldId], references: [worlds.id] }),
}));

export const characterCampaignsRelations = relations(characterCampaigns, ({ one }) => ({
  character: one(characters, {
    fields: [characterCampaigns.characterId],
    references: [characters.id],
  }),
  campaign: one(campaigns, {
    fields: [characterCampaigns.campaignId],
    references: [campaigns.id],
  }),
}));

export const skillsRelations = relations(skills, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [skills.campaignId], references: [campaigns.id] }),
  characterSkills: many(characterSkills),
}));

export const spellsRelations = relations(spells, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [spells.campaignId], references: [campaigns.id] }),
  characterSpells: many(characterSpells),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [items.campaignId], references: [campaigns.id] }),
  characterItems: many(characterItems),
}));

export const conditionsRelations = relations(conditions, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [conditions.campaignId], references: [campaigns.id] }),
  characterConditions: many(characterConditions),
}));

export const characterSkillsRelations = relations(characterSkills, ({ one }) => ({
  character: one(characters, {
    fields: [characterSkills.characterId],
    references: [characters.id],
  }),
  skill: one(skills, { fields: [characterSkills.skillId], references: [skills.id] }),
}));

export const characterSpellsRelations = relations(characterSpells, ({ one }) => ({
  character: one(characters, {
    fields: [characterSpells.characterId],
    references: [characters.id],
  }),
  spell: one(spells, { fields: [characterSpells.spellId], references: [spells.id] }),
}));

export const characterItemsRelations = relations(characterItems, ({ one }) => ({
  character: one(characters, {
    fields: [characterItems.characterId],
    references: [characters.id],
  }),
  item: one(items, { fields: [characterItems.itemId], references: [items.id] }),
}));

export const characterConditionsRelations = relations(characterConditions, ({ one }) => ({
  character: one(characters, {
    fields: [characterConditions.characterId],
    references: [characters.id],
  }),
  condition: one(conditions, {
    fields: [characterConditions.conditionId],
    references: [conditions.id],
  }),
}));

export const publicShareLinksRelations = relations(publicShareLinks, ({ one }) => ({
  character: one(characters, {
    fields: [publicShareLinks.characterId],
    references: [characters.id],
  }),
}));

export const nfcTagsRelations = relations(nfcTags, ({ one }) => ({
  character: one(characters, { fields: [nfcTags.characterId], references: [characters.id] }),
}));

export const duelsRelations = relations(duels, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [duels.campaignId], references: [campaigns.id] }),
  participants: many(duelParticipants),
}));

export const duelParticipantsRelations = relations(duelParticipants, ({ one }) => ({
  duel: one(duels, { fields: [duelParticipants.duelId], references: [duels.id] }),
  character: one(characters, {
    fields: [duelParticipants.characterId],
    references: [characters.id],
  }),
}));
