import { ensureDatabaseSchema, getSql } from "@/lib/db";
import type { PersistedVideoJob } from "@/lib/video-types";

type JobRow = {
  aspect_ratio: string | null;
  created_at: string;
  duration: number | null;
  error: string | null;
  error_code: string | null;
  error_hint: string | null;
  generate_audio: boolean;
  generation_id: string | null;
  id: string;
  model: string;
  polling_url: string;
  prompt: string;
  reference_image_count: number;
  resolution: string | null;
  seed: number | null;
  status: string;
  unsigned_urls: unknown;
  updated_at: string;
  usage: PersistedVideoJob["usage"] | null;
};

function parseUnsignedUrls(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function mapRowToJob(row: JobRow): PersistedVideoJob {
  return {
    aspectRatio: row.aspect_ratio ?? undefined,
    createdAt: row.created_at,
    duration: row.duration,
    error: row.error ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorHint: row.error_hint ?? undefined,
    generateAudio: row.generate_audio,
    generationId: row.generation_id ?? undefined,
    id: row.id,
    model: row.model,
    pollingUrl: row.polling_url,
    prompt: row.prompt,
    referenceImageCount: row.reference_image_count,
    resolution: row.resolution ?? undefined,
    seed: row.seed,
    status: row.status,
    unsignedUrls: parseUnsignedUrls(row.unsigned_urls),
    updatedAt: row.updated_at,
    usage: row.usage ?? undefined,
  };
}

export async function listJobs() {
  await ensureDatabaseSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
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
    FROM video_jobs
    ORDER BY updated_at DESC
  `) as JobRow[];

  return rows.map(mapRowToJob);
}

export async function upsertJob(job: PersistedVideoJob) {
  await ensureDatabaseSchema();
  const sql = getSql();

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

export async function getJob(jobId: string) {
  await ensureDatabaseSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
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
    FROM video_jobs
    WHERE id = ${jobId}
    LIMIT 1
  `) as JobRow[];

  return rows[0] ? mapRowToJob(rows[0]) : null;
}
