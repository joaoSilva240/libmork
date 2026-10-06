ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "race_id" uuid REFERENCES "rpg_races"("id") ON DELETE set null;
