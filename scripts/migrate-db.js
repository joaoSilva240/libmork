require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database:', client.database);

    console.log('\n--- 1. Applying rpg_races migration ---');
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
    console.log('✓ Table rpg_races ensured.');

    console.log('\n--- 2. Applying campaign_invites user_id migration ---');
    await client.query(`
      ALTER TABLE "campaign_invites" ADD COLUMN IF NOT EXISTS "user_id" uuid;
    `);
    console.log('✓ Column campaign_invites.user_id ensured.');

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
    console.log('✓ Foreign key campaign_invites_user_id_users_id_fk ensured.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_campaign_invite_user" ON "campaign_invites" USING btree ("user_id");
    `);
    console.log('✓ Index idx_campaign_invite_user ensured.');

    console.log('\n--- 3. Checking other potential missing tables/indexes ---');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_char_spells_composite ON character_spells(character_id, spell_id);
      CREATE INDEX IF NOT EXISTS idx_char_items_composite ON character_items(character_id, item_id);
      CREATE INDEX IF NOT EXISTS idx_campaign_members_composite ON character_campaigns(character_id, campaign_id);
    `);
    console.log('✓ Composite indexes ensured.');

    console.log('\n--- 4. Applying library_documents migration ---');
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
    console.log('✓ Table library_documents ensured.');

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
    console.log('✓ Foreign key library_documents_campaign_id_campaigns_id_fk ensured.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS "idx_library_doc_campaign" ON "library_documents" USING btree ("campaign_id");
      CREATE INDEX IF NOT EXISTS "idx_library_doc_category" ON "library_documents" USING btree ("category");
    `);
    console.log('✓ Indexes for library_documents ensured.');


    console.log('\nAll migrations executed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

runMigrations();
