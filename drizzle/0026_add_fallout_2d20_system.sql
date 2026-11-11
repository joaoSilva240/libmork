-- Migration 0026: Add Fallout 2d20 System Tables and Indexes

CREATE TABLE IF NOT EXISTS "fallout_campaign_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL UNIQUE REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"party_ap" integer DEFAULT 0 NOT NULL,
	"max_party_ap" integer DEFAULT 6 NOT NULL,
	"overseer_ap" integer DEFAULT 0 NOT NULL,
	"scarcity_level" varchar(20) DEFAULT 'standard' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fallout_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"name" varchar(100) NOT NULL,
	"origin" varchar(50) DEFAULT 'vault_dweller' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"caps" integer DEFAULT 0 NOT NULL,
	"hp_current" integer DEFAULT 10 NOT NULL,
	"hp_max" integer DEFAULT 10 NOT NULL,
	"radiation" integer DEFAULT 0 NOT NULL,
	"luck_points_current" integer DEFAULT 5 NOT NULL,
	"defense" integer DEFAULT 1 NOT NULL,
	"initiative" integer DEFAULT 10 NOT NULL,
	"melee_damage_bonus" integer DEFAULT 0 NOT NULL,
	"carry_weight_max" integer DEFAULT 200 NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tag_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_parts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"perks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_fallout_campaign_states_campaign" ON "fallout_campaign_states" ("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_fallout_characters_campaign" ON "fallout_characters" ("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_fallout_characters_owner" ON "fallout_characters" ("owner_id");
