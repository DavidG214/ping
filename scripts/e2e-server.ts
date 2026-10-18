import "dotenv/config";
import pg from "pg";
import { migrate } from "../db/migrate";
import { createApp } from "../server/app";
if (
  new URL(process.env.TEST_DATABASE_URL || "postgres://invalid/").pathname !==
  "/ping_test"
)
  throw new Error("E2E requires dedicated ping_test database");
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
await migrate(pool);
await pool.query("TRUNCATE workspaces CASCADE");
await pool.query("TRUNCATE sessions,login_attempts");
const app = createApp({
  pool,
  origin: "http://localhost:41937",
  secret: "e2e-session-secret-at-least-32-characters",
  pepper: "e2e-pepper-at-least-32-characters",
  demo: true,
  production: false,
});
app.listen(41937, "127.0.0.1", () =>
  console.log("Isolated E2E server ready on localhost:41937"),
);
