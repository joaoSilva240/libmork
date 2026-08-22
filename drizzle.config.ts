import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Carrega variáveis de ambiente do .env.local
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida. Verifique o .env.local");
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
