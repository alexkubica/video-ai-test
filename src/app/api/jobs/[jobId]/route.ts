import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSessionEmail, isAllowedEmail, unauthorizedJson } from "@/lib/auth-helpers";
import { getJob, upsertJob } from "@/lib/job-store";
import { getApiKeyOverrideFromRequest, getOpenRouterClient } from "@/lib/openrouter";
import type { PersistedVideoJob, VideoGenerationJob } from "@/lib/video-types";

export const GET = auth(async (
  request,
  { params }: { params: Promise<{ jobId: string }> },
) => {
  if (!isAllowedEmail(getSessionEmail(request.auth))) {
    return unauthorizedJson();
  }

  try {
    const { jobId } = await params;
    const openRouter = getOpenRouterClient(getApiKeyOverrideFromRequest(request));
    const generation = await openRouter.videoGeneration.getGeneration({ jobId });
    const existingJob = await getJob(jobId);
    const now = new Date().toISOString();

    const response: VideoGenerationJob = {
      createdAt: existingJob?.createdAt,
      error: generation.error,
      generationId: generation.generationId,
      id: generation.id,
      pollingUrl: generation.pollingUrl,
      status: generation.status,
      unsignedUrls: generation.unsignedUrls ?? [],
      updatedAt: now,
      usage: generation.usage,
    };

    if (existingJob) {
      const persistedJob: PersistedVideoJob = {
        ...existingJob,
        ...response,
        updatedAt: now,
      };

      await upsertJob(persistedJob);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unable to load job status", error);

    const message =
      error instanceof Error ? error.message : "Unable to load job status.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
});
