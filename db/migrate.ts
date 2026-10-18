import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import { pathToFileURL } from "node:url";
export async function migrate(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(734820)");
    await drizzleMigrate(drizzle(client), {
      migrationsFolder: "db/migrations",
    });
  } finally {
    await client.query("SELECT pg_advisory_unlock(734820)");
    client.release();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await migrate(pool);
    console.log("Migrations applied.");
  } finally {
    await pool.end();
  }
}
