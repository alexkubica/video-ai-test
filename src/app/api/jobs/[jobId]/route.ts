import { NextResponse } from "next/server";

import { getOpenRouterClient } from "@/lib/openrouter";
import type { VideoGenerationJob } from "@/lib/video-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const openRouter = getOpenRouterClient();
    const generation = await openRouter.videoGeneration.getGeneration({ jobId });

    const response: VideoGenerationJob = {
      error: generation.error,
      generationId: generation.generationId,
      id: generation.id,
      pollingUrl: generation.pollingUrl,
      status: generation.status,
      unsignedUrls: generation.unsignedUrls ?? [],
      usage: generation.usage,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load job status.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
