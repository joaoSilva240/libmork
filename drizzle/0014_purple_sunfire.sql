CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ALTER COLUMN "attributes" SET DEFAULT '{"forca":8,"destreza":8,"vigor":8,"inteligencia":8,"empatia":8,"sorte":8}'::jsonb;--> statement-breakpoint
ALTER TABLE "npcs" ALTER COLUMN "attributes" SET DEFAULT '{"forca":10,"destreza":10,"vigor":10,"inteligencia":10,"empatia":10,"sorte":10}'::jsonb;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_oauth_provider_account" ON "oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_accounts_user" ON "oauth_accounts" USING btree ("user_id");