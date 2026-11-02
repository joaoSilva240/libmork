-- Migration 0020: Add playlist support to campaign_audio_tracks

ALTER TABLE "campaign_audio_tracks" ADD COLUMN IF NOT EXISTS "playlist_id" varchar(100);
ALTER TABLE "campaign_audio_tracks" ADD COLUMN IF NOT EXISTS "playlist_name" varchar(100);
CREATE INDEX IF NOT EXISTS "campaign_audio_tracks_playlist_idx" ON "campaign_audio_tracks" ("campaign_id", "playlist_id");
