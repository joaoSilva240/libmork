ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "source_key" varchar(500);
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "image_url" varchar(500);
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "source_data" jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS "items_source_key_unique" ON "items" ("source_key");
