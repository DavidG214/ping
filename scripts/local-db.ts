import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const pg = new EmbeddedPostgres({
  databaseDir: ".local/postgres",
  user: "ping",
  password: "local-development-only",
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
mkdirSync(".local", { recursive: true });
// Reuse the persistent cluster on subsequent starts; initdb requires an empty directory.
if (!existsSync(".local/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
for (const name of ["ping", "ping_test"]) {
  const client = pg.getPgClient();
  await client.connect();
  const found = await client.query(
    "select 1 from pg_database where datname=$1",
    [name],
  );
  await client.end();
  if (!found.rowCount) await pg.createDatabase(name);
}
if (!existsSync(".env"))
  writeFileSync(
    ".env",
    `DATABASE_URL=postgres://ping:local-development-only@127.0.0.1:55432/ping\nTEST_DATABASE_URL=postgres://ping:local-development-only@127.0.0.1:55432/ping_test\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nPIN_PEPPER=${randomBytes(32).toString("hex")}\nAPP_ORIGIN=http://localhost:5173\nPORT=3001\nDEMO_MODE=true\n`,
  );
console.log(
  "Local PostgreSQL ready on 127.0.0.1:55432 (ping, ping_test). Ctrl+C stops it; data persists.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 60000);
