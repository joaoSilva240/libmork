-- Issue #90 (follow-up): ataques como conteúdo da Biblioteca Global.
-- Ataques criados para NPCs ficam junto dos dados da biblioteca e podem ser
-- vinculados a qualquer NPC via npc_pins.content_id.
CREATE TABLE IF NOT EXISTS "attacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid REFERENCES "public"."campaigns"("id") ON DELETE cascade,
  "name" varchar(100) NOT NULL,
  "description" text,
  "attack_expression" varchar(200),
  "damage_expression" varchar(200),
  "damage_type" varchar(30),
  "critical_range" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_attack_campaign" ON "attacks" USING btree ("campaign_id");
