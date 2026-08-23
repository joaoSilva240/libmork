CREATE TABLE "encounter_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"actor_type" varchar(20) NOT NULL,
	"actor_id" uuid NOT NULL,
	"initiative" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "encounter_participants" ADD CONSTRAINT "encounter_participants_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_encounter_participant_encounter" ON "encounter_participants" USING btree ("encounter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_encounter_participant_unique" ON "encounter_participants" USING btree ("encounter_id","actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "idx_encounter_world" ON "encounters" USING btree ("world_id");