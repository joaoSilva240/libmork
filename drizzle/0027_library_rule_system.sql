-- Migration 0027: Biblioteca Global separada por sistema de regras
-- Adiciona rule_system ('generic' | 'libmork' | 'pathfinder' | 'fallout_2d20')
-- em spells, items, skills e conditions. Conteúdo existente vira 'generic'
-- (compartilhado entre Libmork d20 e Pathfinder 2e).

ALTER TABLE "spells" ADD COLUMN IF NOT EXISTS "rule_system" varchar(20) NOT NULL DEFAULT 'generic';
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "rule_system" varchar(20) NOT NULL DEFAULT 'generic';
ALTER TABLE "skills" ADD COLUMN IF NOT EXISTS "rule_system" varchar(20) NOT NULL DEFAULT 'generic';
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "rule_system" varchar(20) NOT NULL DEFAULT 'generic';

UPDATE "spells" SET "rule_system" = 'generic' WHERE "rule_system" IS NULL;
UPDATE "items" SET "rule_system" = 'generic' WHERE "rule_system" IS NULL;
UPDATE "skills" SET "rule_system" = 'generic' WHERE "rule_system" IS NULL;
UPDATE "conditions" SET "rule_system" = 'generic' WHERE "rule_system" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_spell_library_system" ON "spells" USING btree ("campaign_id", "rule_system");
CREATE INDEX IF NOT EXISTS "idx_item_library_system" ON "items" USING btree ("campaign_id", "rule_system");
CREATE INDEX IF NOT EXISTS "idx_skill_library_system" ON "skills" USING btree ("campaign_id", "rule_system");
CREATE INDEX IF NOT EXISTS "idx_condition_library_system" ON "conditions" USING btree ("campaign_id", "rule_system");
