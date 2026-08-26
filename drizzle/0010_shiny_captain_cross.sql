-- =============================================================================
-- Libmork — Migration: Map Pins Table (RF-068)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "map_pins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "world_id" uuid NOT NULL,
  "lat" real NOT NULL,
  "lng" real NOT NULL,
  "title" varchar(200) NOT NULL,
  "description" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_map_pin_world" ON "map_pins" ("world_id");

ALTER TABLE "map_pins" ADD CONSTRAINT "map_pins_world_id_worlds_id_fk" 
  FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") 
  ON DELETE cascade ON UPDATE no action;
