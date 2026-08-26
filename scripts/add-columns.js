require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function addColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sqlStatements = [
      `ALTER TABLE "worlds" ADD COLUMN IF NOT EXISTS "cover_url" TEXT;`,
      `ALTER TABLE "worlds" ADD COLUMN IF NOT EXISTS "map_url" TEXT;`,
    ];

    for (const sql of sqlStatements) {
      await client.query(sql);
      console.log(`Executed: ${sql}`);
    }

    // Verify columns were added
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'worlds' 
      AND column_name IN ('cover_url', 'map_url')
      ORDER BY ordinal_position;
    `);

    console.log('\nVerified columns:');
    result.rows.forEach((row) => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed');
  }
}

addColumns();
