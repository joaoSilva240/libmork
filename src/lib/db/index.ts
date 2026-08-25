// =============================================================================
// Libmork — Conexão com o Banco de Dados (Drizzle + PostgreSQL)
// =============================================================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!process.env.DATABASE_URL && !isBuildPhase) {
  throw new Error("DATABASE_URL não definida. Verifique o .env.local");
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://dummy:dummy@127.0.0.1:5432/libmork_build";

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
