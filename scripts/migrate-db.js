require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database:", client.database);

    console.log("\n--- 1. Applying rpg_races migration ---");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "rpg_races" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "speed" integer DEFAULT 30 NOT NULL,
        "size" varchar(50) DEFAULT 'Médio' NOT NULL,
        "hit_points_bonus" integer DEFAULT 0 NOT NULL,
        "attribute_bonuses" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "heritages" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "image_url" varchar(500),
        "source_system" varchar(50) DEFAULT 'custom',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("✓ Table rpg_races ensured.");

    console.log("\n--- 2. Applying campaign_invites user_id migration ---");
    await client.query(`
      ALTER TABLE "campaign_invites" ADD COLUMN IF NOT EXISTS "user_id" uuid;
    `);
    console.log("✓ Column campaign_invites.user_id ensured.");

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "campaign_invites" 
          ADD CONSTRAINT "campaign_invites_user_id_users_id_fk" 
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") 
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ Foreign key campaign_invites_user_id_users_id_fk ensured.");

    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_campaign_invite_user" ON "campaign_invites" USING btree ("user_id");
    `);
    console.log("✓ Index idx_campaign_invite_user ensured.");

    console.log("\n--- 3. Checking other potential missing tables/indexes ---");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_char_spells_composite ON character_spells(character_id, spell_id);
      CREATE INDEX IF NOT EXISTS idx_char_items_composite ON character_items(character_id, item_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_members_composite ON character_campaigns(character_id, campaign_id);
    `);
    console.log("✓ Composite indexes ensured.");

    console.log("\n--- 4. Applying library_documents migration ---");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "library_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text,
        "cover_url" varchar(1000),
        "external_url" varchar(1000) NOT NULL,
        "provider" varchar(50) DEFAULT 'external' NOT NULL,
        "category" varchar(50) DEFAULT 'livro-base' NOT NULL,
        "tags" text[],
        "is_official" boolean DEFAULT false NOT NULL,
        "is_public" boolean DEFAULT true NOT NULL,
        "campaign_id" uuid,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `);
    console.log("✓ Table library_documents ensured.");

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "library_documents" 
          ADD CONSTRAINT "library_documents_campaign_id_campaigns_id_fk" 
          FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") 
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ Foreign key library_documents_campaign_id_campaigns_id_fk ensured.");

    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_library_doc_campaign" ON "library_documents" USING btree ("campaign_id");
      CREATE INDEX IF NOT EXISTS "idx_library_doc_category" ON "library_documents" USING btree ("category");
    `);
    console.log("✓ Indexes for library_documents ensured.");

    console.log("\n--- 5. Applying oauth_accounts migration ---");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "oauth_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "provider" varchar(50) NOT NULL,
        "provider_account_id" varchar(255) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log("✓ Table oauth_accounts ensured.");

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "oauth_accounts"
          ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✓ Foreign key oauth_accounts_user_id_users_id_fk ensured.");

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_oauth_provider_account"
        ON "oauth_accounts" USING btree ("provider", "provider_account_id");
      CREATE INDEX IF NOT EXISTS "idx_oauth_accounts_user"
        ON "oauth_accounts" USING btree ("user_id");
    `);
    console.log("✓ Indexes for oauth_accounts ensured.");

    console.log("\n--- 6. Applying establishments & establishment_inventory migration ---");
    await client.query(`
      ALTER TABLE "establishments" ADD COLUMN IF NOT EXISTS "is_open" boolean DEFAULT false NOT NULL;
    `);
    console.log("✓ Column establishments.is_open ensured.");

    await client.query(`
      ALTER TABLE "establishments" ADD COLUMN IF NOT EXISTS "trust_level" integer DEFAULT 0 NOT NULL;
    `);
    console.log("✓ Column establishments.trust_level ensured.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "establishment_inventory" (
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
    `);
    console.log("✓ Table establishment_inventory ensured.");

    await client.query(`
      DO $$ BEGIN
        ALTER TABLE "establishment_inventory" 
          ADD CONSTRAINT "establishment_inventory_establishment_id_establishments_id_fk" 
          FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") 
          ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log(
      "✓ Foreign key establishment_inventory_establishment_id_establishments_id_fk ensured.",
    );

    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_est_inv_establishment" ON "establishment_inventory" USING btree ("establishment_id");
    `);
    console.log("✓ Index idx_est_inv_establishment ensured.");

    console.log("\n--- 7. Applying characters.coins JSONB migration ---");
    await client.query(`
      ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "coins" jsonb DEFAULT '{"bronze":0,"prata":0,"ouro":0,"platina":0,"diamante":0}' NOT NULL;
    `);
    console.log("✓ Column characters.coins ensured.");

    console.log("\n--- 8. Applying character_items formula migration ---");
    await client.query(`
      ALTER TABLE "character_items"
        ADD COLUMN IF NOT EXISTS "hit_roll" varchar(200),
        ADD COLUMN IF NOT EXISTS "damage_roll" varchar(200);
      ALTER TABLE "items"
        DROP COLUMN IF EXISTS "hit_roll",
        DROP COLUMN IF EXISTS "damage_roll";
    `);
    console.log("✓ Character item formulas ensured and global item formulas removed.");

    console.log("\n--- 9. Applying characters.race_id migration ---");
    await client.query(`
      ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "race_id" uuid REFERENCES "rpg_races"("id") ON DELETE set null;
    `);
    console.log("✓ Column characters.race_id ensured.");

    console.log("\n--- 10. Applying characters.active_heritages migration ---");
    await client.query(`
      ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "active_heritages" jsonb DEFAULT '[]'::jsonb NOT NULL;
    `);
    console.log("✓ Column characters.active_heritages ensured.");

    console.log("\n--- 11. Applying MISSING system tables and nullable campaign_id ---");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "missing_campaign_states" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid NOT NULL UNIQUE REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "active_scene" jsonb DEFAULT '{"title":"Cena Inicial","isActive":true,"threats":[]}'::jsonb NOT NULL,
        "clues_bank" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "investigation_web" jsonb DEFAULT '{"connections":[]}'::jsonb NOT NULL,
        "epiphany_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "missing_habitants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "status" varchar(20) DEFAULT 'active' NOT NULL,
        "lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "equipments" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      ALTER TABLE "missing_habitants" ALTER COLUMN "campaign_id" DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS "missing_action_ledger" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "habitant_id" uuid REFERENCES "missing_habitants"("id") ON DELETE SET NULL,
        "actor_role" varchar(20) NOT NULL,
        "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "event_type" varchar(50) NOT NULL,
        "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "idx_missing_campaign_states_campaign" ON "missing_campaign_states" ("campaign_id");
      CREATE INDEX IF NOT EXISTS "idx_missing_habitants_campaign" ON "missing_habitants" ("campaign_id");
      CREATE INDEX IF NOT EXISTS "idx_missing_habitants_owner" ON "missing_habitants" ("owner_id");
      CREATE INDEX IF NOT EXISTS "idx_missing_ledger_campaign" ON "missing_action_ledger" ("campaign_id", "created_at");
      CREATE INDEX IF NOT EXISTS "idx_missing_ledger_habitant" ON "missing_action_ledger" ("habitant_id");
    `);
    console.log("✓ MISSING tables, indexes and nullable campaign_id ensured.");

    console.log("\n--- 12. Applying campaign_assets and active_asset_id migration ---");
    await client.query(`
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
    `);
    console.log("✓ Table campaign_assets and campaigns.active_asset_id ensured.");

    console.log("\n--- 13. Applying campaign dice3d toggles migration (Issue #74) ---");
    await client.query(`
      ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dice3d_players_enabled" boolean DEFAULT true NOT NULL;
      ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dice3d_master_enabled" boolean DEFAULT true NOT NULL;
    `);
    console.log(
      "✓ Columns campaigns.dice3d_players_enabled and campaigns.dice3d_master_enabled ensured.",
    );

    console.log("\n--- 14. Applying npc pin damage migration (Issue #90) ---");
    await client.query(`
      ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "attack_expression" varchar(200);
      ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "damage_expression" varchar(200);
      ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "damage_type" varchar(30);
      ALTER TABLE "npc_pins" ADD COLUMN IF NOT EXISTS "critical_range" integer;
    `);
    console.log(
      "✓ Columns npc_pins.attack_expression/damage_expression/damage_type/critical_range ensured.",
    );

    console.log("\n--- 15. Applying global attacks library migration (Issue #90 follow-up) ---");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "attacks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid REFERENCES "public"."campaigns"("id") ON DELETE cascade,
        "name" varchar(100) NOT NULL,
        "description" text,
        "attack_expression" varchar(200),
        "damage_expression" varchar(200),
        "damage_type" varchar(30),
        "critical_range" integer,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_attack_campaign" ON "attacks" USING btree ("campaign_id");
    `);
    console.log("✓ Table attacks (biblioteca global de ataques) ensured.");

    console.log("\n--- 16. Applying Fallout 2d20 system tables migration ---");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "fallout_campaign_states" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid NOT NULL UNIQUE REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "party_ap" integer DEFAULT 0 NOT NULL,
        "max_party_ap" integer DEFAULT 6 NOT NULL,
        "overseer_ap" integer DEFAULT 0 NOT NULL,
        "scarcity_level" varchar(20) DEFAULT 'standard' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "fallout_characters" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE CASCADE,
        "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(100) NOT NULL,
        "origin" varchar(50) DEFAULT 'vault_dweller' NOT NULL,
        "level" integer DEFAULT 1 NOT NULL,
        "xp" integer DEFAULT 0 NOT NULL,
        "caps" integer DEFAULT 0 NOT NULL,
        "hp_current" integer DEFAULT 10 NOT NULL,
        "hp_max" integer DEFAULT 10 NOT NULL,
        "radiation" integer DEFAULT 0 NOT NULL,
        "luck_points_current" integer DEFAULT 5 NOT NULL,
        "defense" integer DEFAULT 1 NOT NULL,
        "initiative" integer DEFAULT 10 NOT NULL,
        "melee_damage_bonus" integer DEFAULT 0 NOT NULL,
        "carry_weight_max" integer DEFAULT 200 NOT NULL,
        "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "skills" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "tag_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "body_parts" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "perks" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "idx_fallout_campaign_states_campaign" ON "fallout_campaign_states" ("campaign_id");
      CREATE INDEX IF NOT EXISTS "idx_fallout_characters_campaign" ON "fallout_characters" ("campaign_id");
      CREATE INDEX IF NOT EXISTS "idx_fallout_characters_owner" ON "fallout_characters" ("owner_id");
    `);
    console.log("✓ Tables fallout_campaign_states, fallout_characters and indexes ensured.");

    console.log("\nAll migrations executed successfully!");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

runMigrations();
