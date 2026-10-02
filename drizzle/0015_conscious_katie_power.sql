CREATE TABLE "establishment_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"establishment_id" uuid NOT NULL,
	"content_type" varchar(20) DEFAULT 'items' NOT NULL,
	"content_id" uuid,
	"name" varchar(100) NOT NULL,
	"description" text,
	"price_gold" integer DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT -1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "world_map_url" text;--> statement-breakpoint
ALTER TABLE "character_items" ADD COLUMN "hit_roll" varchar(200);--> statement-breakpoint
ALTER TABLE "character_items" ADD COLUMN "damage_roll" varchar(200);--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "coins" jsonb DEFAULT '{"bronze":0,"prata":0,"ouro":0,"platina":0,"diamante":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "establishments" ADD COLUMN "is_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "establishments" ADD COLUMN "trust_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "establishment_inventory" ADD CONSTRAINT "establishment_inventory_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_est_inv_establishment" ON "establishment_inventory" USING btree ("establishment_id");