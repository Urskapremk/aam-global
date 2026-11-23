import { pool } from '@/lib/db'

/**
 * Idempotent DDL for caretaker fuel columns / table.
 * Neon schema is evolved from the app (same pattern as HR / shop), not a
 * separate migrate CLI — call this before hisnik reads/writes.
 */
let ensured = false

export async function ensureHisnikSchema(): Promise<void> {
  if (ensured) return
  await pool.query(`
    ALTER TABLE fuel_log ADD COLUMN IF NOT EXISTS source text;
    ALTER TABLE fuel_log ADD COLUMN IF NOT EXISTS "eventType" text;
    ALTER TABLE fuel_config ADD COLUMN IF NOT EXISTS "densityKgPerL" double precision NOT NULL DEFAULT 0.75;
    CREATE TABLE IF NOT EXISTS caretaker_cans (
      id text PRIMARY KEY,
      boat text NOT NULL,
      label text NOT NULL DEFAULT 'Prenosna kanta',
      location text NOT NULL DEFAULT 'at_warehouse',
      "lastLitres" double precision,
      "lastKilograms" double precision,
      "issuedLitres" double precision,
      "issuedKilograms" double precision,
      "issuedAt" timestamptz,
      "lastWeighedAt" timestamptz,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    );
  `)
  ensured = true
}
