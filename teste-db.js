require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  query_timeout: 5000,
  ssl: false,
});

(async () => {
  try {
    await client.connect();
    const identity = await client.query(
      "SELECT current_database() AS database, current_user AS user, inet_server_addr()::text AS server, pg_backend_pid() AS pid",
    );
    console.log("AUTH_OK", JSON.stringify(identity.rows[0]));

    const query = async (label, sql) => {
      try {
        const result = await client.query(sql);
        console.log(label, JSON.stringify(result.rows));
      } catch (error) {
        console.log(`${label}_ERROR`, JSON.stringify({ code: error.code, message: error.message }));
      }
    };

    await query("MIGRATIONS", "SELECT to_regclass('public.__drizzle_migrations') AS relation");
    await query(
      "TABLES",
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    );
    await query(
      "ACTIVITY",
      "SELECT pid, usename, datname, state, wait_event_type, wait_event, query_start, xact_start, left(query,160) AS query FROM pg_stat_activity WHERE datname=current_database() ORDER BY pid",
    );
    await query(
      "LOCKS",
      "SELECT l.pid, a.state, a.wait_event_type, a.wait_event, l.locktype, l.mode, l.granted, l.relation::regclass::text AS relation, left(a.query,160) AS query FROM pg_locks l JOIN pg_stat_activity a USING(pid) WHERE a.datname=current_database() ORDER BY l.pid, l.granted, l.relation::regclass::text",
    );
    await query(
      "MIGRATION_ROWS",
      "SELECT id, hash, created_at FROM public.__drizzle_migrations ORDER BY id",
    );
  } catch (error) {
    console.log("AUTH_ERROR", JSON.stringify({ code: error.code, message: error.message }));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
})();
