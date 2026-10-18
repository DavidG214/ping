import "dotenv/config";
import pg from "pg";
import { migrate } from "./migrate";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await migrate(pool);
  console.log(
    "Fictional shelter seed ready. Private scenarios are created by Try the demo; existing workspaces were not reset.",
  );
} finally {
  await pool.end();
}
