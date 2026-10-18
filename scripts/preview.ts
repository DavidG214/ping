import "dotenv/config";
import pg from "pg";
import { createApp } from "../server/app";

// A loopback-only preview of the built client. Never resets either database.
const database = new URL(process.env.DATABASE_URL || "postgres://invalid/");
if (
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/ping"
)
  throw new Error("Local preview requires the local ping database.");
for (const key of ["SESSION_SECRET", "PIN_PEPPER"])
  if ((process.env[key]?.length || 0) < 32)
    throw new Error(`${key} is required`);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const marker = (
  await pool.query("SELECT value FROM app_settings WHERE key='environment'")
).rows[0]?.value;
if (marker !== "demo")
  throw new Error("Local preview requires a fictional demo database.");
const app = createApp({
  pool,
  origin: "http://localhost:41938",
  secret: process.env.SESSION_SECRET!,
  pepper: process.env.PIN_PEPPER!,
  demo: true,
  production: false,
});
const server = app.listen(41938, "127.0.0.1", () =>
  console.log("PING tablet preview: http://localhost:41938"),
);
async function close() {
  server.close();
  await pool.end();
  process.exit();
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
