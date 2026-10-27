-- Migration 0018: Add MISSING — Edição ZERO System Tables and Indexes

CREATE TABLE IF NOT EXISTS "missing_campaign_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL UNIQUE REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"active_scene" jsonb DEFAULT '{"title":"Cena Inicial","isActive":true,"threats":[]}'::jsonb NOT NULL,
	"clues_bank" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"investigation_web" jsonb DEFAULT '{"connections":[]}'::jsonb NOT NULL,
	"epiphany_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "missing_habitants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"equipments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "missing_action_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"habitant_id" uuid REFERENCES "missing_habitants"("id") ON DELETE SET NULL,
	"actor_role" varchar(20) NOT NULL,
	"actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"event_type" varchar(50) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_missing_campaign_states_campaign" ON "missing_campaign_states" ("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_missing_habitants_campaign" ON "missing_habitants" ("campaign_id");
CREATE INDEX IF NOT EXISTS "idx_missing_habitants_owner" ON "missing_habitants" ("owner_id");
CREATE INDEX IF NOT EXISTS "idx_missing_ledger_campaign" ON "missing_action_ledger" ("campaign_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_missing_ledger_habitant" ON "missing_action_ledger" ("habitant_id");
