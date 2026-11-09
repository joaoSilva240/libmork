import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { campaigns, campaignAssets } from "../src/lib/db/schema";

async function verify() {
  console.log("=== VERIFICANDO CORREÇÃO DO ERRO 500 (CAMPAIGNS + ASSETS) ===");

  try {
    // 1. SELECT na tabela campaigns usando Drizzle ORM
    console.log("1. Executando db.select().from(campaigns).limit(1)...");
    const campaignRows = await db.select().from(campaigns).limit(1);
    console.log("✓ Sucesso ao consultar campaigns via Drizzle ORM!");
    console.log(`   Retornados: ${campaignRows.length} registros`);
    if (campaignRows.length > 0) {
      console.log("   Exemplo de registro retornado (campos chaves):", {
        id: campaignRows[0].id,
        name: campaignRows[0].name,
        activeAssetId: campaignRows[0].activeAssetId,
      });
    }

    // 2. SELECT na tabela campaign_assets usando Drizzle ORM
    console.log("\n2. Executando db.select().from(campaignAssets).limit(1)...");
    const assetRows = await db.select().from(campaignAssets).limit(1);
    console.log("✓ Sucesso ao consultar campaignAssets via Drizzle ORM!");
    console.log(`   Retornados: ${assetRows.length} registros`);

    console.log("\n✓ Todas as consultas do Drizzle executaram perfeitamente sem erro de coluna inexistente!");
    process.exit(0);
  } catch (error) {
    console.error("✗ Falha na verificação:", error);
    process.exit(1);
  }
}

verify();
