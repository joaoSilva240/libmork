#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// =============================================================================
// Libmork — Setup do Banco de Dados
// =============================================================================
// Script para criar o banco 'libmork' no PostgreSQL CasaOS
// =============================================================================

const postgres = require("postgres");

require("dotenv").config({ path: ".env.local" });

async function setupDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL não definida. Configure essa variável no arquivo .env.local.",
    );
  }

  // Conecta no banco padrão primeiro
  const sql = postgres(databaseUrl, { database: "postgres" });

  try {
    console.log("✓ Conectado ao PostgreSQL CasaOS");

    // Verifica se o banco 'libmork' já existe
    const result = await sql`
      SELECT 1 FROM pg_database WHERE datname = 'libmork'
    `;

    if (result.length > 0) {
      console.log("ℹ Banco 'libmork' já existe");
    } else {
      // Cria o banco
      await sql.unsafe("CREATE DATABASE libmork");
      console.log("✓ Banco 'libmork' criado com sucesso");
    }

    console.log("\n✓ Setup completo! Agora você pode rodar:");
    console.log("  npm run db:push");
  } catch (error) {
    console.error("✗ Erro ao configurar o banco:", error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupDatabase();
