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
      `ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "comment_type" varchar(20) NOT NULL DEFAULT 'text';`,
      `ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "attachment_content_type" varchar(50);`,
      `ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "attachment_title" varchar(255);`,
      `ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "attachment_payload" jsonb;`,
    ];

    for (const sql of sqlStatements) {
      await client.query(sql);
      console.log(`Executed: ${sql}`);
    }

    console.log('Migration of community_comments completed successfully!');
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    await client.end();
  }
}

migrate();
