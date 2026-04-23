import { NextResponse } from "next/server";
import type { AspectRatio, ContentPartImage, Resolution } from "@openrouter/sdk/models";

import { upsertJob } from "@/lib/job-store";
import { getOpenRouterClient } from "@/lib/openrouter";
import type { PersistedVideoJob, VideoGenerationJob } from "@/lib/video-types";

function toOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      aspectRatio?: string;
      duration?: number | string;
      generateAudio?: boolean;
      inputReferences?: ContentPartImage[];
      model?: string;
      prompt?: string;
      resolution?: string;
      seed?: number | string;
    };

    const model = body.model?.trim();
    const prompt = body.prompt?.trim();

    if (!model || !prompt) {
      return NextResponse.json(
        { error: "Both model and prompt are required." },
        { status: 400 },
      );
    }

    const openRouter = getOpenRouterClient();
    const generation = await openRouter.videoGeneration.generate({
      videoGenerationRequest: {
        aspectRatio: (body.aspectRatio || undefined) as AspectRatio | undefined,
        duration: toOptionalNumber(body.duration),
        generateAudio: body.generateAudio ? true : undefined,
        inputReferences:
          body.inputReferences && body.inputReferences.length
            ? body.inputReferences
            : undefined,
        model,
        prompt,
        resolution: (body.resolution || undefined) as Resolution | undefined,
        seed: toOptionalNumber(body.seed),
      },
    });

    const response: VideoGenerationJob = {
      error: generation.error,
      generationId: generation.generationId,
      id: generation.id,
      pollingUrl: generation.pollingUrl,
      status: generation.status,
      unsignedUrls: generation.unsignedUrls ?? [],
      usage: generation.usage,
    };

    const now = new Date().toISOString();
    const persistedJob: PersistedVideoJob = {
      ...response,
      aspectRatio: body.aspectRatio,
      createdAt: now,
      duration: toOptionalNumber(body.duration) ?? null,
      generateAudio: Boolean(body.generateAudio),
      model,
      prompt,
      referenceImageCount: body.inputReferences?.length ?? 0,
      resolution: body.resolution,
      seed: toOptionalNumber(body.seed) ?? null,
      updatedAt: now,
    };

    await upsertJob(persistedJob);

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error("Video generation request failed", error);

    const message =
      error instanceof Error ? error.message : "Unable to start generation.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
