import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PersistedVideoJob } from "@/lib/video-types";

const DATA_DIR = path.join(process.cwd(), ".data");
const JOBS_FILE = path.join(DATA_DIR, "video-jobs.json");

type JobStoreShape = {
  jobs: PersistedVideoJob[];
};

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(JOBS_FILE, "utf8");
  } catch {
    await writeFile(JOBS_FILE, JSON.stringify({ jobs: [] }, null, 2), "utf8");
  }
}

async function readStore(): Promise<JobStoreShape> {
  await ensureStore();
  const raw = await readFile(JOBS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw) as JobStoreShape;
    return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
  } catch {
    return { jobs: [] };
  }
}

async function writeStore(store: JobStoreShape) {
  await ensureStore();
  await writeFile(JOBS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function sortJobs(jobs: PersistedVideoJob[]) {
  return [...jobs].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function listJobs() {
  const store = await readStore();
  return sortJobs(store.jobs);
}

export async function upsertJob(job: PersistedVideoJob) {
  const store = await readStore();
  const nextJobs = store.jobs.filter((entry) => entry.id !== job.id);
  nextJobs.push(job);
  await writeStore({ jobs: sortJobs(nextJobs) });
}

export async function getJob(jobId: string) {
  const jobs = await listJobs();
  return jobs.find((job) => job.id === jobId) ?? null;
}
