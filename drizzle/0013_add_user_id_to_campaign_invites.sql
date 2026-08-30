ALTER TABLE "campaign_invites" ADD COLUMN "user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campaign_invites" ADD CONSTRAINT "campaign_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_invite_user" ON "campaign_invites" USING btree ("user_id");
