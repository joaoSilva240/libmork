ALTER TABLE spells ADD COLUMN IF NOT EXISTS range varchar(250);
ALTER TABLE spells ADD COLUMN IF NOT EXISTS target text;
ALTER TABLE spells ADD COLUMN IF NOT EXISTS area varchar(250);
ALTER TABLE spells ADD COLUMN IF NOT EXISTS damage jsonb;
ALTER TABLE spells ADD COLUMN IF NOT EXISTS damage_type varchar(100);
ALTER TABLE spells ADD COLUMN IF NOT EXISTS structured_effects jsonb;
ALTER TABLE spells ADD COLUMN IF NOT EXISTS casting_time varchar(100);
ALTER TABLE spells ADD COLUMN IF NOT EXISTS translation jsonb;
