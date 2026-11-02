-- Migration 0019: Add campaign_audio_tracks table (Issue #60)

CREATE TABLE IF NOT EXISTS "campaign_audio_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
	"video_id" varchar(11) NOT NULL,
	"title" varchar(200) NOT NULL,
	"added_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_audio_tracks_campaign_video_idx" ON "campaign_audio_tracks" ("campaign_id", "video_id");
CREATE INDEX IF NOT EXISTS "campaign_audio_tracks_position_idx" ON "campaign_audio_tracks" ("campaign_id", "position");
