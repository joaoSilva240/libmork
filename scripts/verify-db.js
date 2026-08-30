require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function verifyDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('=== VERIFICAÇÃO DO BANCO DE DADOS POSTGRESQL ===\n');

    // 1. Consulta na tabela users
    console.log('1. Testando consulta na tabela `users`:');
    const usersResult = await client.query(`
      SELECT id, email, display_name, role 
      FROM users 
      LIMIT 5;
    `);
    console.log(`✓ Consulta bem sucedida! Registros encontrados: ${usersResult.rowCount}`);
    usersResult.rows.forEach((row, i) => {
      console.log(`   [${i + 1}] ID: ${row.id} | Email: ${row.email} | Nome: ${row.display_name} | Role: ${row.role}`);
    });

    // 2. Consulta na tabela campaign_invites com user_id
    console.log('\n2. Testando consulta na tabela `campaign_invites` com `user_id`:');
    const invitesResult = await client.query(`
      SELECT ci.id, ci.campaign_id, ci.user_id, ci.token, ci.revoked, u.display_name AS user_name
      FROM campaign_invites ci
      LEFT JOIN users u ON ci.user_id = u.id
      LIMIT 5;
    `);
    console.log(`✓ Consulta bem sucedida! Registros de convites: ${invitesResult.rowCount}`);
    invitesResult.rows.forEach((row, i) => {
      console.log(`   [${i + 1}] Convite ID: ${row.id} | Campanha: ${row.campaign_id} | User ID: ${row.user_id} (${row.user_name || 'N/A'}) | Revogado: ${row.revoked}`);
    });

    // 3. Consulta na tabela character_campaigns
    console.log('\n3. Testando consulta na tabela `character_campaigns`:');
    const charCampaignsResult = await client.query(`
      SELECT id, character_id, campaign_id, approval_status, origin, sessions_played
      FROM character_campaigns
      LIMIT 5;
    `);
    console.log(`✓ Consulta bem sucedida! Vínculos encontrados: ${charCampaignsResult.rowCount}`);
    charCampaignsResult.rows.forEach((row, i) => {
      console.log(`   [${i + 1}] ID: ${row.id} | Char ID: ${row.character_id} | Campanha ID: ${row.campaign_id} | Status: ${row.approval_status}`);
    });

    // 4. Consulta na tabela rpg_races
    console.log('\n4. Testando consulta na tabela `rpg_races`:');
    const racesResult = await client.query(`
      SELECT id, name, speed, size, attribute_bonuses, source_system
      FROM rpg_races
      LIMIT 5;
    `);
    console.log(`✓ Consulta bem sucedida! Raças encontradas: ${racesResult.rowCount}`);
    racesResult.rows.forEach((row, i) => {
      console.log(`   [${i + 1}] ID: ${row.id} | Nome: ${row.name} | Sistema: ${row.source_system} | Tam: ${row.size} | Vel: ${row.speed}`);
    });

    // 5. Verificação da estrutura da coluna campaign_invites.user_id
    console.log('\n5. Verificando metadados de colunas:');
    const columnMeta = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'campaign_invites' AND column_name = 'user_id';
    `);
    if (columnMeta.rows.length > 0) {
      console.log(`✓ Coluna campaign_invites.user_id presente: tipo=${columnMeta.rows[0].data_type}, nullable=${columnMeta.rows[0].is_nullable}`);
    } else {
      throw new Error('Coluna campaign_invites.user_id NÃO encontrada!');
    }

    console.log('\n=== TODAS AS VERIFICAÇÕES PASSARAM COM SUCESSO! ===');
  } catch (error) {
    console.error('✗ Erro na verificação do banco:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();
