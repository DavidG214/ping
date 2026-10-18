import "dotenv/config";
import pg from "pg";
import { createApp } from "./app";
for (const key of [
  "DATABASE_URL",
  "SESSION_SECRET",
  "PIN_PEPPER",
  "APP_ORIGIN",
])
  if (!process.env[key]) throw new Error(`${key} is required`);
if (
  process.env.SESSION_SECRET!.length < 32 ||
  process.env.PIN_PEPPER!.length < 32
)
  throw new Error("Secrets must contain at least 32 characters");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 15000,
});
const demo = process.env.DEMO_MODE === "true";
const marker = (
  await pool.query("SELECT value FROM app_settings WHERE key='environment'")
).rows[0]?.value;
if ((marker === "demo") !== demo)
  throw new Error("Database environment and DEMO_MODE disagree");
const app = createApp({
  pool,
  origin: process.env.APP_ORIGIN!,
  secret: process.env.SESSION_SECRET!,
  pepper: process.env.PIN_PEPPER!,
  demo,
  production: process.env.NODE_ENV === "production",
});
const server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log(`PING ready on port ${process.env.PORT || 3001}`),
);
async function close() {
  server.close();
  await pool.end();
  process.exit();
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
