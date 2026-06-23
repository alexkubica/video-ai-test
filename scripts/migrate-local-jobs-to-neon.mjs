import { readFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const sql = neon(databaseUrl);

const sourcePath = new URL("../.data/video-jobs.json", import.meta.url);
const raw = await readFile(sourcePath, "utf8");
const parsed = JSON.parse(raw);
const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];

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

for (const job of jobs) {
  await sql`
    INSERT INTO video_jobs (
      id,
      polling_url,
      status,
      generation_id,
      error,
      error_code,
      error_hint,
      unsigned_urls,
      usage,
      model,
      prompt,
      aspect_ratio,
      resolution,
      duration,
      generate_audio,
      reference_image_count,
      seed,
      created_at,
      updated_at
    ) VALUES (
      ${job.id},
      ${job.pollingUrl},
      ${job.status},
      ${job.generationId ?? null},
      ${job.error ?? null},
      ${job.errorCode ?? null},
      ${job.errorHint ?? null},
      ${JSON.stringify(job.unsignedUrls ?? [])},
      ${job.usage ? JSON.stringify(job.usage) : null},
      ${job.model},
      ${job.prompt},
      ${job.aspectRatio ?? null},
      ${job.resolution ?? null},
      ${job.duration ?? null},
      ${job.generateAudio ?? false},
      ${job.referenceImageCount ?? 0},
      ${job.seed ?? null},
      ${job.createdAt},
      ${job.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      polling_url = EXCLUDED.polling_url,
      status = EXCLUDED.status,
      generation_id = EXCLUDED.generation_id,
      error = EXCLUDED.error,
      error_code = EXCLUDED.error_code,
      error_hint = EXCLUDED.error_hint,
      unsigned_urls = EXCLUDED.unsigned_urls,
      usage = EXCLUDED.usage,
      model = EXCLUDED.model,
      prompt = EXCLUDED.prompt,
      aspect_ratio = EXCLUDED.aspect_ratio,
      resolution = EXCLUDED.resolution,
      duration = EXCLUDED.duration,
      generate_audio = EXCLUDED.generate_audio,
      reference_image_count = EXCLUDED.reference_image_count,
      seed = EXCLUDED.seed,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at
  `;
}

console.log(`Imported ${jobs.length} job(s) into Neon.`);
