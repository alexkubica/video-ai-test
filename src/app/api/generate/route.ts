import { NextResponse } from "next/server";
import type {
  AspectRatio,
  ContentPartImage,
  FrameImage,
  Resolution,
} from "@openrouter/sdk/models";

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

function classifyGenerationError(error: unknown) {
  const fallback = {
    hint: undefined as string | undefined,
    message:
      error instanceof Error ? error.message : "Unable to start generation.",
    status: 500,
    errorCode: "generation_failed",
  };

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    const statusCode = error.statusCode;
    const body =
      "body" in error && typeof error.body === "string" ? error.body : "";

    if (statusCode === 401 && body.includes("User not found")) {
      return {
        errorCode: "openrouter_video_access_denied",
        hint: "This OpenRouter key can reach the API, but your account is not currently allowed to create jobs on /api/v1/videos. Create a new key, verify billing/video access, or contact OpenRouter support with the 401 response details.",
        message:
          "OpenRouter accepted the API key for model listing, but rejected video job creation for this account.",
        status: 401,
      };
    }

    if (statusCode === 402) {
      return {
        errorCode: "openrouter_payment_required",
        hint: "OpenRouter returned payment required. Check account credits and billing.",
        message: "OpenRouter rejected the request due to billing or credits.",
        status: 402,
      };
    }

    if (statusCode === 429) {
      return {
        errorCode: "openrouter_rate_limited",
        hint: "OpenRouter rate limited the request. Wait and retry.",
        message: "OpenRouter rate limited the video generation request.",
        status: 429,
      };
    }
  }

  return fallback;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      aspectRatio?: string;
      duration?: number | string;
      frameImages?: FrameImage[];
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
        frameImages:
          body.frameImages && body.frameImages.length ? body.frameImages : undefined,
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

    const classified = classifyGenerationError(error);

    return NextResponse.json(
      {
        error: classified.message,
        errorCode: classified.errorCode,
        errorHint: classified.hint,
      },
      { status: classified.status },
    );
  }
}
