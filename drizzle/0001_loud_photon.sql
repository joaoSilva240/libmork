CREATE TABLE "campaign_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "campaign_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"actor_type" varchar(20) DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"actor_name" varchar(100),
	"action" varchar(40) NOT NULL,
	"description" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "npc_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"npc_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "npc_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"npc_id" uuid NOT NULL,
	"pin_type" varchar(20) NOT NULL,
	"content_id" uuid,
	"label" varchar(100) NOT NULL,
	"roll_expression" varchar(200),
	"mana_cost" integer,
	"circle" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "npcs" ALTER COLUMN "world_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "block" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(20) DEFAULT 'player' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_invites" ADD CONSTRAINT "campaign_invites_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_logs" ADD CONSTRAINT "campaign_logs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_logs" ADD CONSTRAINT "campaign_logs_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npc_campaigns" ADD CONSTRAINT "npc_campaigns_npc_id_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."npcs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npc_campaigns" ADD CONSTRAINT "npc_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npc_pins" ADD CONSTRAINT "npc_pins_npc_id_npcs_id_fk" FOREIGN KEY ("npc_id") REFERENCES "public"."npcs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_invite_campaign" ON "campaign_invites" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_log_campaign" ON "campaign_logs" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_npc_campaign_unique" ON "npc_campaigns" USING btree ("npc_id","campaign_id");--> statement-breakpoint
CREATE INDEX "idx_npc_campaign_campaign" ON "npc_campaigns" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_npc_pin_npc" ON "npc_pins" USING btree ("npc_id");--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_class_id_rpg_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."rpg_classes"("id") ON DELETE set null ON UPDATE no action;