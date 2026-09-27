// Script para aplicar migration pendente: cover_url e map_url na tabela worlds
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('Aplicando migration: add cover_url e map_url à tabela worlds...');

    // Verifica se as colunas já existem
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'worlds'
      AND column_name IN ('cover_url', 'map_url')
    `);

    const existingColumns = checkResult.rows.map((r) => r.column_name);
    console.log('Colunas existentes:', existingColumns);

    if (!existingColumns.includes('cover_url')) {
      console.log('Adicionando coluna cover_url...');
      await client.query(`ALTER TABLE "worlds" ADD COLUMN "cover_url" text`);
      console.log('✓ cover_url adicionada');
    } else {
      console.log('✗ cover_url já existe');
    }

    if (!existingColumns.includes('map_url')) {
      console.log('Adicionando coluna map_url...');
      await client.query(`ALTER TABLE "worlds" ADD COLUMN "map_url" text`);
      console.log('✓ map_url adicionada');
    } else {
      console.log('✗ map_url já existe');
    }

    // Verifica final
    const finalResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'worlds'
      ORDER BY ordinal_position
    `);

    console.log('\nColunas atuais da tabela worlds:');
    finalResult.rows.forEach((row) => console.log(`  - ${row.column_name}`));

    console.log('\n✓ Migration aplicada com sucesso!');
  } catch (error) {
    console.error('Erro ao aplicar migration:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
