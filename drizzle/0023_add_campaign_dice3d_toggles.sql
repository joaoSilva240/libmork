ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dice3d_players_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dice3d_master_enabled" boolean DEFAULT true NOT NULL;
