ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "active_heritages" jsonb DEFAULT '[]'::jsonb NOT NULL;
