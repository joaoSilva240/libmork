// =============================================================================
// Libmork — Conexão com o Banco de Dados (Drizzle + PostgreSQL)
// =============================================================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DbClient = ReturnType<typeof postgres>;
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  _libmorkDb?: DbInstance;
  _libmorkClient?: DbClient;
};

let _db: DbInstance | null = globalForDb._libmorkDb ?? null;
let _client: DbClient | null = globalForDb._libmorkClient ?? null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definida. Configure a variável DATABASE_URL no ambiente ou .env.local",
    );
  }

  if (!_client) {
    _client = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    if (process.env.NODE_ENV !== "production") {
      globalForDb._libmorkClient = _client;
    }
  }

  _db = drizzle(_client, { schema });
  if (process.env.NODE_ENV !== "production") {
    globalForDb._libmorkDb = _db;
  }
  return _db;
}

// Proxy transparente para manter total compatibilidade com import { db } from "@/lib/db"
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
