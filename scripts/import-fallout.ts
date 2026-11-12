// =============================================================================
// Libmork — CLI Script: import-fallout.ts
// Importa perks e itens do compendio Fallout 2d20 (Muttley/foundryvtt-fallout)
// para a biblioteca global, marcados com rule_system='fallout_2d20'.
//
// Uso:
//   1. Baixar/extrair o repositorio (branch develop):
//      curl -sL https://codeload.github.com/Muttley/foundryvtt-fallout/tar.gz/refs/heads/develop | tar -xz
//   2. Executar:
//      npx tsx scripts/import-fallout.ts <caminho>/foundryvtt-fallout-develop/data/packs
// =============================================================================

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { spells, items } from "../src/lib/db/schema";
import {
  FALLOUT_ITEM_PACKS,
  FALLOUT_PERK_PACK,
  FALLOUT_RULE_SYSTEM,
  falloutSlugFromFilename,
  assignUniqueFalloutSourceKeys,
  parseFalloutPerk,
  parseFalloutItem,
  type FalloutItemPack,
  type FalloutPackEntry,
} from "../src/lib/content/fallout";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Verifique o .env.local");
}

const packsDir = process.argv[2];
if (!packsDir) {
  throw new Error(
    "Informe o diretório dos packs do Foundry: npx tsx scripts/import-fallout.ts <dir>/data/packs",
  );
}

const client = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

const db = drizzle(client, { schema });

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function readPackEntries(pack: string): Array<{ entry: FalloutPackEntry; slug: string }> {
  const dir = join(packsDir, `${pack}.db`);
  const result: Array<{ entry: FalloutPackEntry; slug: string }> = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const slug = falloutSlugFromFilename(file);
    if (!slug) continue;
    try {
      const entry = JSON.parse(readFileSync(join(dir, file), "utf8")) as FalloutPackEntry;
      result.push({ entry, slug });
    } catch (error: any) {
      console.error(`Falha ao ler ${pack}/${file}:`, error.message);
    }
  }
  return result;
}

async function importPerks() {
  console.log(`\n[perks] Lendo ${FALLOUT_PERK_PACK}.db...`);
  const rows = readPackEntries(FALLOUT_PERK_PACK)
    .map(({ entry }) => parseFalloutPerk(entry))
    .filter((row) => row !== null);

  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const key = normalizeName(row.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const existing = await db
    .select({ id: spells.id, name: spells.name })
    .from(spells)
    .where(eq(spells.ruleSystem, FALLOUT_RULE_SYSTEM));

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const row of unique) {
    const current = existing.find((e) => normalizeName(e.name) === normalizeName(row.name));
    try {
      if (current) {
        await db
          .update(spells)
          .set({
            circle: row.circle,
            description: row.description,
            imageUrl: row.imageUrl,
            structuredEffects: row.structuredEffects,
          })
          .where(eq(spells.id, current.id));
        updated++;
      } else {
        await db.insert(spells).values({ ...row, campaignId: null, ruleSystem: FALLOUT_RULE_SYSTEM });
        created++;
      }
    } catch (error: any) {
      failed++;
      console.error(`Falha ao importar perk ${row.name}:`, error.message);
    }
  }

  console.log(`-> Perks: ${created} criados, ${updated} atualizados, ${failed} falhas (${unique.length} no compendio)`);
  return { created, updated, failed };
}

async function importItems() {
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  const existing = await db
    .select({ id: items.id, sourceKey: items.sourceKey })
    .from(items)
    .where(sql`${items.sourceKey} LIKE 'fallout:%'`);

  const existingByKey = new Map(existing.map((e) => [e.sourceKey as string, e.id as string]));

  for (const pack of FALLOUT_ITEM_PACKS) {
    const entries = readPackEntries(pack);
    const rows = assignUniqueFalloutSourceKeys(
      entries
        .map(({ entry, slug }) => ({
          row: parseFalloutItem(entry, pack as FalloutItemPack, slug),
          foundryId: typeof entry._id === "string" ? entry._id : null,
        }))
        .filter((entry): entry is { row: NonNullable<typeof entry.row>; foundryId: string | null } =>
          entry.row !== null,
        ),
    );
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const row of rows) {
      const existingId = existingByKey.get(row.sourceKey);
      try {
        if (existingId) {
          await db
            .update(items)
            .set({
              name: row.name,
              description: row.description,
              qualityDescription: row.qualityDescription,
              imageUrl: row.imageUrl,
              sourceData: row.sourceData,
            })
            .where(eq(items.id, existingId));
          updated++;
        } else {
          await db.insert(items).values({
            ...row,
            campaignId: null,
            ruleSystem: FALLOUT_RULE_SYSTEM,
          });
          created++;
          existingByKey.set(row.sourceKey, "pending");
        }
      } catch (error: any) {
        failed++;
        console.error(`Falha ao importar item ${row.sourceKey}:`, error.message);
      }
    }

    console.log(`-> ${pack}: ${created} criados, ${updated} atualizados, ${failed} falhas (${rows.length} no compendio)`);
    totalCreated += created;
    totalUpdated += updated;
    totalFailed += failed;
  }

  return { created: totalCreated, updated: totalUpdated, failed: totalFailed };
}

async function run() {
  console.log("=== IMPORTAÇÃO FALLOUT 2D20 — BIBLIOTECA GLOBAL ===");
  console.log(`Packs: ${packsDir}`);

  try {
    const perksResult = await importPerks();
    const itemsResult = await importItems();

    console.log("\n=== RESUMO ===");
    console.log(`- Perks (spells): ${perksResult.created} criados | ${perksResult.updated} atualizados | ${perksResult.failed} falhas`);
    console.log(`- Itens:          ${itemsResult.created} criados | ${itemsResult.updated} atualizados | ${itemsResult.failed} falhas`);
  } finally {
    console.log("\nFechando conexões do banco de dados...");
    await client.end();
    console.log("Conexão fechada com sucesso.");
  }
}

run().catch((error) => {
  console.error("Erro fatal durante a importação:", error.message);
  process.exitCode = 1;
});
