-- Migration 0022: Add campaign_assets table and active_asset_id to campaigns (Issue #61)

CREATE TABLE IF NOT EXISTS "campaign_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "description" text,
  "image_url" varchar(500) NOT NULL,
  "category" varchar(50) DEFAULT 'handout' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_campaign_assets_campaign" ON "campaign_assets" ("campaign_id");

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "active_asset_id" uuid;

DO $$ BEGIN
  ALTER TABLE "campaigns"
    ADD CONSTRAINT "campaigns_active_asset_id_campaign_assets_id_fk"
    FOREIGN KEY ("active_asset_id") REFERENCES "public"."campaign_assets"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
