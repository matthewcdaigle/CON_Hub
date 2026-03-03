import crypto from "crypto";
import fs from "fs";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Read the baseline migration entry from the journal
  const journal: Journal = JSON.parse(
    fs.readFileSync("./migrations/meta/_journal.json", "utf-8"),
  );
  const baseline = journal.entries[0];
  if (!baseline) {
    throw new Error("No entries found in migrations journal");
  }

  // Compute the SHA-256 hash of the migration SQL file (same as Drizzle does internally)
  const sqlContent = fs.readFileSync(
    `./migrations/${baseline.tag}.sql`,
    "utf-8",
  );
  const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

  console.log(
    `Baseline migration: tag="${baseline.tag}", hash=${hash.slice(0, 16)}..., when=${baseline.when}`,
  );

  // Drizzle stores its migration journal in the "drizzle" schema
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);

  // Create the __drizzle_migrations table if it doesn't exist (matching Drizzle's schema)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id serial PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  // Insert the baseline record only if that hash isn't already present
  const existing = await pool.query(
    `SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = $1`,
    [hash],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    console.log(
      `Baseline migration "${baseline.tag}" is already recorded. Nothing to do.`,
    );
  } else {
    await pool.query(
      `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
      [hash, baseline.when],
    );
    console.log(
      `Baseline migration "${baseline.tag}" marked as applied.`,
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Baseline failed:", err);
  process.exit(1);
});
