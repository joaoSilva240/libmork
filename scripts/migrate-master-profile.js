require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL found, skipping direct DB migration');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sqlStatements = [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "master_name" varchar(100);`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "master_avatar" varchar(500);`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "master_bio" text;`,
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "master_banner_url" varchar(500);`,
      `CREATE TABLE IF NOT EXISTS "community_clones" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "post_id" uuid NOT NULL REFERENCES "community_posts"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "cloned_at" timestamp NOT NULL DEFAULT now()
      );`,
      `CREATE INDEX IF NOT EXISTS "idx_community_clones_user" ON "community_clones"("user_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_community_clones_post" ON "community_clones"("post_id");`,
    ];

    for (const sql of sqlStatements) {
      await client.query(sql);
      console.log(`Executed: ${sql}`);
    }

    console.log('Migration of master_profile and community_clones completed successfully!');
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await client.end();
  }
}

migrate();
