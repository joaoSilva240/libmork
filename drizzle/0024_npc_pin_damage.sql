-- Issue #90: dano configurado nos pins de ataque de NPC.
-- Migração aditiva; roll_expression permanece como campo legado.
ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "attack_expression" varchar(200);
ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "damage_expression" varchar(200);
ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "damage_type" varchar(30);
ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "critical_range" integer;
