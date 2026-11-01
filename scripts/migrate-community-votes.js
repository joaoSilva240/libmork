require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL found, skipping direct DB migration');
    return;
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS "community_post_votes" (
        "post_id" uuid NOT NULL REFERENCES "community_posts"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "value" integer NOT NULL CHECK ("value" IN (-1, 1)),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY ("post_id", "user_id")
      );
    `);
    console.log('Migration of community_post_votes completed successfully!');
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error('Migration error:', error.message);
  process.exitCode = 1;
});
