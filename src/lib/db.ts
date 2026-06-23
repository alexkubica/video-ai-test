import { neon } from "@neondatabase/serverless";

let schemaReady: Promise<void> | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return databaseUrl;
}

export function getSql() {
  return neon(getDatabaseUrl());
}

export async function ensureDatabaseSchema() {
  if (!schemaReady) {
    const sql = getSql();

    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS video_jobs (
          id TEXT PRIMARY KEY,
          polling_url TEXT NOT NULL,
          status TEXT NOT NULL,
          generation_id TEXT,
          error TEXT,
          error_code TEXT,
          error_hint TEXT,
          unsigned_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
          usage JSONB,
          model TEXT NOT NULL,
          prompt TEXT NOT NULL,
          aspect_ratio TEXT,
          resolution TEXT,
          duration INTEGER,
          generate_audio BOOLEAN NOT NULL DEFAULT FALSE,
          reference_image_count INTEGER NOT NULL DEFAULT 0,
          seed INTEGER,
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  await schemaReady;
}
